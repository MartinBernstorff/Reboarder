import React, { useState, useEffect } from 'react';
import { TFolder, TFile } from 'obsidian';
import ReboarderPlugin from '../main';
import { Card } from './Card';

interface BoardProps {
	folder: TFolder;
	plugin: ReboarderPlugin;
	onUnpinNote: (file: TFile) => void;
	onOpenNote: (file: TFile) => void;
	onDeleteNote: (file: TFile) => void;
}

export const Board: React.FC<BoardProps> = ({
	folder,
	plugin,
	onUnpinNote,
	onOpenNote,
	onDeleteNote
}) => {
	const [notes, setNotes] = useState<TFile[]>([]);
	const [refreshKey, setRefreshKey] = useState(0);

	const updateNotesList = () => {
		// Get notes in folder
		const folderNotes = folder.children.filter(child =>
			child instanceof TFile &&
			child.extension === 'md' &&
			!plugin.isNoteSnoozed(child as TFile)
		) as TFile[];

		// Sort notes by last modified time (newest first)
		folderNotes.sort((a, b) => b.stat.mtime - a.stat.mtime);
		setNotes(folderNotes);
	};

	const handleModify = () => {
		setRefreshKey(prev => prev + 1);
	}

	useEffect(() => {
		updateNotesList();
	}, [folder, plugin, refreshKey]);

	return (
		<div className="reboarder-board">
			<h3 className="reboarder-board-title">{folder.name}</h3>
			<div className="reboarder-cards-container">
				{notes.length === 0 ? (
					<div className="reboarder-empty-board">No notes in this folder</div>
				) : (
					notes.map((note) => (
						<Card
							key={note.path}
							file={note}
							plugin={plugin}
							onModify={() => handleModify()}
							onSnooze={() => handleModify()}
							onUnpin={() => onUnpinNote(note)}
							onOpen={() => onOpenNote(note)}
							onDelete={() => onDeleteNote(note)}
						/>
					))
				)}
			</div>
		</div>
	);
};
