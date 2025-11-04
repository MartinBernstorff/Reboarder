import { App, TFile, Notice } from 'obsidian';

// Frontmatter keys for snooze data
export const SNOOZE_INTERVAL_KEY = 'reboarder_snooze_interval';
export const SNOOZE_EXPIRE_KEY = 'reboarder_snooze_expire';

// Type definitions
export type FrontmatterMap = { [key: string]: string | number | boolean };

export interface LegacySnoozeData {
	[filePath: string]: { interval: number; expire: number };
}

/**
 * Read current frontmatter using metadata cache.
 */
export function getFrontmatter(app: App, file: TFile): FrontmatterMap | null {
	const cache = app.metadataCache.getFileCache(file);
	return cache?.frontmatter ?? null;
}

/**
 * Return snooze entry from a note frontmatter, if present and valid.
 */
export function getSnoozeEntry(app: App, file: TFile): { interval: number; expire: number; } | null {
	const fm = getFrontmatter(app, file);
	if (!fm) return null;

	const interval = fm[SNOOZE_INTERVAL_KEY];
	const expire = fm[SNOOZE_EXPIRE_KEY];

	if (typeof interval === 'number' && typeof expire === 'number') {
		return { interval, expire };
	}
	return null;
}

/**
 * Generic frontmatter edit helper (very lightweight YAML manip).
 */
export async function editFrontmatter(
	app: App,
	file: TFile,
	mutator: (map: FrontmatterMap) => void | boolean
) {
	const content = await app.vault.read(file);
	let fmStart = -1;
	let fmEnd = -1;
	if (content.startsWith('---')) {
		fmStart = 0;
		fmEnd = content.indexOf('\n---', 3);
		if (fmEnd !== -1) {
			// position right after closing --- line
			const after = content.indexOf('\n', fmEnd + 4);
			if (after !== -1) fmEnd = after + 1; // include newline after closing ---
			else fmEnd = content.length;
		}
	}

	let frontmatterRaw = '';
	if (fmStart === 0 && fmEnd !== -1) {
		// Extract between first '---\n' and the line with only '---'
		const fmBlock = content.slice(0, fmEnd);
		const lines = fmBlock.split('\n');
		lines.shift(); // remove opening ---

		// remove closing --- (last non-empty '---')
		while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
		if (lines.length > 0 && lines[lines.length - 1].trim() === '---') lines.pop();
		frontmatterRaw = lines.join('\n');
	}

	const map: FrontmatterMap = {};
	if (frontmatterRaw) {
		frontmatterRaw.split(/\n/).forEach(line => {
			const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
			if (match) {
				map[match[1]] = isNaN(Number(match[2])) ? match[2] : Number(match[2]);
			}
		});
	}

	mutator(map);

	// Clean out undefined / null
	Object.keys(map).forEach(k => { if (map[k] === undefined || map[k] === null) delete map[k]; });

	// Remove our keys if they are not both present (avoid partial data)
	if (!(SNOOZE_INTERVAL_KEY in map && SNOOZE_EXPIRE_KEY in map)) {
		delete map[SNOOZE_INTERVAL_KEY];
		delete map[SNOOZE_EXPIRE_KEY];
	}

	let newContent: string;
	const keys = Object.keys(map);
	if (keys.length === 0) {
		// Remove frontmatter entirely if it only contained our keys or became empty
		if (fmStart === 0 && fmEnd !== -1) {
			newContent = content.slice(fmEnd); // strip old frontmatter
		} else {
			newContent = content; // nothing to change
		}
	} else {
		const fmSerialized = keys.map(k => `${k}: ${map[k]}`).join('\n');
		const rebuilt = `---\n${fmSerialized}\n---\n`;
		if (fmStart === 0 && fmEnd !== -1) {
			newContent = rebuilt + content.slice(fmEnd);
		} else {
			newContent = rebuilt + content;
		}
	}
	if (newContent !== content) {
		await app.vault.modify(file, newContent);
	}
}

/**
 * Set snooze entry in a note's frontmatter.
 */
export async function setSnoozeEntry(app: App, file: TFile, interval: number, expire: number) {
	await editFrontmatter(app, file, map => {
		map[SNOOZE_INTERVAL_KEY] = interval;
		map[SNOOZE_EXPIRE_KEY] = expire;
	});
}

/**
 * Clear snooze entry from a note's frontmatter.
 */
export async function clearSnoozeEntry(app: App, file: TFile) {
	await editFrontmatter(app, file, map => {
		delete map[SNOOZE_INTERVAL_KEY];
		delete map[SNOOZE_EXPIRE_KEY];
	});
}

/**
 * Check if a note is currently snoozed.
 */
export function isNoteSnoozed(app: App, file: TFile): boolean {
	const entry = getSnoozeEntry(app, file);
	return !!(entry && Date.now() < entry.expire);
}

/**
 * Snooze a note for the specified number of hours.
 */
export async function snoozeNote(
	app: App,
	file: TFile,
	hours: number,
	onUpdate?: (interval: number, expireTime: number) => void
) {
	const expireTime = Date.now() + (hours * 60 * 60 * 1000);
	await setSnoozeEntry(app, file, hours, expireTime);
	
	if (onUpdate) {
		onUpdate(hours, expireTime);
	}
	
	new Notice(`${file.name} snoozed for ${hours} hour(s)`);
}
