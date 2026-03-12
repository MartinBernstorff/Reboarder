import type { RegisterableHotkey } from '@tanstack/react-hotkeys';

export interface HotkeyDef {
	keys: (RegisterableHotkey | '?')[];
	label: string;
}

export const HOTKEYS = {
	moveDown:  { keys: ['J', 'ArrowDown'],       label: 'Move down' },
	moveUp:    { keys: ['K', 'ArrowUp'],          label: 'Move up' },
	nextCard:  { keys: ['Tab'],                   label: 'Next card' },
	prevCard:  { keys: ['Shift+Tab'],             label: 'Previous card' },
	openNote:  { keys: ['Enter', 'F'],            label: 'Open note' },
	snooze:    { keys: ['S'],                     label: 'Snooze note' },
	unpin:     { keys: ['U'],                     label: 'Unpin note' },
	delete:    { keys: ['D'],                     label: 'Delete note (press twice)' },
	newNote:   { keys: ['N'],                     label: 'New note' },
	help:      { keys: ['?'],                     label: 'Show shortcuts' },
} as const satisfies Record<string, HotkeyDef>;

const KEY_DISPLAY: Record<string, string> = {
	ArrowDown: '\u2193',
	ArrowUp: '\u2191',
	'Shift+Tab': 'Shift+Tab',
};

function formatKey(key: string): string {
	return KEY_DISPLAY[key] ?? key.toLowerCase();
}

export function getHotkeyDisplayEntries(): { display: string; label: string }[] {
	return Object.values(HOTKEYS).map((h) => ({
		display: h.keys.map(formatKey).join(' / '),
		label: h.label,
	}));
}
