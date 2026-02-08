import { Plugin, TFolder, TFile, WorkspaceLeaf } from 'obsidian';
import { ReboarderSettings, DEFAULT_SETTINGS } from 'src/ReboarderSettings';
import { ReboarderSettingTab } from 'src/ReboarderSettingTab';
import { ReboarderView, REBOARDER_VIEW_TYPE } from 'src/ReboarderView';
import { queryClient } from 'src/model/queryClient';
import { createFileCollection } from 'src/model/fileCollection';
import { type FileRecord } from 'src/model/FileRecord';
import { type FilePath, type FileName, type EpochMs, ExpireTimeSchema } from 'src/model/brands';
import {
	getSnoozeEntry,
	setSnoozeEntry,
	clearSnoozeEntry,
	isNoteSnoozed,
} from 'src/snooze/snooze';

export default class ReboarderPlugin extends Plugin {
	settings: ReboarderSettings;
	private registeredFolderPaths: Set<string> = new Set();

	fileCollection = createFileCollection(
		this.app,
		queryClient,
		(file: TFile) => this.getFileRecord(file)
	);

	getFolders(): TFolder[] {
		const folders: TFolder[] = [];

		const traverse = (folder: TFolder) => {
			const notes = folder.children.filter(child => child instanceof TFile && child.extension === 'md');
			if (notes.length > 0) {
				folders.push(folder);
			}

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

		this.registerView(
			REBOARDER_VIEW_TYPE,
			(leaf) => new ReboarderView(leaf, this)
		);

		this.registerBoardCommands();

		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFolder) {
					this.registerBoardCommands();
				} else if (file instanceof TFile && file.extension === 'md') {
					this.registerBoardCommands();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFolder) {
					this.registerBoardCommands();
				} else if (file instanceof TFile && file.extension === 'md') {
					this.registerBoardCommands();
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFolder) {
					this.registerBoardCommands();
				} else if (file instanceof TFile && file.extension === 'md') {
					this.registerBoardCommands();
				}
			})
		);

		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					queryClient.invalidateQueries({ queryKey: ['notes'] });
				}
			})
		);

		this.addSettingTab(new ReboarderSettingTab(this.app, this));
	}

	private registerBoardCommands() {
		const folders = this.getFolders();
		const currentFolderPaths = new Set(folders.map(f => f.path));

		this.registeredFolderPaths.forEach(path => {
			if (!currentFolderPaths.has(path)) {
				this.registeredFolderPaths.delete(path);
			}
		});

		folders.forEach((folder: TFolder) => {
			if (!this.registeredFolderPaths.has(folder.path)) {
				const commandId = `open-reboarder-${folder.name.replace(/\s+/g, '-').toLowerCase()}`;

				this.addCommand({
					id: commandId,
					name: `Open board: ${folder.name}`,
					callback: () => {
						this.activateView(folder.path as FilePath);
					}
				});

				this.registeredFolderPaths.add(folder.path);
			}
		});
	}

	async activateView(selectedBoardPath: FilePath) {
		const { workspace } = this.app;

		console.log('activateView called with selectedBoardPath:', selectedBoardPath);

		const leaf = workspace.getLeaf('tab');

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
		this.registerBoardCommands();
	}

	async snoozeNote(file: FileRecord, hours: number) {
		const expireDate = new Date(Date.now() + (hours * 60 * 60 * 1000));
		const expireTime = ExpireTimeSchema.parse(expireDate);

		this.fileCollection.update(file.name, (draft) => {
			draft.snoozeInfo.expireTime = expireTime;
		});

		const tfile = this.app.vault.getAbstractFileByPath(file.path);
		if (tfile instanceof TFile) {
			await setSnoozeEntry(this.app, tfile, expireTime);
		}
	}

	getSnoozeEntry(file: TFile) {
		return getSnoozeEntry(this.app, file);
	}

	isNoteSnoozed(file: TFile): boolean {
		return isNoteSnoozed(this.app, file);
	}

	getFileRecord(file: TFile): FileRecord {
		const snoozeEntry = getSnoozeEntry(this.app, file);

		return {
			path: file.path as FilePath,
			name: file.name as FileName,
			mtime: file.stat.mtime as EpochMs,
			snoozeInfo: {
				expireTime: snoozeEntry?.expire,
			}
		};
	}

	async openFileInLeaf(file: TFile, leaf: WorkspaceLeaf) {
		await leaf.openFile(file);
	}

	async wakeExpiredSnoozes(folderPath: FilePath) {
		const files = this.app.vault.getFiles().filter(
			f => f.path.startsWith(folderPath + '/') && f.extension === 'md'
		);

		const expiredSnoozes: { file: TFile; expireTime: ExpireTime }[] = [];

		for (const file of files) {
			const snoozeEntry = getSnoozeEntry(this.app, file);
			if (snoozeEntry && snoozeEntry.expire.getTime() < Date.now()) {
				expiredSnoozes.push({ file, expireTime: snoozeEntry.expire });
			}
		}

		expiredSnoozes.sort((a, b) => a.expireTime.getTime() - b.expireTime.getTime());

		for (const { file } of expiredSnoozes) {
			await clearSnoozeEntry(this.app, file);
		}
	}

	onunload() {
		this.registeredFolderPaths.clear();
	}
}
