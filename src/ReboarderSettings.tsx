import { type SortSpec } from 'src/model/sort';

export interface ReboarderSettings {
	snoozeDurations: { [key: string]: number; };
	defaultSnoozeHours: number;
	cardPreviewLength: number;
	/** Sort per board, keyed by folder path. Boards without an entry use DEFAULT_SORT. */
	boardSort: Record<string, SortSpec>;
}

export const DEFAULT_SETTINGS: ReboarderSettings = {
	snoozeDurations: {
		'2 days': 48,
	},
	defaultSnoozeHours: 24,
	cardPreviewLength: 200,
	boardSort: {},
};

