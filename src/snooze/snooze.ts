import { App, TFile, Notice } from 'obsidian';
import { getFrontmatter, editFrontmatter } from './frontmatter';
import { type ExpireTime, type SnoozeIntervalHours } from 'src/model/brands';

// Re-export branded types for consumers that imported from here
export type { ExpireTime, SnoozeIntervalHours };

// Frontmatter keys for snooze data
export const SNOOZE_INTERVAL_KEY = 'reboarder_snooze_interval';
export const SNOOZE_EXPIRE_KEY = 'reboarder_snooze_expire';

// Legacy type kept for reference
export type LegacySnoozeData = { [filePath: string]: { interval: number; expire: string } };

/**
 * Format a Date as ISO YYYY-MM-DD HH:MM:SS
 */
export function toISODateTime(date: Date): ExpireTime {
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` as ExpireTime;
}

/**
 * Parse an ISO YYYY-MM-DD HH:MM:SS string to a Date
 */
export function parseISODateTime(str: ExpireTime): Date {
	const normalized = str.replace(' ', 'T');
	return new Date(normalized);
}

/**
 * Return snooze entry from a note frontmatter, if present and valid.
 */
export function getSnoozeEntry(app: App, file: TFile): { interval: SnoozeIntervalHours; expire: ExpireTime } | null {
	const fm = getFrontmatter(app, file);
	if (!fm) return null;

	const interval = fm[SNOOZE_INTERVAL_KEY];
	const expire = fm[SNOOZE_EXPIRE_KEY];

	if (typeof interval === 'number' && typeof expire === 'string') {
		return { interval: interval as SnoozeIntervalHours, expire: expire as ExpireTime };
	}
	return null;
}

/**
 * Set snooze entry in a note's frontmatter.
 */
export async function setSnoozeEntry(app: App, file: TFile, interval: SnoozeIntervalHours, expire: ExpireTime) {
	await editFrontmatter(app, file, map => {
		map[SNOOZE_INTERVAL_KEY] = interval;
		map[SNOOZE_EXPIRE_KEY] = expire;
	}, [SNOOZE_INTERVAL_KEY, SNOOZE_EXPIRE_KEY]);
}

/**
 * Clear snooze entry from a note's frontmatter.
 */
export async function clearSnoozeEntry(app: App, file: TFile) {
	await editFrontmatter(app, file, map => {
		delete map[SNOOZE_INTERVAL_KEY];
		delete map[SNOOZE_EXPIRE_KEY];
	}, [SNOOZE_INTERVAL_KEY, SNOOZE_EXPIRE_KEY]);
}

/**
 * Check if a note is currently snoozed.
 */
export function isNoteSnoozed(app: App, file: TFile): boolean {
	const entry = getSnoozeEntry(app, file);
	return !!(entry && Date.now() < parseISODateTime(entry.expire).getTime());
}

/**
 * Snooze a note for the specified number of hours.
 */
export async function snoozeNote(
	app: App,
	file: TFile,
	hours: SnoozeIntervalHours,
	onUpdate?: (interval: SnoozeIntervalHours, expireTime: ExpireTime) => void
) {
	const expireDate = new Date(Date.now() + (hours * 60 * 60 * 1000));
	const expireTime = toISODateTime(expireDate);
	await setSnoozeEntry(app, file, hours, expireTime);

	if (onUpdate) {
		onUpdate(hours, expireTime);
	}

	new Notice(`${file.name} snoozed for ${hours} hour(s)`);
}
