import { Plugin, TFolder, TFile, WorkspaceLeaf } from 'obsidian';
import { ReboarderSettings, DEFAULT_SETTINGS } from 'src/ReboarderSettings';
import { ReboarderSettingTab } from 'src/ReboarderSettingTab';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/react-db';
import { ReboarderView, queryClient, REBOARDER_VIEW_TYPE } from '../main';
import { z } from 'zod';
import {
	getSnoozeEntry,
	setSnoozeEntry,
	clearSnoozeEntry,
	isNoteSnoozed,
	toISODateTime,
	parseISODateTime
} from './Snooze';

const ExpireTimeSchema = z.iso.datetime().brand('ExpireTime');
export type ExpireTime = z.infer<typeof ExpireTimeSchema>;

const SnoozeInfoSchema = z.object({
	interval: z.number().optional(),
	expireTime: ExpireTimeSchema.optional(),
});


export const FileRecordSchema = z.object({
	path: z.string(),
	name: z.string(),
	mtime: z.number(),
	snoozeInfo: SnoozeInfoSchema,
});

export type FileRecord = z.infer<typeof FileRecordSchema>;

export function isSnoozed(record: FileRecord): boolean {
	return !!(record.snoozeInfo.expireTime && Date.now() < parseISODateTime(record.snoozeInfo.expireTime).getTime());
}

export function getFileRecordRemainingHours(record: FileRecord): number | undefined {
	if (!record.snoozeInfo.expireTime || !isSnoozed(record)) {
		return undefined;
	}
	const remainingMs = parseISODateTime(record.snoozeInfo.expireTime).getTime() - Date.now();
	return Math.ceil(remainingMs / (60 * 60 * 1000));
}


export default class ReboarderPlugin extends Plugin {
	settings: ReboarderSettings;
	private registeredFolderPaths: Set<string> = new Set();

	fileCollection = createCollection(
		queryCollectionOptions({
			queryKey: ['notes'],
			queryFn: async () => {
				const files = this.app.vault.getFiles();
				const fileRecords = files.map(file => this.getFileRecord(file));
				console.log(fileRecords);
				return fileRecords;
			},
			queryClient: queryClient,
			getKey: (item) => {
				return item.name;
			},
			onUpdate: async ({ transaction }) => {
				const { original, modified } = transaction.mutations[0];
				console.log("Updating file record:", original, "->", modified);

				// Get the current file from the vault
				const currentFile = this.app.vault.getAbstractFileByPath(original.path);
				if (!currentFile || !(currentFile instanceof TFile)) {
					console.error("File to update not found:", original.path);
					return;
				}

				// Only rename if the path has actually changed
				if (original.path !== modified.path) {
					await this.app.fileManager.renameFile(currentFile, modified.path);
				}

				// Update snooze information if it has changed
				const snoozeChanged =
					original.snoozeInfo.interval !== modified.snoozeInfo.interval ||
					original.snoozeInfo.expireTime !== modified.snoozeInfo.expireTime;

				if (snoozeChanged) {
					// Get the file after potential rename - use modified.path since the file may have been renamed
					const targetFile = this.app.vault.getAbstractFileByPath(modified.path) as TFile

					if (!targetFile) {
						console.error("File to update snooze info not found:", modified.path);
						return;
					}

					if (modified.snoozeInfo.interval && modified.snoozeInfo.expireTime) {
						// Set new snooze information
						await setSnoozeEntry(this.app, targetFile, modified.snoozeInfo.interval, modified.snoozeInfo.expireTime);
					} else {
						// Clear snooze information
						await clearSnoozeEntry(this.app, targetFile);
					}
				}
			},
			onInsert: async ({ transaction }) => {
				const newItem = transaction.mutations[0].modified;
				await this.app.vault.create(newItem.path, "");
				await setSnoozeEntry(
					this.app,
					this.app.vault.getAbstractFileByPath(newItem.path) as TFile,
					newItem.snoozeInfo.interval!,
					newItem.snoozeInfo.expireTime!
				);
			},
			onDelete: async ({ transaction }) => {
				const mutation = transaction.mutations[0];
				const file = this.app.vault.getAbstractFileByPath(mutation.original.path);
				if (file) {
					await this.app.vault.trash(file, false);
					console.log("Deleted file:", mutation.original.path);
				}
			},
		})
	);

	getFolders(): TFolder[] {
		const folders: TFolder[] = [];

		const traverse = (folder: TFolder) => {
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
		// Load settings first before anything else uses them
		await this.loadSettings();

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

		// Listen for metadata changes to update the file collection
		// This is important for snooze changes and other frontmatter updates
		this.registerEvent(
			this.app.metadataCache.on('changed', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					// Invalidate the collection query to trigger a re-fetch
					queryClient.invalidateQueries({ queryKey: ['notes'] });
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

	snoozeNote(file: FileRecord, hours: number) {
		// Update the file record in the collection with new snooze info
		const expireDate = new Date(Date.now() + (hours * 60 * 60 * 1000));
		this.fileCollection.update(file.name,
			(draft) => {
				draft.snoozeInfo.interval = hours
				draft.snoozeInfo.expireTime = toISODateTime(expireDate)
			}
		);
	}

	getSnoozeEntry(file: TFile): { interval: number; expire: ExpireTime; } | null {
		return getSnoozeEntry(this.app, file);
	}

	isNoteSnoozed(file: TFile): boolean {
		return isNoteSnoozed(this.app, file);
	}

	/**
	 * Create a FileRecord from a TFile with all metadata including snooze info.
	 */
	getFileRecord(file: TFile): FileRecord {
		const snoozeEntry = getSnoozeEntry(this.app, file);

		return {
			path: file.path,
			name: file.name,
			mtime: file.stat.mtime,
			snoozeInfo: {
				interval: snoozeEntry?.interval,
				expireTime: snoozeEntry?.expire,
			}
		};
	}

	async openFileInLeaf(file: TFile, leaf: WorkspaceLeaf) {
		await leaf.openFile(file);
	}

	/**
	 * Wake up notes with expired snoozes in a folder.
	 * Notes are processed in order of earliest snooze expiration first,
	 * so their updated mtimes reflect the order they should appear.
	 */
	async wakeExpiredSnoozes(folderPath: string) {
		const files = this.app.vault.getFiles().filter(
			f => f.path.startsWith(folderPath + '/') && f.extension === 'md'
		);

		const expiredSnoozes: { file: TFile; expireTime: ExpireTime }[] = [];

		for (const file of files) {
			const snoozeEntry = getSnoozeEntry(this.app, file);
			if (snoozeEntry && parseISODateTime(snoozeEntry.expire).getTime() < Date.now()) {
				expiredSnoozes.push({ file, expireTime: snoozeEntry.expire });
			}
		}

		// Sort by expireTime ascending (earliest first)
		expiredSnoozes.sort((a, b) => parseISODateTime(a.expireTime).getTime() - parseISODateTime(b.expireTime).getTime());

		// Clear snooze for each note sequentially
		for (const { file } of expiredSnoozes) {
			await clearSnoozeEntry(this.app, file);
		}
	}

	onunload() {
		// Commands are automatically cleaned up by Obsidian when the plugin unloads
		this.registeredFolderPaths.clear();
	}
}
