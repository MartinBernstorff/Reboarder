import { 
	App, 
	Plugin, 
	PluginSettingTab, 
	Setting, 
	TFile, 
	WorkspaceLeaf,
	ItemView,
	Notice
} from 'obsidian';
import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';
import { ReboarderView as ReactReboarderView } from './ReactView';
import { AppContext, PluginContext } from './context';

interface ReboarderSettings {
	snoozeDurations: { [key: string]: number };
	defaultSnoozeHours: number;
	cardPreviewLength: number;
	excludedFolders: string[];
}

interface SnoozeData {
	[filePath: string]: { interval: number; expire: number }; // interval in hours, expiration timestamp
}

interface ExtendedWorkspaceLeaf extends WorkspaceLeaf {
	reboarderSelectedBoardPath?: string;
}

const DEFAULT_SETTINGS: ReboarderSettings = {
	snoozeDurations: {
		'2 days': 48,
	},
	defaultSnoozeHours: 24,
	cardPreviewLength: 200,
	excludedFolders: []
};

export default class ReboarderPlugin extends Plugin {
	settings: ReboarderSettings;
	snoozeData: SnoozeData = {};

	async onload() {
		await this.loadSettings();
		await this.loadSnoozeData();

		// Register the board view
		this.registerView(
			REBOARDER_VIEW_TYPE,
			(leaf) => new ReboarderView(leaf, this)
		);

		// Add ribbon icon
		this.addRibbonIcon('kanban-square', 'Open Reboarder', () => {
			this.activateView();
		});

		// Add one command per board - we'll do this dynamically for now
		// const folders = this.getFolders();
		// folders.forEach((folder: TFolder) => {
		// 	this.addCommand({
		// 		id: `open-reboarder-${folder.name.replace(/\s+/g, '-').toLowerCase()}`,
		// 		name: `Open board: ${folder.name}`,
		// 		callback: () => {
		// 			this.activateView(folder.path);
		// 		}
		// 	});
		// });

		// Add settings tab
		this.addSettingTab(new ReboarderSettingTab(this.app, this));
	}

	async activateView(selectedBoardPath?: string) {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(REBOARDER_VIEW_TYPE);
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf('tab');
			await leaf?.setViewState({ type: REBOARDER_VIEW_TYPE, active: true });
		}
		if (leaf) {
			workspace.revealLeaf(leaf);
			// Pass selected board path to the view
			if (selectedBoardPath && leaf.view instanceof ReboarderView) {
				leaf.view.showBoard(selectedBoardPath);
			} else if (selectedBoardPath) {
				// If view not ready, store for later
				(leaf as ExtendedWorkspaceLeaf).reboarderSelectedBoardPath = selectedBoardPath;
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadSnoozeData() {
		const data = await this.loadData();
		this.snoozeData = data?.snoozeData || {};
	}

	async saveSnoozeData() {
		const currentData = await this.loadData();
		await this.saveData({ ...currentData, snoozeData: this.snoozeData });
	}

	async snoozeNote(file: TFile, hours: number) {
		// Get all snooze durations sorted by value
		const durations = Object.values(this.settings.snoozeDurations).sort((a, b) => a - b);
		let nextIdx = 0;
		const now = Date.now();
		const entry = this.snoozeData[file.path];
		if (entry && entry.expire > now) {
			// Find current interval index
			const currentIdx = durations.findIndex(d => d === entry.interval);
			nextIdx = currentIdx !== -1 && currentIdx < durations.length - 1 ? currentIdx + 1 : durations.length - 1;
		}
		const nextInterval = durations[nextIdx];
		const expireTime = now + (nextInterval * 60 * 60 * 1000);
		this.snoozeData[file.path] = { interval: nextInterval, expire: expireTime };
		await this.saveSnoozeData();
		new Notice(`Note snoozed for ${nextInterval} hour(s)`);
	}

	async unpinNote(file: TFile) {
		const newPath = file.name;
		try {
			await this.app.fileManager.renameFile(file, newPath);
			new Notice(`Note moved to vault root`);
		} catch (error) {
			new Notice(`Error moving note: ${error.message}`);
		}
	}

	isNoteSnoozed(file: TFile): boolean {
	const entry = this.snoozeData[file.path];
	if (!entry) return false;
	return Date.now() < entry.expire;
	}

	onunload() {
		// Cleanup
	}
}

const REBOARDER_VIEW_TYPE = 'reboarder-view';

class ReboarderView extends ItemView {
	selectedBoardPath?: string;
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
		// If a board is selected, use its folder name
		if (this.selectedBoardPath) {
			return this.selectedBoardPath
		}
		return 'Reboarder';
	}

	getIcon() {
		return 'kanban-square';
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('reboarder-container');
		
		// Check if a board path was passed
		const leaf = this.leaf as ExtendedWorkspaceLeaf;
		if (leaf && leaf.reboarderSelectedBoardPath) {
			this.selectedBoardPath = leaf.reboarderSelectedBoardPath;
			delete leaf.reboarderSelectedBoardPath;
		}

		// Create React root and render the component
		this.root = createRoot(container);
		this.root.render(
			<StrictMode>
				<AppContext.Provider value={this.app}>
					<PluginContext.Provider value={this.plugin}>
						<ReactReboarderView selectedBoardPath={this.selectedBoardPath} />
					</PluginContext.Provider>
				</AppContext.Provider>
			</StrictMode>
		);
	}

	async showBoard(boardPath: string) {
		this.selectedBoardPath = boardPath;
		// Force tab title update by resetting view state
		this.leaf.setViewState({ type: REBOARDER_VIEW_TYPE, active: true, state: { selectedBoardPath: boardPath } }, { focus: true });
		await this.onOpen();
	}

	async onClose() {
		this.root?.unmount();
	}
}

class ReboarderSettingTab extends PluginSettingTab {
	plugin: ReboarderPlugin;

	constructor(app: App, plugin: ReboarderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Card preview length')
			.setDesc('Maximum number of characters to show in card previews')
			.addText(text => text
				.setPlaceholder('200')
				.setValue(this.plugin.settings.cardPreviewLength.toString())
				.onChange(async (value) => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.settings.cardPreviewLength = parsed;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Default snooze duration')
			.setDesc('Default number of hours for custom snooze')
			.addText(text => text
				.setPlaceholder('24')
				.setValue(this.plugin.settings.defaultSnoozeHours.toString())
				.onChange(async (value) => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.settings.defaultSnoozeHours = parsed;
						await this.plugin.saveSettings();
					}
				}));

		containerEl.createEl('h3', { text: 'Excluded Folders' });
		containerEl.createEl('p', { 
			text: 'Folders to exclude from boards (one per line)', 
			cls: 'setting-item-description' 
		});

		const excludedFoldersEl = containerEl.createEl('textarea', {
			placeholder: 'Enter folder paths, one per line',
			cls: 'reboarder-excluded-folders'
		});
		excludedFoldersEl.value = this.plugin.settings.excludedFolders.join('\n');
		excludedFoldersEl.addEventListener('blur', async () => {
			const lines = excludedFoldersEl.value.split('\n').map(line => line.trim()).filter(line => line);
			this.plugin.settings.excludedFolders = lines;
			await this.plugin.saveSettings();
		});
	}
}
