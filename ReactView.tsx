import React from 'react';
import { TFolder, TFile } from 'obsidian';
import { useApp, usePlugin } from './hooks';
import { Board } from './components/Board';

export const ReboarderView: React.FC<{ 
  selectedBoardPath: string; // Must always be a specific board
  onOpenFile?: (file: TFile) => void;
}> = ({ selectedBoardPath, onOpenFile }) => {
  const app = useApp();
  const plugin = usePlugin();

  console.log('ReactReboarderView: selectedBoardPath =', selectedBoardPath);

  const handleDeleteNote = async (file: TFile) => {
	await plugin.deleteNote(file);
  }

  const handleUnpinNote = async (file: TFile) => {
    await plugin.unpinNote(file);
  };

  const handleOpenNote = (file: TFile) => {
    if (onOpenFile) {
      onOpenFile(file);
    } else {
      app.workspace.openLinkText(file.path, '');
    }
  };

  // Don't render if no board path is set
  if (!selectedBoardPath) {
    return (
      <div className="reboarder-container">
        <div className="reboarder-empty">Loading board...</div>
      </div>
    );
  }

  // Always show the specific board
  const folder = app.vault.getAbstractFileByPath(selectedBoardPath);
  if (folder instanceof TFolder) {
    return (
      <div className="reboarder-container">
        <div className="reboarder-boards">
          <Board
            folder={folder}
            plugin={plugin}
            onUnpinNote={handleUnpinNote}
            onOpenNote={handleOpenNote}
			onDeleteNote={handleDeleteNote}
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
