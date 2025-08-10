import React from 'react';
import { TFolder } from 'obsidian';

interface BoardSelectorProps {
  boards: TFolder[];
  onSelectBoard: (boardPath: string) => void;
}

export const BoardSelector: React.FC<BoardSelectorProps> = ({ boards, onSelectBoard }) => {
  return (
    <div className="reboarder-board-selector">
      <h3>Select a Board</h3>
      <div className="reboarder-board-list">
        {boards.map((folder) => (
          <button
            key={folder.path}
            onClick={() => onSelectBoard(folder.path)}
            className="reboarder-board-button"
          >
            {folder.name}
          </button>
        ))}
      </div>
    </div>
  );
};
