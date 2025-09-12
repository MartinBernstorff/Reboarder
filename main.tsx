import { 
	App, 
	Plugin, 
	PluginSettingTab, 
	Setting, 
	TFile, 
	TFolder,
	WorkspaceLeaf,
	ItemView,
	Notice,
	ViewStateResult
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
	private registeredFolderPaths: Set<string> = new Set();

	getFolders(): TFolder[] {
		const folders: TFolder[] = [];
		
		const traverse = (folder: TFolder) => {
			// Skip excluded folders
			if (this.settings.excludedFolders.includes(folder.path)) {
				return;
			}
			
			// Add folder if it has notes
			const notes = folder.children.filter(child => child instanceof TFile && child.extension === 'md');
			if (notes.length > 0) {
				folders.push(folder);
			}
			
			// Recursively check subfolders
			folder.children.forEach(child => {
				if (child instanceof TFolder) {
					traverse(child);
				}
			});
		};

		this.app.vault.getRoot().children.forEach(child => {
			if (child instanceof TFolder) {
				traverse(child);
			}
		});

		return folders;
	}

	async onload() {
		await this.loadSettings();
		await this.loadSnoozeData();

		// Register the board view
		this.registerView(
			REBOARDER_VIEW_TYPE,
			(leaf) => new ReboarderView(leaf, this)
		);

		// Register commands for existing folders
		this.registerBoardCommands();

		// Listen for vault events to dynamically update commands
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFolder) {
					this.registerBoardCommands();
				} else if (file instanceof TFile && file.extension === 'md') {
					// A note was created, might make a folder eligible for a board
					this.registerBoardCommands();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFolder) {
					this.registerBoardCommands();
				} else if (file instanceof TFile && file.extension === 'md') {
					// A note was deleted, might make a folder ineligible for a board
					this.registerBoardCommands();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFolder) {
					this.registerBoardCommands();
				} else if (file instanceof TFile && file.extension === 'md') {
					// A note was moved, might affect which folders are eligible for boards
					this.registerBoardCommands();
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new ReboarderSettingTab(this.app, this));
	}

	private registerBoardCommands() {
		// Get current folders
		const folders = this.getFolders();
		const currentFolderPaths = new Set(folders.map(f => f.path));

		// Remove tracked paths for folders that no longer exist or no longer have notes
		this.registeredFolderPaths.forEach(path => {
			if (!currentFolderPaths.has(path)) {
				this.registeredFolderPaths.delete(path);
			}
		});

		// Add commands for new folders
		folders.forEach((folder: TFolder) => {
			if (!this.registeredFolderPaths.has(folder.path)) {
				const commandId = `open-reboarder-${folder.name.replace(/\s+/g, '-').toLowerCase()}`;
				
				this.addCommand({
					id: commandId,
					name: `Open board: ${folder.name}`,
					callback: () => {
						this.activateView(folder.path);
					}
				});
				
				this.registeredFolderPaths.add(folder.path);
			}
		});
	}

	async activateView(selectedBoardPath: string) {
		const { workspace } = this.app;
		
		console.log('activateView called with selectedBoardPath:', selectedBoardPath);
		
		// Always create a new leaf for navigation between boards
		// This ensures each board view has its own navigation history
		const leaf = workspace.getLeaf('tab');
		
		// Set the view state with the selected board path
		await leaf.setViewState({ 
			type: REBOARDER_VIEW_TYPE, 
			active: true,
			state: { selectedBoardPath: selectedBoardPath }
		});
		
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Re-register commands when settings change (excluded folders might have changed)
		this.registerBoardCommands();
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
		new Notice(`${file.name} snoozed for ${nextInterval} hour(s)`);
	}

	async deleteNote(file: TFile) {
		try {
			await this.app.vault.delete(file);
			new Notice(`Note deleted`);
		} catch (error) {
			new Notice(`Error deleting note: ${error.message}`);
		}
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

	async openFileInLeaf(file: TFile, leaf: WorkspaceLeaf) {
		await leaf.openFile(file);
	}

	onunload() {
		// Commands are automatically cleaned up by Obsidian when the plugin unloads
		this.registeredFolderPaths.clear();
	}
}

const REBOARDER_VIEW_TYPE = 'reboarder-view';

class ReboarderView extends ItemView {
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
