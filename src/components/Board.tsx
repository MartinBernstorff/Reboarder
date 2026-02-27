import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Notice, TFolder } from 'obsidian';
import { Card } from './Card';
import { CustomSnoozeModal } from './CustomSnoozeModal';
import { useLiveQuery } from '@tanstack/react-db';
import ReboarderPlugin from 'src/ReboarderPlugin';
import { type FileRecord, isSnoozed } from 'src/model/FileRecord';
import { type FilePath } from 'src/model/brands';
import { Notes } from 'src/Notes';

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
	const [deleteFile, setDeleteFile] = useState<FileRecord | null>(null);

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

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		// If no card is selected, select the first one on any navigation key
		if (selectedIndex === null) {
			if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Tab'].includes(e.key)) {
				e.preventDefault();
				setSelectedIndex(0);
			}
			return;
		}

		const selected = boardFiles[selectedIndex];

		switch (e.key) {
			case 'ArrowDown':
			case 'ArrowRight':
			case 'Tab':
				if (e.key === 'Tab' && e.shiftKey) break;
				e.preventDefault();
				setSelectedIndex(i => ((i ?? 0) + 1) % boardFiles.length);
				break;
			case 'ArrowUp':
			case 'ArrowLeft':
				e.preventDefault();
				setSelectedIndex(i => ((i ?? 0) - 1 + boardFiles.length) % boardFiles.length);
				break;
			case 'Enter':
				e.preventDefault();
				onOpenNote(selected);
				break;
			case 's':
				e.preventDefault();
				setSnoozeFile(selected);
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
				setDeleteFile(selected);
				break;
		}

		// Handle Shift+Tab
		if (e.key === 'Tab' && e.shiftKey) {
			e.preventDefault();
			setSelectedIndex(i => ((i ?? 0) - 1 + boardFiles.length) % boardFiles.length);
		}
	}, [boardFiles, selectedIndex, onOpenNote, plugin]);

	const closeDeleteModal = useCallback(() => {
		setDeleteFile(null);
		boardRef.current?.focus();
	}, []);

	const handleDeleteConfirm = () => {
		if (deleteFile) {
			plugin.fileCollection.delete(deleteFile.name);
			new Notice(`Deleted ${deleteFile.name}`);
			closeDeleteModal();
		}
	};

	// Escape key handler for delete modal
	useEffect(() => {
		if (!deleteFile) return;
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				closeDeleteModal();
			}
		};
		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [deleteFile, closeDeleteModal]);

	const handleNewClick = async () => {
		Notes.createNew(folder, plugin.fileCollection);
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
					onClose={() => { setSnoozeFile(null); boardRef.current?.focus(); }}
				/>
			)}

			{deleteFile && (
				<div className="reboarder-modal-backdrop">
					<div className="reboarder-modal">
						<h2>Delete Note</h2>
						<div className="reboarder-modal-content">
							<p>Are you sure you want to delete "{deleteFile.name.replace('.md', '')}"?</p>
						</div>
						<div className="reboarder-modal-buttons">
							<button onClick={closeDeleteModal}>Cancel</button>
							<button onClick={handleDeleteConfirm} className="mod-cta">Delete</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
