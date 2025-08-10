import React, { useState } from 'react';
import { TFile } from 'obsidian';
import { usePlugin } from '../hooks';

interface CustomSnoozeModalProps {
  file: TFile;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const CustomSnoozeModal: React.FC<CustomSnoozeModalProps> = ({ 
  file, 
  isOpen, 
  onClose, 
  onComplete 
}) => {
  const plugin = usePlugin();
  const [hours, setHours] = useState(plugin.settings.defaultSnoozeHours);

  const handleSnooze = async () => {
    await plugin.snoozeNote(file, hours);
    onComplete();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="reboarder-modal-backdrop">
      <div className="reboarder-modal">
        <h2>Custom Snooze Duration</h2>
        <div className="reboarder-modal-content">
          <label>
            Hours:
            <input
              type="number"
              value={hours}
              min="1"
              onChange={(e) => setHours(parseInt(e.target.value) || 1)}
              placeholder="Number of hours to snooze this note"
            />
          </label>
        </div>
        <div className="reboarder-modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSnooze} className="mod-cta">
            Snooze
          </button>
        </div>
      </div>
    </div>
  );
};
