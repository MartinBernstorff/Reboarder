import React, { useState, useEffect } from 'react';
import { TFolder, TFile } from 'obsidian';
import ReboarderPlugin from '../main';
import { Card } from './Card';

interface BoardProps {
  folder: TFolder;
  plugin: ReboarderPlugin;
  onSnoozeNote: (file: TFile) => void;
  onUnpinNote: (file: TFile) => void;
  onOpenNote: (file: TFile) => void;
}

export const Board: React.FC<BoardProps> = ({ 
  folder, 
  plugin, 
  onSnoozeNote, 
  onUnpinNote, 
  onOpenNote 
}) => {
  const [notes, setNotes] = useState<TFile[]>([]);

  useEffect(() => {
    // Get notes in folder
    const folderNotes = folder.children.filter(child => 
      child instanceof TFile && 
      child.extension === 'md' &&
      !plugin.isNoteSnoozed(child as TFile)
    ) as TFile[];

    // Sort notes by last modified time (ascending - oldest first)
    folderNotes.sort((a, b) => a.stat.mtime - b.stat.mtime);
    setNotes(folderNotes);
  }, [folder, plugin]);

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
              onSnooze={() => onSnoozeNote(note)}
              onUnpin={() => onUnpinNote(note)}
              onOpen={() => onOpenNote(note)}
            />
          ))
        )}
      </div>
    </div>
  );
};
