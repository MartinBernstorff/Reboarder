import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Notice, TFolder } from 'obsidian';
import { Card } from './Card';
import { CustomSnoozeModal } from './CustomSnoozeModal';
import { HotkeyHelpOverlay } from './HotkeyHelpOverlay';
import { HOTKEYS } from './hotkeys';
import { useLiveQuery } from '@tanstack/react-db';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useHotkey } from '@tanstack/react-hotkeys';
import ReboarderPlugin from 'src/ReboarderPlugin';
import { type FileRecord, isSnoozed } from 'src/model/FileRecord';
import { type FilePath } from 'src/model/brands';
import { Notes } from 'src/Notes';
import { Workspace } from 'src/Workspace';
import { useListNavigation } from './useGridNavigation';
import { useScrollIntoView } from './useScrollIntoView';
import { useDoublePress } from './useDoublePress';
import { compareCards, DEFAULT_SORT, frontmatterKeys, type SortSpec } from 'src/model/sort';
import { SNOOZE_EXPIRE_KEY } from 'src/snooze/snooze';

/** Select value for the built-in "Modified" option; cannot collide with a frontmatter key. */
const MTIME_OPTION = '\u0000mtime';

function sortDirectionTitle(spec: SortSpec): string {
	if (spec.kind === 'mtime') return spec.direction === 'desc' ? 'Newest first' : 'Oldest first';
	return spec.direction === 'asc' ? 'Ascending' : 'Descending';
}

interface BoardProps {
	folder: TFolder;
	plugin: ReboarderPlugin;
	onOpenNote: (file: FileRecord) => void;
}

