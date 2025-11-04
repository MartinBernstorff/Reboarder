import React, { useState, useRef, useEffect } from 'react';
import { usePlugin } from 'hooks';
import { FileRecord } from 'src/ReboarderPlugin';

interface CustomSnoozeModalProps {
	file: FileRecord;
	isOpen: boolean;
	onClose: () => void;
}

export const CustomSnoozeModal: React.FC<CustomSnoozeModalProps> = ({ 
	file, 
	isOpen, 
	onClose, 
}) => {
	const plugin = usePlugin();
	const inputRef = useRef<HTMLInputElement>(null);
	// Store days but initialize from default hours (convert hours -> days, rounding up)
	const defaultDays = Math.max(1, Math.ceil(plugin.settings.defaultSnoozeHours / 24));
	const [days, setDays] = useState(defaultDays);

	useEffect(() => {
		if (isOpen && inputRef.current) {
			inputRef.current.select();
		}
	}, [isOpen]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isOpen) return;
			
			if (e.key === 'Enter') {
				e.preventDefault();
				handleSnooze();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				setDays(defaultDays); // Reset to default on cancel
				onClose();
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, days]);

	const handleSnooze = () => {
		const hours = days * 24; // convert days to hours
		plugin.snoozeNote(file, hours);
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="reboarder-modal-backdrop">
			<div className="reboarder-modal">
				<h2>Custom Snooze</h2>
				<div className="reboarder-modal-content">
					<label>
						Days:
						<input
							ref={inputRef}
							type="number"
							value={days}
							min="1"
							onChange={(e) => setDays(parseInt(e.target.value) || 1)}
							placeholder="Number of days to snooze this note"
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
