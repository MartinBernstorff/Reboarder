import {
	TFolder,
	WorkspaceLeaf,
	ItemView,
	ViewStateResult
} from 'obsidian';
import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';
import { ReboarderView as ReactReboarderView } from 'src/View';
import { AppContext, PluginContext } from 'src/hooks';
import type ReboarderPlugin from 'src/ReboarderPlugin';
import { type FilePath } from 'src/model/brands';
import { Workspace } from './Workspace';

export const REBOARDER_VIEW_TYPE = 'reboarder-view';

export class ReboarderView extends ItemView {
	selectedBoardPath = '' as FilePath;
	plugin: ReboarderPlugin;
	root: Root | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: ReboarderPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return REBOARDER_VIEW_TYPE;
	}

	getDisplayText() {
		const folder = this.app.vault.getAbstractFileByPath(this.selectedBoardPath);
		if (folder instanceof TFolder) {
			return `Board: ${folder.name}`;
		}
		return 'Reboarder';
	}

	getIcon() {
		return 'kanban-square';
	}

	getState() {
		return {
			selectedBoardPath: this.selectedBoardPath
		};
	}

	async setState(state: unknown, result: ViewStateResult) {
		const typedState = state as { selectedBoardPath?: FilePath };
		if (typedState && typedState.selectedBoardPath) {
			this.selectedBoardPath = typedState.selectedBoardPath;
			console.log('ReboarderView setState: selectedBoardPath set to', this.selectedBoardPath);
			if (this.root) {
				this.renderReactComponent();
			}
		} else {
			console.log('ReboarderView setState: No selectedBoardPath in state', state);
		}
		return super.setState(state, result);
	}

	renderReactComponent() {
		if (!this.root) return;

		this.root.render(
			<StrictMode>
				<AppContext.Provider value={this.app}>
					<PluginContext.Provider value={this.plugin}>
						<ReactReboarderView
							selectedBoardPath={this.selectedBoardPath}
							onOpenFile={
								(file) => Workspace.openAndFocusFile(file, this.app)
							}
						/>
					</PluginContext.Provider>
				</AppContext.Provider>
			</StrictMode>
		);
	}

	async onOpen() {
		console.log('ReboarderView onOpen called, selectedBoardPath:', this.selectedBoardPath);

		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('reboarder-container');

		this.root = createRoot(container);
		this.renderReactComponent();
	}

	async onClose() {
		this.root?.unmount();
	}
}
