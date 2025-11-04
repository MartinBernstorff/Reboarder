import { Plugin, TFolder, TFile, Notice, WorkspaceLeaf } from 'obsidian';
import { ReboarderSettings, DEFAULT_SETTINGS } from 'app/ReboarderSettings';
import { ReboarderSettingTab } from 'app/ReboarderSettingTab';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/react-db';
import { ReboarderView, queryClient, REBOARDER_VIEW_TYPE, LegacySnoozeData, FrontmatterMap, SNOOZE_INTERVAL_KEY, SNOOZE_EXPIRE_KEY } from '../Main';
import { z } from 'zod';
import console from 'console';

const SnoozeInfoSchema = z.object({
	interval: z.number().optional(),
	expireTime: z.number().optional(),
});

export const FileRecordSchema = z.object({
	path: z.string(),
	name: z.string(),
	mtime: z.number(),
	snoozeInfo: SnoozeInfoSchema,
});

export type FileRecord = z.infer<typeof FileRecordSchema>;

// Derived field helpers
export function isFileRecordSnoozed(record: FileRecord): boolean {
	return !!(record.snoozeInfo.expireTime && Date.now() < record.snoozeInfo.expireTime);
}

export function getFileRecordRemainingHours(record: FileRecord): number | undefined {
	if (!record.snoozeInfo.expireTime || !isFileRecordSnoozed(record)) {
		return undefined;
	}
	const remainingMs = record.snoozeInfo.expireTime - Date.now();
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
				console.log("Updating file from", original.path, "to", modified.path);

				// Only rename if the path has actually changed
				if (original.path !== modified.path) {
					// Get the current file from the vault to ensure we have the latest reference
					const currentFile = this.app.vault.getAbstractFileByPath(original.path);
					if (!currentFile || !(currentFile instanceof TFile)) {
						console.error("File to rename not found:", original.path);
						return;
					}

					// Check if we're not already at the target path
					await this.app.fileManager.renameFile(currentFile, modified.path);
				}
				// ? What happens to the collection itself? Is it updated as soon as the onUpdate method terminates?
			},
			onInsert: async ({ transaction }) => {
				const newItem = transaction.mutations[0].modified;
				await this.app.vault.create(newItem.path, "");
				await this.setSnoozeEntry(
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

		// Migrate legacy snooze data if present
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
		const data = await this.loadData() as Record<string, unknown> & { snoozeData?: LegacySnoozeData; };
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
	getSnoozeEntry(file: TFile): { interval: number; expire: number; } | null {
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

	async snoozeNote(file: FileRecord, hours: number) {
		const tfile = this.app.vault.getAbstractFileByPath(file.path)! as TFile;
		const now = Date.now();
		let intervalHours: number;
		if (hours && hours > 0) {
			intervalHours = hours; // explicit
		} else {
			const durations = Object.values(this.settings.snoozeDurations).sort((a, b) => a - b);
			let nextIdx = 0;
			const entry = this.getSnoozeEntry(tfile);
			if (entry && entry.expire > now) {
				const currentIdx = durations.findIndex(d => d === entry.interval);
				nextIdx = currentIdx !== -1 && currentIdx < durations.length - 1 ? currentIdx + 1 : durations.length - 1;
			}
			intervalHours = durations[nextIdx];
		}
		const expireTime = now + (intervalHours * 60 * 60 * 1000);
		await this.setSnoozeEntry(tfile, intervalHours, expireTime);

		queryClient.refetchQueries({ queryKey: ['notes'] });

		new Notice(`${file.name} snoozed for ${intervalHours} hour(s)`);
	}

	isNoteSnoozed(file: TFile): boolean {
		const entry = this.getSnoozeEntry(file);
		return !!(entry && Date.now() < entry.expire);
	}

	/**
	 * Create a FileRecord from a TFile with all metadata including snooze info.
	 */
	getFileRecord(file: TFile): FileRecord {
		const snoozeEntry = this.getSnoozeEntry(file);

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

	onunload() {
		// Commands are automatically cleaned up by Obsidian when the plugin unloads
		this.registeredFolderPaths.clear();
	}
}
