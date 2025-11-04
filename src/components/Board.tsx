import React from 'react';
import { TFolder } from 'obsidian';
import { Card } from './Card';
import { useLiveQuery } from '@tanstack/react-db';
import ReboarderPlugin, { FileRecord, isFileRecordSnoozed } from 'app/ReboarderPlugin';

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
	const files = useLiveQuery((q) => q.from({ boards: plugin.fileCollection }))
		.data

	const fileNames = files.map(f => f.name);

	const boardFiles = files
		.filter(it => it.path.contains(folder.path))
		.filter(it => !isFileRecordSnoozed(it))
		.sort((a, b) => b.mtime - a.mtime);


	const createNewNote = async () => {
		try {
			// Generate a unique file name
			const baseName = 'New Note';
			let fileName = `${baseName}.md`;
			let idx = 1;
			while (fileNames.contains(fileName)) {
				fileName = `${baseName} ${idx}.md`;
				idx++;
			}

			await plugin.fileCollection.insert({
				name: fileName,
				mtime: Date.now(),
				path: folder.path + '/' + fileName,
				snoozeInfo: { interval: undefined, expireTime: undefined }
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
								console.log("Attempting to unpin note:", fileRecord);
								console.log("Current path:", fileRecord.path);
								console.log("New path will be:", fileRecord.name);
								const newPath = fileRecord.name;
								try {
									console.log("Calling update with key:", fileRecord.path);
									const result = await plugin.fileCollection.update(fileRecord.name, (draft) => {
										draft.path = newPath;
									});
									console.log("Update completed, result:", result);
								} catch (error) {
									console.error("Error updating file:", error);
								}
							}}
							onOpen={() => onOpenNote(fileRecord)}
							onDelete={async () => await plugin.fileCollection.delete(fileRecord.name)}
						/>
					))
				)}
			</div>
		</div>
	);
};
