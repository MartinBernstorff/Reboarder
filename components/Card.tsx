import React, { useState, useEffect, useRef } from 'react';
import { TFile, MarkdownRenderer, Component } from 'obsidian';
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
  const [showCustomSnooze, setShowCustomSnooze] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let component: Component | null = null;

    const renderMarkdownPreview = async (file: TFile): Promise<void> => {
      try {
        const content = await app.vault.read(file);
        
        // Truncate content to the specified length for preview
        const maxLength = plugin.settings.cardPreviewLength;
        let truncatedContent = content;

		const truncationSymbol = ' [...]';
        
        if (content.length > maxLength) {
          // Find the last newline before the character limit
          let truncateAt = maxLength;
          while (truncateAt > 0 && content[truncateAt] !== '\n') {
            truncateAt--;
          }
          
          // If we found a newline, truncate there; otherwise fall back to character limit
          if (truncateAt > 0) {
            truncatedContent = content.substring(0, truncateAt).trim() + truncationSymbol;
          } else {
            truncatedContent = content.substring(0, maxLength) + truncationSymbol;
          }
        }
        
        // Create a temporary container for rendering
        if (previewRef.current) {
          previewRef.current.empty();
          
          // Create a temporary component for the markdown rendering
          component = new Component();
          
          // Render the markdown content
          await MarkdownRenderer.renderMarkdown(
            truncatedContent,
            previewRef.current,
            file.path,
            component
          );
        }
      } catch (error) {
        if (previewRef.current) {
          previewRef.current.textContent = 'Error reading file content';
        }
      }
    };

    renderMarkdownPreview(file);

    // Cleanup function
    return () => {
      if (component) {
        component.unload();
      }
    };
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
          <div ref={previewRef} className="markdown-preview-view" />
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
