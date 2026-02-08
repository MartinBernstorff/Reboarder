import React, { useEffect, useRef } from 'react';
import { TFolder } from 'obsidian';
import { Card } from './Card';
import { useLiveQuery } from '@tanstack/react-db';
import ReboarderPlugin from 'src/ReboarderPlugin';
import { type FileRecord, isSnoozed } from 'src/model/FileRecord';
import { type FilePath, type FileName, type EpochMs } from 'src/model/brands';

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

	const fileNames = files.map(f => f.name);

	const boardFiles = files
		.filter(it => it.path.contains(folder.path + "/"))
		.filter(it => !isSnoozed(it))
		.sort((a, b) => b.mtime - a.mtime);


	const createNewNote = async () => {
		try {
			const baseName = 'New Note';
			let fileName = `${baseName}.md`;
			let idx = 1;
			while (fileNames.contains(fileName)) {
				fileName = `${baseName} ${idx}.md`;
				idx++;
			}

			await plugin.fileCollection.insert({
				name: fileName as FileName,
				mtime: Date.now() as EpochMs,
				path: (folder.path + '/' + fileName) as FilePath,
				snoozeInfo: { expireTime: undefined }
			});
		} catch (e) {
			console.error('Failed to create note', e);
		}
	};

	return (
		<div className="reboarder-board">
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
				<h3 className="reboarder-board-title" style={{ marginBottom: 0 }}>{folder.name}</h3>
				<button className="reboarder-new-note-btn" onClick={createNewNote} aria-label="Add new note">+ New</button>
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
							}}
							onOpen={() => onOpenNote(fileRecord)}
							onDelete={()=> plugin.fileCollection.delete(fileRecord.name)}
						/>
					))
				)}
			</div>
		</div>
	);
};
