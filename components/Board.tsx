import React, { useState, useEffect } from 'react';
import { TFolder, TFile, Notice } from 'obsidian';
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

  const handleCreateNote = async () => {
    try {
      // Build a unique file name like "Untitled.md", "Untitled 1.md", ...
      const existing = new Set(
        folder.children
          .filter((c): c is TFile => c instanceof TFile)
          .map((f) => f.name)
      );
      const base = 'Untitled';
      let name = `${base}.md`;
      let i = 1;
      while (existing.has(name)) {
        name = `${base} ${i}.md`;
        i++;
      }

  const basePath = folder.path === '/' ? '' : folder.path;
  const path = basePath ? `${basePath}/${name}` : name;
      const file = await plugin.app.vault.create(path, '');
      new Notice(`Created: ${file.basename}`);
      // Refresh list and open the newly created file
      setRefreshKey((prev) => prev + 1);
      onOpenNote(file);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      new Notice(`Failed to create note: ${message}`);
      console.error('Reboarder create note error', err);
    }
  };

  return (
    <div className="reboarder-board">
      <div className="reboarder-board-header">
        <h3 className="reboarder-board-title">{folder.name}</h3>
        <button className="reboarder-new-note-btn" onClick={handleCreateNote} aria-label="Create new note">
          New note
        </button>
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
