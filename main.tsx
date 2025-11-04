import {
	TFile,
	TFolder,
	WorkspaceLeaf,
	ItemView,
	ViewStateResult
} from 'obsidian';
import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';
import { ReboarderView as ReactReboarderView } from 'src/View';
import { AppContext, PluginContext } from 'src/AppContext';
import { QueryClient } from '@tanstack/react-query';
import ReboarderPlugin from 'src/ReboarderPlugin';
import {
	SNOOZE_INTERVAL_KEY,
	SNOOZE_EXPIRE_KEY,
} from 'src/Snooze';
import type {
	LegacySnoozeData,
	FrontmatterMap,
} from 'src/Snooze';


export const queryConfig = {
	queries: {
		refetchOnWindowFocus: true,
		retry: 3,
		staleTime: 1000 * 60 * 60, // 5 minutes
		cacheTime: 1000 * 60 * 60 * 24, // 24 hours
		suspense: false,
		useErrorBoundary: false,
	},
};

export const queryClient = new QueryClient({
	defaultOptions: queryConfig,
});

// Re-export snooze-related types and constants
export type { LegacySnoozeData, FrontmatterMap };
export { SNOOZE_INTERVAL_KEY, SNOOZE_EXPIRE_KEY };

export const REBOARDER_VIEW_TYPE = 'reboarder-view';


export class ReboarderView extends ItemView {
	selectedBoardPath = ''; // Initialize with empty string
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
		// Show the folder name
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
		const typedState = state as { selectedBoardPath?: string };
		if (typedState && typedState.selectedBoardPath) {
			this.selectedBoardPath = typedState.selectedBoardPath;
			console.log('ReboarderView setState: selectedBoardPath set to', this.selectedBoardPath);
			// Re-render the React component with the updated path
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

		// Create a callback to open files in this leaf
		const openFileInCurrentLeaf = (file: TFile) => {
			this.plugin.openFileInLeaf(file, this.leaf);
		};

		// Re-render the React component with the current selectedBoardPath
		this.root.render(
			<StrictMode>
				<AppContext.Provider value={this.app}>
					<PluginContext.Provider value={this.plugin}>
						<ReactReboarderView
							selectedBoardPath={this.selectedBoardPath}
							onOpenFile={openFileInCurrentLeaf}
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

		// Create React root
		this.root = createRoot(container);

		// Render the component (might be with empty selectedBoardPath initially)
		this.renderReactComponent();
	}

	async onClose() {
		this.root?.unmount();
	}
}

export default ReboarderPlugin;

