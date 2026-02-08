import { App, TFile, Notice } from 'obsidian';
import { ExpireTimeSchema, type ExpireTime } from 'src/model/brands';

// Re-export branded types for consumers that imported from here
export type { ExpireTime };

// Frontmatter keys for snooze data
export const SNOOZE_EXPIRE_KEY = 'reboarder_snooze_expire';

/**
 * Format a Date as ISO YYYY-MM-DD HH:MM:SS for frontmatter storage.
 */
function toISODateTime(date: Date): string {
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Return snooze entry from a note frontmatter, if present and valid.
 */
export function getSnoozeEntry(app: App, file: TFile): { expire: ExpireTime } | null {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	if (!fm) return null;

	const expire = fm[SNOOZE_EXPIRE_KEY];

	if (typeof expire === 'string') {
		return { expire: ExpireTimeSchema.parse(expire) };
	}
	return null;
}

/**
 * Set snooze entry in a note's frontmatter.
 */
export async function setSnoozeEntry(app: App, file: TFile, expire: ExpireTime) {
	await app.fileManager.processFrontMatter(file, (fm) => {
		fm[SNOOZE_EXPIRE_KEY] = toISODateTime(expire);
	});
}

/**
 * Clear snooze entry from a note's frontmatter.
 */
export async function clearSnoozeEntry(app: App, file: TFile) {
	await app.fileManager.processFrontMatter(file, (fm) => {
		delete fm[SNOOZE_EXPIRE_KEY];
	});
}

/**
 * Check if a note is currently snoozed.
 */
export function isNoteSnoozed(app: App, file: TFile): boolean {
	const entry = getSnoozeEntry(app, file);
	return !!(entry && Date.now() < entry.expire.getTime());
}

/**
 * Snooze a note for the specified number of hours.
 */
export async function snoozeNote(
	app: App,
	file: TFile,
	hours: number,
	onUpdate?: (expireTime: ExpireTime) => void
) {
	const expireDate = new Date(Date.now() + (hours * 60 * 60 * 1000));
	const expireTime = ExpireTimeSchema.parse(expireDate);
	await setSnoozeEntry(app, file, expireTime);

	if (onUpdate) {
		onUpdate(expireTime);
	}

	new Notice(`${file.name} snoozed for ${hours} hour(s)`);
}
