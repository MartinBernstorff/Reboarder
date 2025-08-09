import { 
	App, 
	Plugin, 
	PluginSettingTab, 
	Setting, 
	TFile, 
	TFolder,
	WorkspaceLeaf,
	ItemView,
	Menu,
	Notice,
	Modal
} from 'obsidian';

interface ReboarderSettings {
	snoozeDurations: { [key: string]: number };
	defaultSnoozeHours: number;
	cardPreviewLength: number;
	excludedFolders: string[];
}

interface SnoozeData {
	[filePath: string]: number; // timestamp when snooze expires
}

const DEFAULT_SETTINGS: ReboarderSettings = {
	snoozeDurations: {
		'1 hour': 1,
		'4 hours': 4,
		'1 day': 24,
		'3 days': 72,
		'1 weeks': 168
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

		// Add one command per board
		const folders = ReboarderView.prototype.getFolders.call({plugin: this, app: this.app});
		folders.forEach((folder: TFolder) => {
			this.addCommand({
				id: `open-reboarder-${folder.name.replace(/\s+/g, '-').toLowerCase()}`,
				name: `Open board: ${folder.name}`,
				callback: () => {
					this.activateView(folder.path);
				}
			});
		});

		// Add settings tab
		this.addSettingTab(new ReboarderSettingTab(this.app, this));

		// Clean up expired snoozes periodically
		this.registerInterval(
			window.setInterval(() => this.cleanupExpiredSnoozes(), 60000) // Check every minute
		);
	}

	async activateView(selectedBoardPath?: string) {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(REBOARDER_VIEW_TYPE);
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: REBOARDER_VIEW_TYPE, active: true });
		}
		if (leaf) {
			workspace.revealLeaf(leaf);
			// Pass selected board path to the view
			if (selectedBoardPath && leaf.view instanceof ReboarderView) {
				leaf.view.showBoard(selectedBoardPath);
			} else if (selectedBoardPath) {
				// If view not ready, store for later
				(leaf as any).reboarderSelectedBoardPath = selectedBoardPath;
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
		const expireTime = Date.now() + (hours * 60 * 60 * 1000);
		this.snoozeData[file.path] = expireTime;
		await this.saveSnoozeData();
		new Notice(`Note snoozed for ${hours} hour(s)`);
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
		const snoozeTime = this.snoozeData[file.path];
		if (!snoozeTime) return false;
		return Date.now() < snoozeTime;
	}

	cleanupExpiredSnoozes() {
		const now = Date.now();
		let hasChanges = false;
		
		for (const [path, expireTime] of Object.entries(this.snoozeData)) {
			if (now >= expireTime) {
				delete this.snoozeData[path];
				hasChanges = true;
			}
		}
		
		if (hasChanges) {
			this.saveSnoozeData();
		}
	}

	onunload() {
		// Cleanup
	}
}

const REBOARDER_VIEW_TYPE = 'reboarder-view';

