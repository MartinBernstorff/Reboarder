import React from 'react';
import { TFolder, TFile } from 'obsidian';
import { useApp, usePlugin } from 'src/hooks';
import { Board } from 'src/components/Board';
import { type FileRecord } from 'src/model/FileRecord';
import { type FilePath } from 'src/model/brands';

export const ReboarderView: React.FC<{
	selectedBoardPath: FilePath;
	onOpenFile: (file: TFile) => void;
}> = ({ selectedBoardPath, onOpenFile }) => {
	const app = useApp();
	const plugin = usePlugin();

	console.log('ReactReboarderView: selectedBoardPath =', selectedBoardPath);

	const handleOpenNote = (file: FileRecord) => {
		if (onOpenFile) {
			const tfile = app.vault.getAbstractFileByPath(file.path)! as TFile;

			if (!tfile) {
				console.error('handleOpenNote: TFile not found for', file.name);
				return;
			}

			onOpenFile(tfile);
		} else {
			app.workspace.openLinkText(file.name, '');
		}
	};

	if (!selectedBoardPath) {
		return (
			<div className="reboarder-container">
				<div className="reboarder-empty">Loading board...</div>
			</div>
		);
	}

	const folder = app.vault.getAbstractFileByPath(selectedBoardPath);
	if (folder instanceof TFolder) {
		return (
			<div className="reboarder-container">
				<div className="reboarder-boards">
					<Board
						folder={folder}
						plugin={plugin}
						onOpenNote={handleOpenNote}
					/>
				</div>
			</div>
		);
	} else {
		return (
			<div className="reboarder-container">
				<div className="reboarder-empty">Board not found.</div>
			</div>
		);
	}
};
