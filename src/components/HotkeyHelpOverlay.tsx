import React from 'react';
import { getHotkeyDisplayEntries } from './hotkeys';

interface HotkeyHelpOverlayProps {
	onClose: () => void;
}

export const HotkeyHelpOverlay: React.FC<HotkeyHelpOverlayProps> = ({ onClose }) => {
	const entries = getHotkeyDisplayEntries();

	return (
		<div className="reboarder-modal-backdrop" onClick={onClose}>
			<div className="reboarder-modal reboarder-hotkey-help" onClick={(e) => e.stopPropagation()}>
				<h2>Keyboard Shortcuts</h2>
				<table className="reboarder-hotkey-table">
					<tbody>
						{entries.map((entry) => (
							<tr key={entry.display}>
								<td className="reboarder-hotkey-key">
									<kbd>{entry.display}</kbd>
								</td>
								<td className="reboarder-hotkey-label">{entry.label}</td>
							</tr>
						))}
					</tbody>
				</table>
				<div className="reboarder-modal-buttons">
					<button onClick={onClose}>Close</button>
				</div>
			</div>
		</div>
	);
};