export const Board: React.FC<BoardProps> = ({
	folder,
	plugin,
	onOpenNote
}) => {
	const wokenRef = useRef<string | null>(null);
	const boardRef = useRef<HTMLDivElement>(null);
	// Selection is tracked by path so it follows a card when the sort order changes.
	// `index` is the fallback position used when the selected card disappears.
	const [selection, setSelection] = useState<{ path: FilePath | null; index: number }>({ path: null, index: 0 });
	const [sortSpec, setSortSpecState] = useState<SortSpec>(
		() => plugin.settings.boardSort[folder.path] ?? DEFAULT_SORT
	);
	const [snoozeFile, setSnoozeFile] = useState<FileRecord | null>(null);
	const [boardState, setBoardState] = useState<'navigating' | 'modal'>('navigating');
	const [showHelp, setShowHelp] = useState(false);

	useEffect(() => {
		if (wokenRef.current !== folder.path) {
			wokenRef.current = folder.path;
			plugin.wakeExpiredSnoozes(folder.path as FilePath);
		}
	}, [folder.path, plugin]);

	const files = useLiveQuery((q) => q.from({ boards: plugin.fileCollection }))
		.data

	const boardFiles = files
		.filter(it => it.path.contains(folder.path + "/"))
		.filter(it => !isSnoozed(it))
		.sort(compareCards(sortSpec));

	const foundIndex = boardFiles.findIndex(it => it.path === selection.path);
	const selectedIndex = foundIndex !== -1
		? foundIndex
		: Math.max(0, Math.min(selection.index, boardFiles.length - 1));

	const setSelectedIndex = useCallback((index: number) => {
		setSelection({ path: boardFiles[index]?.path ?? null, index });
	}, [boardFiles]);

	const sortKeys = frontmatterKeys(boardFiles, [SNOOZE_EXPIRE_KEY]);
	if (sortSpec.kind === 'frontmatter' && !sortKeys.includes(sortSpec.key)) {
		sortKeys.push(sortSpec.key);
	}

	const updateSort = useCallback((spec: SortSpec) => {
		setSortSpecState(spec);
		plugin.settings.boardSort[folder.path] = spec;
		void plugin.saveSettings();
	}, [plugin, folder.path]);

	const selectSortKey = useCallback((value: string) => {
		updateSort(value === MTIME_OPTION
			? DEFAULT_SORT
			: { kind: 'frontmatter', key: value, direction: 'asc' });
	}, [updateSort]);

	const cycleSortKey = useCallback(() => {
		const options = [MTIME_OPTION, ...sortKeys];
		const current = sortSpec.kind === 'mtime' ? MTIME_OPTION : sortSpec.key;
		selectSortKey(options[(options.indexOf(current) + 1) % options.length]);
	}, [sortKeys, sortSpec, selectSortKey]);

	const flipSortDirection = useCallback(() => {
		updateSort({ ...sortSpec, direction: sortSpec.direction === 'asc' ? 'desc' : 'asc' });
	}, [sortSpec, updateSort]);

	// Focus board when a card becomes selected
	useEffect(() => {
		if (boardRef.current) {
			boardRef.current.focus();
		}
	}, [selectedIndex !== null]);

	// Refocus board when the Reboarder leaf becomes active again
	useEffect(() => {
		const ref = plugin.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf?.view?.getViewType() === 'reboarder-view') {
				setTimeout(() => boardRef.current?.focus(), 0);
			}
		});
		return () => plugin.app.workspace.offref(ref);
	}, [plugin]);

	const [animateRef] = useAutoAnimate();
	const navigate = useListNavigation(boardFiles.length);
	useScrollIntoView(boardRef, '.reboarder-card', selectedIndex);

	const handleDelete = useCallback(() => {
		const selected = boardFiles[selectedIndex];
		if (selected) {
			plugin.fileCollection.delete(selected.name);
			new Notice(`Deleted ${selected.name}`);
		}
	}, [boardFiles, selectedIndex, plugin]);

	const onDeleteDoublePress = useDoublePress(handleDelete);

	const handleNewNote = useCallback(async () => {
		const tfile = await Notes.createNew(folder, plugin.fileCollection, plugin.app);
		await Workspace.openAndFocusFile(tfile, plugin.app);
	}, [folder, plugin]);

	const isNavigating = boardState === 'navigating' && !showHelp;
	const hotkeyOpts = { target: boardRef, enabled: isNavigating };

	const moveDown = useCallback(() => {
		const newIndex = navigate('down', selectedIndex);
		if (newIndex !== null) setSelectedIndex(newIndex);
	}, [navigate, selectedIndex, setSelectedIndex]);

	const moveUp = useCallback(() => {
		const newIndex = navigate('up', selectedIndex);
		if (newIndex !== null) setSelectedIndex(newIndex);
	}, [navigate, selectedIndex, setSelectedIndex]);

	const openSelected = useCallback(() => {
		const selected = boardFiles[selectedIndex];
		if (selected) onOpenNote(selected);
	}, [boardFiles, selectedIndex, onOpenNote]);

	const snoozeSelected = useCallback(() => {
		const selected = boardFiles[selectedIndex];
		if (selected) {
			setSnoozeFile(selected);
			setBoardState('modal');
		}
	}, [boardFiles, selectedIndex]);

	const unpinSelected = useCallback(() => {
		const selected = boardFiles[selectedIndex];
		if (selected) {
			const newPath = selected.name as string as FilePath;
			plugin.fileCollection.update(selected.name, (draft) => {
				draft.path = newPath;
			});
			new Notice(`Unpinned ${selected.name}`);
		}
	}, [boardFiles, selectedIndex, plugin]);

	// Register hotkeys — key strings come from the HOTKEYS registry
	useHotkey(HOTKEYS.moveDown.keys[0], moveDown, hotkeyOpts);
	useHotkey(HOTKEYS.moveDown.keys[1], moveDown, hotkeyOpts);
	useHotkey(HOTKEYS.moveUp.keys[0], moveUp, hotkeyOpts);
	useHotkey(HOTKEYS.moveUp.keys[1], moveUp, hotkeyOpts);
	useHotkey(HOTKEYS.nextCard.keys[0], () => {
		setSelectedIndex((selectedIndex + 1) % boardFiles.length);
	}, hotkeyOpts);
	useHotkey(HOTKEYS.prevCard.keys[0], () => {
		setSelectedIndex((selectedIndex - 1 + boardFiles.length) % boardFiles.length);
	}, hotkeyOpts);
	useHotkey(HOTKEYS.openNote.keys[0], openSelected, hotkeyOpts);
	useHotkey(HOTKEYS.openNote.keys[1], openSelected, hotkeyOpts);
	useHotkey(HOTKEYS.snooze.keys[0], snoozeSelected, hotkeyOpts);
	useHotkey(HOTKEYS.unpin.keys[0], unpinSelected, hotkeyOpts);
	useHotkey(HOTKEYS.delete.keys[0], () => onDeleteDoublePress(), hotkeyOpts);
	useHotkey(HOTKEYS.newNote.keys[0], () => handleNewNote(), hotkeyOpts);
	useHotkey(HOTKEYS.cycleSort.keys[0], cycleSortKey, hotkeyOpts);
	useHotkey(HOTKEYS.flipSort.keys[0], flipSortDirection, hotkeyOpts);

	// '?' is not a valid TanStack Hotkey key, so we match it via onKeyDown
	// using the same HOTKEYS registry value as source of truth.
	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (!isNavigating) return;
		if ((HOTKEYS.help.keys as readonly string[]).includes(e.key)) {
			e.preventDefault();
			setShowHelp(true);
		}
	}, [isNavigating]);

	return (
		<div
			className="reboarder-board"
			ref={boardRef}
			tabIndex={0}
			onKeyDown={handleKeyDown}
		>
			<div className="reboarder-toolbar">
				<label className="reboarder-sort-label">
					Sort by
					<select
						className="dropdown"
						value={sortSpec.kind === 'mtime' ? MTIME_OPTION : sortSpec.key}
						onChange={(e) => { selectSortKey(e.target.value); boardRef.current?.focus(); }}
					>
						<option value={MTIME_OPTION}>Modified</option>
						{sortKeys.map(key => <option key={key} value={key}>{key}</option>)}
					</select>
				</label>
				<button
					className="reboarder-sort-direction"
					onClick={() => { flipSortDirection(); boardRef.current?.focus(); }}
					title={sortDirectionTitle(sortSpec)}
				>
					{sortSpec.direction === 'asc' ? '\u2191' : '\u2193'}
				</button>
				<button
					className="reboarder-help-btn"
					onClick={() => setShowHelp(true)}
					title="Keyboard shortcuts"
				>
					?
				</button>
			</div>
			<div className="reboarder-cards-container" ref={animateRef}>
				{boardFiles.length === 0 ? (
					<div className="reboarder-empty-board">No notes in this folder</div>
				) : (
					boardFiles.map((fileRecord, index) => (
						<Card
							key={fileRecord.path}
							file={fileRecord}
							plugin={plugin}
							isSelected={index === selectedIndex}
							distanceFromSelected={Math.abs(index - selectedIndex)}
							onOpen={onOpenNote}
						/>
					))
				)}
			</div>

			{snoozeFile && (
				<CustomSnoozeModal
					file={snoozeFile}
					isOpen={true}
					onClose={() => { setSnoozeFile(null); setBoardState('navigating'); boardRef.current?.focus(); }}
				/>
			)}

			{showHelp && (
				<HotkeyHelpOverlay onClose={() => { setShowHelp(false); boardRef.current?.focus(); }} />
			)}

		</div>
	);
};
