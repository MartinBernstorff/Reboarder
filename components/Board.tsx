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

  useEffect(() => {
    updateNotesList();
  }, [folder, plugin, refreshKey]);

  const handleSnoozeNote = async (file: TFile) => {
    await onSnoozeNote(file);
    // Force a re-render by incrementing the refresh key
    setRefreshKey(prev => prev + 1);
  };

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
              onSnooze={() => handleSnoozeNote(note)}
              onUnpin={() => onUnpinNote(note)}
              onOpen={() => onOpenNote(note)}
            />
          ))
        )}
      </div>
    </div>
  );
};
