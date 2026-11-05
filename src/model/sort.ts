import { type FileRecord } from 'src/model/FileRecord';

export type SortDirection = 'asc' | 'desc';

export type SortSpec =
	| { kind: 'mtime'; direction: SortDirection }
	| { kind: 'frontmatter'; key: string; direction: SortDirection };

export const DEFAULT_SORT: SortSpec = { kind: 'mtime', direction: 'desc' };

function isMissing(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

/** Alphabetical, with digit runs compared as numbers so "2" < "10". */
function compareValues(a: unknown, b: unknown): number {
	return String(a).localeCompare(String(b), undefined, { numeric: true });
}

const byMtimeDesc = (a: FileRecord, b: FileRecord) => b.mtime - a.mtime;

/**
 * Comparator for board cards.
 * Frontmatter sorts put notes without the key last regardless of direction,
 * and break ties by most recently modified.
 */
export function compareCards(spec: SortSpec): (a: FileRecord, b: FileRecord) => number {
	if (spec.kind === 'mtime') {
		return spec.direction === 'desc' ? byMtimeDesc : (a, b) => a.mtime - b.mtime;
	}
	const sign = spec.direction === 'asc' ? 1 : -1;
	return (a, b) => {
		const va = a.frontmatter[spec.key];
		const vb = b.frontmatter[spec.key];
		const missingA = isMissing(va);
		const missingB = isMissing(vb);
		if (missingA !== missingB) return missingA ? 1 : -1;
		if (!missingA) {
			const c = compareValues(va, vb) * sign;
			if (c !== 0) return c;
		}
		return byMtimeDesc(a, b);
	};
}

/** Frontmatter keys present on any of the given records, sorted alphabetically. */
export function frontmatterKeys(records: FileRecord[], exclude: string[] = []): string[] {
	const keys = new Set<string>();
	for (const record of records) {
		for (const key of Object.keys(record.frontmatter)) {
			if (!exclude.includes(key)) keys.add(key);
		}
	}
	return [...keys].sort((a, b) => a.localeCompare(b));
}
