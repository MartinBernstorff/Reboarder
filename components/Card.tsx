import React, { useState, useEffect, useRef } from 'react';
import { TFile, MarkdownRenderer, Component } from 'obsidian';
import ReboarderPlugin from '../main';
import { useApp } from '../hooks';
import { CustomSnoozeModal } from './CustomSnoozeModal';

interface CardProps {
	file: TFile;
	plugin: ReboarderPlugin;
	onModify: () => void;
	onSnooze: () => void;
	onUnpin: () => void;
	onOpen: () => void;
	onDelete: () => void; // Optional delete handler
}

export const Card: React.FC<CardProps> = ({ file, plugin, onModify, onSnooze, onUnpin, onOpen, onDelete }) => {
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
		setShowCustomSnooze(true);
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
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
							onModify();
						}}
						className="reboarder-btn reboarder-btn-delete"
					>
						Delete
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onUnpin();
							onModify();
						}}
						className="reboarder-btn reboarder-btn-unpin"
					>
						Unpin
					</button>
					<button
						onClick={handleSnoozeClick}
						className="reboarder-btn"
						title="Set a custom snooze duration (in days)"
					>
						Snooze
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
