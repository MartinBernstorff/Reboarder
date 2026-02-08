import React, { useEffect, useRef } from 'react';
import { Notice, TFolder } from 'obsidian';
import { Card } from './Card';
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


	const handleNewClick = async () => {
		Notes.createNewNote(folder, plugin.fileCollection);
	};

	return (
		<div className="reboarder-board">
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
				<h3 className="reboarder-board-title" style={{ marginBottom: 0 }}>{folder.name}</h3>
				<button className="reboarder-new-note-btn" onClick={handleNewClick} aria-label="Add new note">+ New</button>
			</div>
			<div className="reboarder-cards-container">
				{boardFiles.length === 0 ? (
					<div className="reboarder-empty-board">No notes in this folder</div>
				) : (
					boardFiles.map((fileRecord) => (
						<Card
							key={fileRecord.path}
							file={fileRecord}
							plugin={plugin}
							onUnpin={async () => {
								const newPath = fileRecord.name as string as FilePath;
								plugin.fileCollection.update(fileRecord.name, (draft) => {
									draft.path = newPath;
								});
								new Notice(`Unpinned ${fileRecord.name}`);
							}}
							onOpen={() => onOpenNote(fileRecord)}
							onDelete={() => {
								plugin.fileCollection.delete(fileRecord.name);
								new Notice(`Deleted ${fileRecord.name}`);
							}}
						/>
					))
				)}
			</div>
		</div>
	);
};
