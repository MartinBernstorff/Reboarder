export interface ReboarderSettings {
	snoozeDurations: { [key: string]: number; };
	defaultSnoozeHours: number;
	cardPreviewLength: number;
}

export const DEFAULT_SETTINGS: ReboarderSettings = {
	snoozeDurations: {
		'2 days': 48,
	},
	defaultSnoozeHours: 24,
	cardPreviewLength: 200,
};

