import React, { useState, useEffect, useCallback } from 'react';
import { TFolder, TFile } from 'obsidian';
import { useApp, usePlugin } from './hooks';
import { Board } from './components/Board';
import { BoardSelector } from './components/BoardSelector';

export const ReboarderView: React.FC<{ selectedBoardPath?: string }> = ({ selectedBoardPath }) => {
  const app = useApp();
  const plugin = usePlugin();
  const [boards, setBoards] = useState<TFolder[]>([]);
  const [currentBoard, setCurrentBoard] = useState<string | undefined>(selectedBoardPath);

  const getFolders = useCallback((): TFolder[] => {
    const folders: TFolder[] = [];
    
    const traverse = (folder: TFolder) => {
      // Skip excluded folders
      if (plugin.settings.excludedFolders.includes(folder.path)) {
        return;
      }
      
      // Add folder if it has notes
      const notes = folder.children.filter(child => child instanceof TFile && child.extension === 'md');
      if (notes.length > 0) {
        folders.push(folder);
      }
      
      // Recursively check subfolders
      folder.children.forEach(child => {
        if (child instanceof TFolder) {
          traverse(child);
        }
      });
    };

    app.vault.getRoot().children.forEach(child => {
      if (child instanceof TFolder) {
        traverse(child);
      }
    });

    return folders;
  }, [app.vault, plugin.settings.excludedFolders]);

  useEffect(() => {
    const folders = getFolders();
    setBoards(folders);
  }, [getFolders]);

  const handleSnoozeNote = async (file: TFile) => {
    await plugin.snoozeNote(file, 0); // 0 triggers incremental logic
    // Refresh boards to reflect changes
    const folders = getFolders();
    setBoards(folders);
  };

  const handleUnpinNote = async (file: TFile) => {
    await plugin.unpinNote(file);
    // Refresh boards to reflect changes
    const folders = getFolders();
    setBoards(folders);
  };

  const handleOpenNote = (file: TFile) => {
    app.workspace.openLinkText(file.path, '');
  };

  const handleSelectBoard = (boardPath: string) => {
    setCurrentBoard(boardPath);
  };

  const handleBackToAll = () => {
    setCurrentBoard(undefined);
  };

  if (currentBoard) {
    const folder = app.vault.getAbstractFileByPath(currentBoard);
    if (folder instanceof TFolder) {
      return (
        <div className="reboarder-container">
          <div className="reboarder-header">
            <button onClick={handleBackToAll} className="reboarder-back-btn">
              ← Back to All Boards
            </button>
            <h2>{folder.name}</h2>
          </div>
          <div className="reboarder-boards">
            <Board
              folder={folder}
              plugin={plugin}
              onSnoozeNote={handleSnoozeNote}
              onUnpinNote={handleUnpinNote}
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
  }

  return (
    <div className="reboarder-container">
      {boards.length === 0 ? (
        <div className="reboarder-empty">
          No folders found. Create some folders to see boards here.
        </div>
      ) : (
        <>
          <BoardSelector boards={boards} onSelectBoard={handleSelectBoard} />
          <div className="reboarder-boards">
            {boards.map((folder) => (
              <Board
                key={folder.path}
                folder={folder}
                plugin={plugin}
                onSnoozeNote={handleSnoozeNote}
                onUnpinNote={handleUnpinNote}
                onOpenNote={handleOpenNote}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
