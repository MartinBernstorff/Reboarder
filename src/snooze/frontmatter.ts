import { App, TFile } from 'obsidian';

export type FrontmatterMap = { [key: string]: string | number | boolean };

/**
 * Read current frontmatter using metadata cache.
 */
export function getFrontmatter(app: App, file: TFile): FrontmatterMap | null {
	const cache = app.metadataCache.getFileCache(file);
	return cache?.frontmatter ?? null;
}

/**
 * Generic frontmatter edit helper (very lightweight YAML manip).
 */
export async function editFrontmatter(
	app: App,
	file: TFile,
	mutator: (map: FrontmatterMap) => void | boolean,
	requiredKeys?: [string, string]
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

	// Remove paired keys if they are not both present (avoid partial data)
	if (requiredKeys) {
		if (!(requiredKeys[0] in map && requiredKeys[1] in map)) {
			delete map[requiredKeys[0]];
			delete map[requiredKeys[1]];
		}
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
