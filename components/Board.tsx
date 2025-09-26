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

	const createNewNote = async () => {
		try {
			// Generate a unique file name
			const baseName = 'New Note';
			let fileName = `${baseName}.md`;
			let idx = 1;
			while (plugin.app.vault.getAbstractFileByPath(`${folder.path}/${fileName}`)) {
				fileName = `${baseName} ${idx}.md`;
				idx++;
			}

			const file = await plugin.app.vault.create(`${folder.path}/${fileName}`, ` `);
			// Open newly created note
			onOpenNote(file);
			// Refresh board
			setRefreshKey(prev => prev + 1);
		} catch (e) {
			console.error('Failed to create note', e);
		}
	};

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
			<div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', marginBottom:'8px'}}>
				<h3 className="reboarder-board-title" style={{marginBottom:0}}>{folder.name}</h3>
				<button className="reboarder-new-note-btn" onClick={createNewNote} aria-label="Add new note">+ New</button>
			</div>
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
