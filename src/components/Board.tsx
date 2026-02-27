import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Notice, TFolder } from 'obsidian';
import { Card } from './Card';
import { CustomSnoozeModal } from './CustomSnoozeModal';
import { useLiveQuery } from '@tanstack/react-db';
import ReboarderPlugin from 'src/ReboarderPlugin';
import { type FileRecord, isSnoozed } from 'src/model/FileRecord';
import { type FilePath } from 'src/model/brands';
import { Notes } from 'src/Notes';
import { useGridNavigation } from './useGridNavigation';
import { useScrollIntoView } from './useScrollIntoView';
import { useDoublePress } from './useDoublePress';

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
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [snoozeFile, setSnoozeFile] = useState<FileRecord | null>(null);
	const [boardState, setBoardState] = useState<'navigating' | 'modal'>('navigating');

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
		.sort((a, b) => b.mtime - a.mtime);

	// Select first card when cards become available; clamp when list shrinks
	useEffect(() => {
		if (selectedIndex >= boardFiles.length) {
			setSelectedIndex(boardFiles.length - 1);
		}
	}, [boardFiles.length]);

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

	const navigate = useGridNavigation(boardFiles.length, boardRef, '.reboarder-cards-container');
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
		const record = Notes.createNew(folder, plugin.fileCollection);
		if (record) onOpenNote(record);
	}, [folder, plugin, onOpenNote]);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (boardState === 'modal') return;

		// If no card is selected, select the first one on any navigation key
		if (selectedIndex === null) {
			if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'h', 'j', 'k', 'l', 'Tab'].includes(e.key)) {
				e.preventDefault();
				setSelectedIndex(0);
			}
			return;
		}

		const selected = boardFiles[selectedIndex];

		const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
			ArrowRight: 'right',
			ArrowLeft: 'left',
			ArrowDown: 'down',
			ArrowUp: 'up',
			l: 'right',
			h: 'left',
			j: 'down',
			k: 'up',
		};
		const direction = directionMap[e.key];
		if (direction) {
			e.preventDefault();
			const newIndex = navigate(direction, selectedIndex);
			if (newIndex !== null) setSelectedIndex(newIndex);
			return;
		}

		switch (e.key) {
			case 'Tab':
				if (e.shiftKey) break;
				e.preventDefault();
				setSelectedIndex(i => ((i ?? 0) + 1) % boardFiles.length);
				break;
			case 'Enter':
			case 'f':
				e.preventDefault();
				onOpenNote(selected);
				break;
			case 's':
				e.preventDefault();
				setSnoozeFile(selected);
				setBoardState('modal');
				break;
			case 'u':
				e.preventDefault();
				{
					const newPath = selected.name as string as FilePath;
					plugin.fileCollection.update(selected.name, (draft) => {
						draft.path = newPath;
					});
					new Notice(`Unpinned ${selected.name}`);
				}
				break;
			case 'd':
				e.preventDefault();
				onDeleteDoublePress();
				break;
			case 'n':
				e.preventDefault();
				handleNewNote();
				break;
		}

		// Handle Shift+Tab
		if (e.key === 'Tab' && e.shiftKey) {
			e.preventDefault();
			setSelectedIndex(i => ((i ?? 0) - 1 + boardFiles.length) % boardFiles.length);
		}
	}, [boardState, boardFiles, selectedIndex, onOpenNote, plugin, onDeleteDoublePress, handleNewNote]);

	const handleNewClick = async () => {
		handleNewNote();
	};

	return (
		<div
			className="reboarder-board"
			ref={boardRef}
			tabIndex={0}
			onKeyDown={handleKeyDown}
		>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
				<h3 className="reboarder-board-title" style={{ marginBottom: 0 }}>{folder.name}</h3>
				<button className="reboarder-new-note-btn" onClick={handleNewClick} aria-label="Add new note">+ New</button>
			</div>
			<div className="reboarder-cards-container">
				{boardFiles.length === 0 ? (
					<div className="reboarder-empty-board">No notes in this folder</div>
				) : (
					boardFiles.map((fileRecord, index) => (
						<Card
							key={fileRecord.path}
							file={fileRecord}
							plugin={plugin}
							isSelected={index === selectedIndex}
							onOpen={() => onOpenNote(fileRecord)}
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

		</div>
	);
};
