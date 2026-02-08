import React, { useState, useEffect, useRef } from 'react';
import { TFile, MarkdownRenderer, Component } from 'obsidian';
import { AlarmClock, PinOff, Trash2 } from 'lucide-react';
import { CustomSnoozeModal } from './CustomSnoozeModal';
import ReboarderPlugin from 'src/ReboarderPlugin';
import { type FileRecord } from 'src/model/FileRecord';
import { useApp } from 'src/hooks';

interface CardProps {
	file: FileRecord;
	plugin: ReboarderPlugin;
	onUnpin: () => void;
	onOpen: () => void;
	onDelete: () => void;
}

export const Card: React.FC<CardProps> = ({ file, plugin, onUnpin, onOpen, onDelete }) => {
	const app = useApp();
	const [showCustomSnooze, setShowCustomSnooze] = useState(false);
	const previewRef = useRef<HTMLDivElement>(null);
	const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [deleteHolding, setDeleteHolding] = useState(false);

	useEffect(() => {
		let component: Component | null = null;

		const renderMarkdownPreview = async (file: TFile): Promise<void> => {
			try {
				const content = await app.vault.read(file);
				const maxLength = plugin.settings.cardPreviewLength;
				let truncatedContent = content;

				const truncationSymbol = ' [...]';

				if (content.length > maxLength) {
					let truncateAt = maxLength;
					while (truncateAt > 0 && content[truncateAt] !== '\n') {
						truncateAt--;
					}

					if (truncateAt > 0) {
						truncatedContent = content.substring(0, truncateAt).trim() + truncationSymbol;
					} else {
						truncatedContent = content.substring(0, maxLength) + truncationSymbol;
					}
				}

				if (previewRef.current) {
					previewRef.current.empty();

					component = new Component();

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

		const tfile = app.vault.getAbstractFileByPath(file.path)! as TFile;

		if (!tfile) {
			console.error("File not found");
		} else {
			renderMarkdownPreview(tfile);
		}

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

	const handleDeletePointerDown = (e: React.PointerEvent) => {
		e.stopPropagation();
		setDeleteHolding(true);
		deleteTimerRef.current = setTimeout(() => {
			deleteTimerRef.current = null;
			setDeleteHolding(false);
			onDelete();
		}, 500);
	};

	const cancelDelete = (e: React.PointerEvent) => {
		e.stopPropagation();
		setDeleteHolding(false);
		if (deleteTimerRef.current) {
			clearTimeout(deleteTimerRef.current);
			deleteTimerRef.current = null;
		}
	};

	return (
		<>
			<div className="reboarder-card" onClick={onOpen}>
				<button
					onClick={(e) => {
						e.stopPropagation();
						onUnpin();
					}}
					className="reboarder-fab reboarder-fab-unpin"
					title="Unpin"
				>
					<PinOff size={14} />
				</button>
				<div className="reboarder-card-header">
					<h4>{file.name.replace(".md", "")}</h4>
				</div>
				<div className="reboarder-card-content">
					<div ref={previewRef} className="markdown-preview-view" />
				</div>
				<button
					onPointerDown={handleDeletePointerDown}
					onPointerUp={cancelDelete}
					onPointerLeave={cancelDelete}
					onClick={(e) => e.stopPropagation()}
					className={`reboarder-fab reboarder-fab-delete${deleteHolding ? ' reboarder-fab-delete-holding' : ''}`}
					title="Hold to delete"
				>
					<Trash2 size={14} />
				</button>
				<button
					onClick={handleSnoozeClick}
					className="reboarder-fab reboarder-fab-snooze"
					title="Snooze"
				>
					<AlarmClock size={14} />
				</button>
			</div>

			<CustomSnoozeModal
				file={file}
				isOpen={showCustomSnooze}
				onClose={() => setShowCustomSnooze(false)}
			/>
		</>
	);
};