class ReboarderView extends ItemView {
	selectedBoardPath?: string;
	plugin: ReboarderPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: ReboarderPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return REBOARDER_VIEW_TYPE;
	}

	getDisplayText() {
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
		const leaf = this.leaf as WorkspaceLeaf & { reboarderSelectedBoardPath?: string };
		if (leaf && leaf.reboarderSelectedBoardPath) {
			this.selectedBoardPath = leaf.reboarderSelectedBoardPath;
			delete leaf.reboarderSelectedBoardPath;
		}
		if (this.selectedBoardPath) {
			await this.renderBoardOnly(this.selectedBoardPath);
		} else {
			await this.renderBoards();
		}
	}

	async showBoard(boardPath: string) {
		this.selectedBoardPath = boardPath;
		await this.onOpen();
	}

	async renderBoardOnly(boardPath: string) {
		const container = this.containerEl.children[1];
		container.empty();
		const folder = this.plugin.app.vault.getAbstractFileByPath(boardPath);
		if (folder instanceof TFolder) {
			const boardsContainer = container.createDiv('reboarder-boards');
			await this.renderBoard(boardsContainer, folder);
		} else {
			container.createDiv('reboarder-empty').setText('Board not found.');
		}
	}

	async renderBoards() {
		const container = this.containerEl.children[1];
		container.empty();

		const boardsContainer = container.createDiv('reboarder-boards');

		// Get all folders in the vault
		const folders = this.getFolders();

		for (const folder of folders) {
			await this.renderBoard(boardsContainer, folder);
		}

		if (folders.length === 0) {
			boardsContainer.createDiv('reboarder-empty').setText('No folders found. Create some folders to see boards here.');
		}
	}

	getFolders(): TFolder[] {
		const folders: TFolder[] = [];
		
		const traverse = (folder: TFolder) => {
			// Skip excluded folders
			if (this.plugin.settings.excludedFolders.includes(folder.path)) {
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

	async renderBoard(container: HTMLElement, folder: TFolder) {
		const boardEl = container.createDiv('reboarder-board');
		
		const headerEl = boardEl.createDiv('reboarder-board-header');
		headerEl.createEl('h3', { text: folder.name });
		
		const cardsContainer = boardEl.createDiv('reboarder-cards-container');
		
		// Get notes in folder
		const notes = folder.children.filter(child => 
			child instanceof TFile && 
			child.extension === 'md' &&
			!this.plugin.isNoteSnoozed(child as TFile)
		) as TFile[];

		for (const note of notes) {
			await this.renderCard(cardsContainer, note);
		}

		if (notes.length === 0) {
			cardsContainer.createDiv('reboarder-empty-board').setText('No notes in this folder');
		}
	}

	async renderCard(container: HTMLElement, file: TFile) {
		const cardEl = container.createDiv('reboarder-card');
		
		// Card header with title
		const headerEl = cardEl.createDiv('reboarder-card-header');
		const titleEl = headerEl.createEl('h4', { text: file.basename });
		
		// Card content preview
		const contentEl = cardEl.createDiv('reboarder-card-content');
		const preview = await this.getFilePreview(file);
		contentEl.setText(preview);
		
		// Card actions
		const actionsEl = cardEl.createDiv('reboarder-card-actions');
		
		const snoozeBtn = actionsEl.createEl('button', { text: 'Snooze', cls: 'reboarder-btn reboarder-btn-snooze' });
		const unpinBtn = actionsEl.createEl('button', { text: 'Unpin', cls: 'reboarder-btn reboarder-btn-unpin' });
		
		// Event listeners
		cardEl.addEventListener('click', (e) => {
			// Only open if clicking on the card itself, not buttons
			if (e.target === cardEl || e.target === titleEl || e.target === contentEl) {
				this.app.workspace.openLinkText(file.path, '');
			}
		});

		snoozeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.showSnoozeMenu(snoozeBtn, file);
		});

		unpinBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			await this.plugin.unpinNote(file);
			this.renderBoards(); // Refresh the view
		});
	}

	async getFilePreview(file: TFile): Promise<string> {
		try {
			const content = await this.app.vault.read(file);
			// Remove markdown syntax and limit length
			const cleanContent = content
				.replace(/^#+\s*/gm, '') // Remove headers
				.replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
				.replace(/\*(.*?)\*/g, '$1') // Remove italic
				.replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
				.replace(/`(.*?)`/g, '$1') // Remove inline code
				.trim();
			
			const maxLength = this.plugin.settings.cardPreviewLength;
			return cleanContent.length > maxLength 
				? cleanContent.substring(0, maxLength) + '...'
				: cleanContent;
		} catch (error) {
			return 'Error reading file content';
		}
	}

	showSnoozeMenu(buttonEl: HTMLElement, file: TFile) {
		const menu = new Menu();
		
		Object.entries(this.plugin.settings.snoozeDurations).forEach(([label, hours]) => {
			menu.addItem((item) => {
				item.setTitle(label)
					.onClick(async () => {
						await this.plugin.snoozeNote(file, hours);
						this.renderBoards(); // Refresh the view
					});
			});
		});

		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle('Custom...')
				.onClick(() => {
					new CustomSnoozeModal(this.app, this.plugin, file, () => {
						this.renderBoards();
					}).open();
				});
		});

		const rect = buttonEl.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	}

	async onClose() {
		// Cleanup when view is closed
	}
}

class CustomSnoozeModal extends Modal {
	plugin: ReboarderPlugin;
	file: TFile;
	onComplete: () => void;

	constructor(app: App, plugin: ReboarderPlugin, file: TFile, onComplete: () => void) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.onComplete = onComplete;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Custom Snooze Duration' });

		const container = contentEl.createDiv();
		
		let hours = this.plugin.settings.defaultSnoozeHours;
		
		new Setting(container)
			.setName('Hours')
			.setDesc('Number of hours to snooze this note')
			.addText(text => {
				text.setValue(hours.toString())
					.onChange((value) => {
						const parsed = parseInt(value);
						if (!isNaN(parsed) && parsed > 0) {
							hours = parsed;
						}
					});
			});

		const buttonContainer = contentEl.createDiv('reboarder-modal-buttons');
		
		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		const snoozeBtn = buttonContainer.createEl('button', { text: 'Snooze', cls: 'mod-cta' });
		
		cancelBtn.addEventListener('click', () => {
			this.close();
		});
		
		snoozeBtn.addEventListener('click', async () => {
			await this.plugin.snoozeNote(this.file, hours);
			this.onComplete();
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
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
