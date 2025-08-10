import React, { useState, useEffect } from 'react';
import { TFile } from 'obsidian';
import ReboarderPlugin from '../main';
import { useApp } from '../hooks';
import { CustomSnoozeModal } from './CustomSnoozeModal';

interface CardProps {
  file: TFile;
  plugin: ReboarderPlugin;
  onSnooze: () => void;
  onUnpin: () => void;
  onOpen: () => void;
}

export const Card: React.FC<CardProps> = ({ file, plugin, onSnooze, onUnpin, onOpen }) => {
  const app = useApp();
  const [preview, setPreview] = useState<string>('');
  const [showCustomSnooze, setShowCustomSnooze] = useState(false);

  useEffect(() => {
    const getFilePreview = async (file: TFile): Promise<string> => {
      try {
        const content = await app.vault.read(file);
        // Remove markdown syntax and limit length
        const cleanContent = content
          .replace(/^#+\s*/gm, '') // Remove headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
          .replace(/`(.*?)`/g, '$1') // Remove inline code
          .trim();
        
        const maxLength = plugin.settings.cardPreviewLength;
        return cleanContent.length > maxLength 
          ? cleanContent.substring(0, maxLength) + '...'
          : cleanContent;
      } catch (error) {
        return 'Error reading file content';
      }
    };

    getFilePreview(file).then(setPreview);
  }, [file, app.vault, plugin.settings.cardPreviewLength]);

  const handleSnoozeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // For now, just use the incremental snooze. 
    // Could add right-click menu for custom snooze later
    onSnooze();
  };

  return (
    <>
      <div className="reboarder-card" onClick={onOpen}>
        <div className="reboarder-card-header">
          <h4>{file.basename}</h4>
        </div>
        <div className="reboarder-card-content">
          <p>{preview}</p>
        </div>
        <div className="reboarder-card-actions">
          <button
            onClick={handleSnoozeClick}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowCustomSnooze(true);
            }}
            className="reboarder-btn reboarder-btn-snooze"
            title="Left-click for incremental snooze, right-click for custom duration"
          >
            Snooze
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnpin();
            }}
            className="reboarder-btn reboarder-btn-unpin"
          >
            Unpin
          </button>
        </div>
      </div>
      
      <CustomSnoozeModal
        file={file}
        isOpen={showCustomSnooze}
        onClose={() => setShowCustomSnooze(false)}
        onComplete={onSnooze}
      />
    </>
  );
};
