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

// Legacy (removed) central snooze cache interface retained only for migration
interface LegacySnoozeData {
	[filePath: string]: { interval: number; expire: number };
}
type FrontmatterMap = { [key: string]: string | number | boolean };

const DEFAULT_SETTINGS: ReboarderSettings = {
	snoozeDurations: {
		'2 days': 48,
	},
	defaultSnoozeHours: 24,
	cardPreviewLength: 200,
	excludedFolders: []
};

const SNOOZE_INTERVAL_KEY = 'reboarder_snooze_interval';
const SNOOZE_EXPIRE_KEY = 'reboarder_snooze_expire';

export default class ReboarderPlugin extends Plugin {
	settings: ReboarderSettings;
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
		await this.migrateLegacySnoozeData();

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

	/**
	 * Migration: move legacy central snoozeData store into per-note frontmatter.
	 */
	private async migrateLegacySnoozeData() {
		const data = await this.loadData() as Record<string, unknown> & { snoozeData?: LegacySnoozeData };
		const legacy: LegacySnoozeData | undefined = data?.snoozeData;
		if (!legacy || Object.keys(legacy).length === 0) return;

		for (const [path, entry] of Object.entries(legacy)) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file && file instanceof TFile && file.extension === 'md') {
				// Only write if not already present
				const existing = this.getSnoozeEntry(file);
				if (!existing) {
					await this.setSnoozeEntry(file, entry.interval, entry.expire);
				}
			}
		}
		// Remove legacy data and persist
		delete data.snoozeData;
		await this.saveData(data);
		new Notice('Reboarder: migrated legacy snoozes to note frontmatter');
	}

	/** Read current frontmatter using metadata cache. */
	private getFrontmatter(file: TFile): FrontmatterMap | null {
		const cache = this.app.metadataCache.getFileCache(file);
		return cache?.frontmatter ?? null;
	}

	/** Return snooze entry from a note frontmatter, if present and valid. */
	getSnoozeEntry(file: TFile): { interval: number; expire: number } | null {
		const fm = this.getFrontmatter(file);
		if (!fm) return null;
		const interval = fm[SNOOZE_INTERVAL_KEY];
		const expire = fm[SNOOZE_EXPIRE_KEY];
		if (typeof interval === 'number' && typeof expire === 'number') {
			return { interval, expire };
		}
		return null;
	}

	/** Generic frontmatter edit helper (very lightweight YAML manip). */
	private async editFrontmatter(file: TFile, mutator: (map: FrontmatterMap) => void | boolean) {
		const content = await this.app.vault.read(file);
		let fmStart = -1;
		let fmEnd = -1;
		if (content.startsWith('---')) {
			fmStart = 0;
			fmEnd = content.indexOf('\n---', 3);
			if (fmEnd !== -1) {
				// position right after closing --- line
				const after = content.indexOf('\n', fmEnd + 4);
				if (after !== -1) fmEnd = after + 1; // include newline after closing ---
				else fmEnd = content.length;
			}
		}

		let frontmatterRaw = '';
		if (fmStart === 0 && fmEnd !== -1) {
			// Extract between first '---\n' and the line with only '---'
			const fmBlock = content.slice(0, fmEnd);
			const lines = fmBlock.split('\n');
			lines.shift(); // remove opening ---
			// remove closing --- (last non-empty '---')
			while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
			if (lines.length > 0 && lines[lines.length - 1].trim() === '---') lines.pop();
			frontmatterRaw = lines.join('\n');
		}

		const map: FrontmatterMap = {};
		if (frontmatterRaw) {
			frontmatterRaw.split(/\n/).forEach(line => {
				const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
				if (match) {
					map[match[1]] = isNaN(Number(match[2])) ? match[2] : Number(match[2]);
				}
			});
		}

		mutator(map);

		// Clean out undefined / null
		Object.keys(map).forEach(k => { if (map[k] === undefined || map[k] === null) delete map[k]; });

		// Remove our keys if they are not both present (avoid partial data)
		if (!(SNOOZE_INTERVAL_KEY in map && SNOOZE_EXPIRE_KEY in map)) {
			delete map[SNOOZE_INTERVAL_KEY];
			delete map[SNOOZE_EXPIRE_KEY];
		}

		let newContent: string;
		const keys = Object.keys(map);
		if (keys.length === 0) {
			// Remove frontmatter entirely if it only contained our keys or became empty
			if (fmStart === 0 && fmEnd !== -1) {
				newContent = content.slice(fmEnd); // strip old frontmatter
			} else {
				newContent = content; // nothing to change
			}
		} else {
			const fmSerialized = keys.map(k => `${k}: ${map[k]}`).join('\n');
			const rebuilt = `---\n${fmSerialized}\n---\n`;
			if (fmStart === 0 && fmEnd !== -1) {
				newContent = rebuilt + content.slice(fmEnd);
			} else {
				newContent = rebuilt + content;
			}
		}
		if (newContent !== content) {
			await this.app.vault.modify(file, newContent);
		}
	}

	private async setSnoozeEntry(file: TFile, interval: number, expire: number) {
		await this.editFrontmatter(file, map => {
			map[SNOOZE_INTERVAL_KEY] = interval;
			map[SNOOZE_EXPIRE_KEY] = expire;
		});
	}

	async clearSnoozeEntry(file: TFile) {
		await this.editFrontmatter(file, map => {
			delete map[SNOOZE_INTERVAL_KEY];
			delete map[SNOOZE_EXPIRE_KEY];
		});
	}

	async snoozeNote(file: TFile, hours: number) {
		const now = Date.now();
		let intervalHours: number;
		if (hours && hours > 0) {
			intervalHours = hours; // explicit
		} else {
			const durations = Object.values(this.settings.snoozeDurations).sort((a, b) => a - b);
			let nextIdx = 0;
			const entry = this.getSnoozeEntry(file);
			if (entry && entry.expire > now) {
				const currentIdx = durations.findIndex(d => d === entry.interval);
				nextIdx = currentIdx !== -1 && currentIdx < durations.length - 1 ? currentIdx + 1 : durations.length - 1;
			}
			intervalHours = durations[nextIdx];
		}
		const expireTime = now + (intervalHours * 60 * 60 * 1000);
		await this.setSnoozeEntry(file, intervalHours, expireTime);
		new Notice(`${file.name} snoozed for ${intervalHours} hour(s)`);
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
		const entry = this.getSnoozeEntry(file);
		return !!(entry && Date.now() < entry.expire);
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

			// Snoozed notes (frontmatter) section
			containerEl.createEl('h3', { text: 'Snoozed Notes' });
			containerEl.createEl('p', { text: 'Notes currently snoozed (data stored in each note frontmatter).', cls: 'setting-item-description' });
			const snoozeContainer = containerEl.createEl('div', { cls: 'reboarder-snooze-list' });

			const formatDate = (ts: number) => {
				try { return new Date(ts).toLocaleString(); } catch { return ts.toString(); }
			};

			const refreshSnoozeList = () => {
				snoozeContainer.empty();
				const files = this.app.vault.getMarkdownFiles();
				const entries: { file: TFile; interval: number; expire: number }[] = [];
				files.forEach(f => {
					const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
					if (!fm) return;
					const interval = fm[SNOOZE_INTERVAL_KEY];
					const expire = fm[SNOOZE_EXPIRE_KEY];
					if (typeof interval === 'number' && typeof expire === 'number') {
						entries.push({ file: f, interval, expire });
					}
				});
				if (entries.length === 0) {
					snoozeContainer.createEl('div', { text: 'No snoozed notes' });
					return;
				}
				entries.sort((a, b) => a.expire - b.expire).forEach(entry => {
					const { file, interval, expire } = entry;
					const row = snoozeContainer.createEl('div', { cls: 'reboarder-snooze-row' });
					row.createEl('div', { text: file.basename, cls: 'reboarder-snooze-name' });
					row.createEl('div', { text: file.path, cls: 'reboarder-snooze-path' });
					row.createEl('div', { text: `${interval}h`, cls: 'reboarder-snooze-interval' });
					row.createEl('div', { text: formatDate(expire), cls: 'reboarder-snooze-expire' });
					const status = Date.now() < expire ? 'active' : 'expired';
					row.createEl('div', { text: status, cls: `reboarder-snooze-status status-${status}` });
					const clearBtn = row.createEl('button', { text: 'Clear', cls: 'reboarder-snooze-clear' });
					clearBtn.addEventListener('click', async () => {
						await this.plugin.clearSnoozeEntry(file);
						refreshSnoozeList();
					});
				});
			};

			const expiredBtn = containerEl.createEl('button', { text: 'Remove expired snoozes', cls: 'mod-warning' });
			expiredBtn.addEventListener('click', async () => {
				const now = Date.now();
				const files = this.app.vault.getMarkdownFiles();
				for (const f of files) {
					const entry = this.plugin.getSnoozeEntry(f);
					if (entry && entry.expire <= now) {
						await this.plugin.clearSnoozeEntry(f);
					}
				}
				refreshSnoozeList();
			});

			refreshSnoozeList();
	}
}
