import React, { useEffect, useRef, useCallback } from 'react';
import { TFile, MarkdownRenderer, Component } from 'obsidian';
import ReboarderPlugin from 'src/ReboarderPlugin';
import { type FileRecord } from 'src/model/FileRecord';
import { useApp } from 'src/hooks';

interface CardProps {
	file: FileRecord;
	plugin: ReboarderPlugin;
	isSelected: boolean;
	onOpen: () => void;
}

export const Card: React.FC<CardProps> = ({ file, plugin, isSelected, onOpen }) => {
	const app = useApp();
	const previewRef = useRef<HTMLDivElement>(null);

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

	return (
		<div
			className={`reboarder-card${isSelected ? ' reboarder-card-selected' : ''}`}
			onClick={onOpen}
		>
			<div className="reboarder-card-header">
				<h4>{file.name.replace(".md", "")}</h4>
			</div>
			<div className="reboarder-card-content">
				<div ref={previewRef} className="markdown-preview-view" />
			</div>
		</div>
	);
};
