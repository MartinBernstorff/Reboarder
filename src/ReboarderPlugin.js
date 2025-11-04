import { __awaiter } from "tslib";
import { Plugin, TFolder, TFile, Notice } from 'obsidian';
import { DEFAULT_SETTINGS } from 'app/ReboarderSettings';
import { ReboarderSettingTab } from 'app/ReboarderSettingTab';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/react-db';
import { ReboarderView, queryClient, REBOARDER_VIEW_TYPE, SNOOZE_INTERVAL_KEY, SNOOZE_EXPIRE_KEY } from '../Main';
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
// Derived field helpers
export function isFileRecordSnoozed(record) {
    return !!(record.snoozeInfo.expireTime && Date.now() < record.snoozeInfo.expireTime);
}
export function getFileRecordRemainingHours(record) {
    if (!record.snoozeInfo.expireTime || !isFileRecordSnoozed(record)) {
        return undefined;
    }
    const remainingMs = record.snoozeInfo.expireTime - Date.now();
    return Math.ceil(remainingMs / (60 * 60 * 1000));
}
export default class ReboarderPlugin extends Plugin {
    constructor() {
        super(...arguments);
        this.registeredFolderPaths = new Set();
        this.fileCollection = createCollection(queryCollectionOptions({
            queryKey: ['notes'],
            queryFn: () => __awaiter(this, void 0, void 0, function* () {
                const files = this.app.vault.getFiles();
                const fileRecords = files.map(file => this.getFileRecord(file));
                console.log(fileRecords);
                return fileRecords;
            }),
            queryClient: queryClient,
            getKey: (item) => {
                return item.name;
            },
            onUpdate: ({ transaction }) => __awaiter(this, void 0, void 0, function* () {
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
                    yield this.app.fileManager.renameFile(currentFile, modified.path);
                }
                // ? What happens to the collection itself? Is it updated as soon as the onUpdate method terminates?
            }),
            onInsert: ({ transaction }) => __awaiter(this, void 0, void 0, function* () {
                const newItem = transaction.mutations[0].modified;
                yield this.app.vault.create(newItem.path, "");
                yield this.setSnoozeEntry(this.app.vault.getAbstractFileByPath(newItem.path), newItem.snoozeInfo.interval, newItem.snoozeInfo.expireTime);
            }),
            onDelete: ({ transaction }) => __awaiter(this, void 0, void 0, function* () {
                const mutation = transaction.mutations[0];
                const file = this.app.vault.getAbstractFileByPath(mutation.original.path);
                if (file) {
                    yield this.app.vault.trash(file, false);
                    console.log("Deleted file:", mutation.original.path);
                }
            }),
        }));
    }
    getFolders() {
        const folders = [];
        const traverse = (folder) => {
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
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            // Load settings first before anything else uses them
            yield this.loadSettings();
            // Migrate legacy snooze data if present
            yield this.migrateLegacySnoozeData();
            // Register the board view
            this.registerView(REBOARDER_VIEW_TYPE, (leaf) => new ReboarderView(leaf, this));
            // Register commands for existing folders
            this.registerBoardCommands();
            // Listen for vault events to dynamically update commands
            this.registerEvent(this.app.vault.on('create', (file) => {
                if (file instanceof TFolder) {
                    this.registerBoardCommands();
                }
                else if (file instanceof TFile && file.extension === 'md') {
                    // A note was created, might make a folder eligible for a board
                    this.registerBoardCommands();
                }
            }));
            this.registerEvent(this.app.vault.on('delete', (file) => {
                if (file instanceof TFolder) {
                    this.registerBoardCommands();
                }
                else if (file instanceof TFile && file.extension === 'md') {
                    // A note was deleted, might make a folder ineligible for a board
                    this.registerBoardCommands();
                }
            }));
            this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
                if (file instanceof TFolder) {
                    this.registerBoardCommands();
                }
                else if (file instanceof TFile && file.extension === 'md') {
                    // A note was moved, might affect which folders are eligible for boards
                    this.registerBoardCommands();
                }
            }));
            // Add settings tab
            this.addSettingTab(new ReboarderSettingTab(this.app, this));
        });
    }
    registerBoardCommands() {
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
        folders.forEach((folder) => {
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
    activateView(selectedBoardPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const { workspace } = this.app;
            console.log('activateView called with selectedBoardPath:', selectedBoardPath);
            // Always create a new leaf for navigation between boards
            // This ensures each board view has its own navigation history
            const leaf = workspace.getLeaf('tab');
            // Set the view state with the selected board path
            yield leaf.setViewState({
                type: REBOARDER_VIEW_TYPE,
                active: true,
                state: { selectedBoardPath: selectedBoardPath }
            });
            workspace.revealLeaf(leaf);
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
            // Re-register commands when settings change (excluded folders might have changed)
            this.registerBoardCommands();
        });
    }
    /**
     * Migration: move legacy central snoozeData store into per-note frontmatter.
     */
    migrateLegacySnoozeData() {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield this.loadData();
            const legacy = data === null || data === void 0 ? void 0 : data.snoozeData;
            if (!legacy || Object.keys(legacy).length === 0)
                return;
            for (const [path, entry] of Object.entries(legacy)) {
                const file = this.app.vault.getAbstractFileByPath(path);
                if (file && file instanceof TFile && file.extension === 'md') {
                    // Only write if not already present
                    const existing = this.getSnoozeEntry(file);
                    if (!existing) {
                        yield this.setSnoozeEntry(file, entry.interval, entry.expire);
                    }
                }
            }
            // Remove legacy data and persist
            delete data.snoozeData;
            yield this.saveData(data);
            new Notice('Reboarder: migrated legacy snoozes to note frontmatter');
        });
    }
    /** Read current frontmatter using metadata cache. */
    getFrontmatter(file) {
        var _a;
        const cache = this.app.metadataCache.getFileCache(file);
        return (_a = cache === null || cache === void 0 ? void 0 : cache.frontmatter) !== null && _a !== void 0 ? _a : null;
    }
    /** Return snooze entry from a note frontmatter, if present and valid. */
    getSnoozeEntry(file) {
        const fm = this.getFrontmatter(file);
        if (!fm)
            return null;
        const interval = fm[SNOOZE_INTERVAL_KEY];
        const expire = fm[SNOOZE_EXPIRE_KEY];
        if (typeof interval === 'number' && typeof expire === 'number') {
            return { interval, expire };
        }
        return null;
    }
    /** Generic frontmatter edit helper (very lightweight YAML manip). */
    editFrontmatter(file, mutator) {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield this.app.vault.read(file);
            let fmStart = -1;
            let fmEnd = -1;
            if (content.startsWith('---')) {
                fmStart = 0;
                fmEnd = content.indexOf('\n---', 3);
                if (fmEnd !== -1) {
                    // position right after closing --- line
                    const after = content.indexOf('\n', fmEnd + 4);
                    if (after !== -1)
                        fmEnd = after + 1; // include newline after closing ---
                    else
                        fmEnd = content.length;
                }
            }
            let frontmatterRaw = '';
            if (fmStart === 0 && fmEnd !== -1) {
                // Extract between first '---\n' and the line with only '---'
                const fmBlock = content.slice(0, fmEnd);
                const lines = fmBlock.split('\n');
                lines.shift(); // remove opening ---
                // remove closing --- (last non-empty '---')
                while (lines.length > 0 && lines[lines.length - 1].trim() === '')
                    lines.pop();
                if (lines.length > 0 && lines[lines.length - 1].trim() === '---')
                    lines.pop();
                frontmatterRaw = lines.join('\n');
            }
            const map = {};
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
            Object.keys(map).forEach(k => { if (map[k] === undefined || map[k] === null)
                delete map[k]; });
            // Remove our keys if they are not both present (avoid partial data)
            if (!(SNOOZE_INTERVAL_KEY in map && SNOOZE_EXPIRE_KEY in map)) {
                delete map[SNOOZE_INTERVAL_KEY];
                delete map[SNOOZE_EXPIRE_KEY];
            }
            let newContent;
            const keys = Object.keys(map);
            if (keys.length === 0) {
                // Remove frontmatter entirely if it only contained our keys or became empty
                if (fmStart === 0 && fmEnd !== -1) {
                    newContent = content.slice(fmEnd); // strip old frontmatter
                }
                else {
                    newContent = content; // nothing to change
                }
            }
            else {
                const fmSerialized = keys.map(k => `${k}: ${map[k]}`).join('\n');
                const rebuilt = `---\n${fmSerialized}\n---\n`;
                if (fmStart === 0 && fmEnd !== -1) {
                    newContent = rebuilt + content.slice(fmEnd);
                }
                else {
                    newContent = rebuilt + content;
                }
            }
            if (newContent !== content) {
                yield this.app.vault.modify(file, newContent);
            }
        });
    }
    setSnoozeEntry(file, interval, expire) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.editFrontmatter(file, map => {
                map[SNOOZE_INTERVAL_KEY] = interval;
                map[SNOOZE_EXPIRE_KEY] = expire;
            });
        });
    }
    clearSnoozeEntry(file) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.editFrontmatter(file, map => {
                delete map[SNOOZE_INTERVAL_KEY];
                delete map[SNOOZE_EXPIRE_KEY];
            });
        });
    }
    snoozeNote(file, hours) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            let intervalHours;
            if (hours && hours > 0) {
                intervalHours = hours; // explicit
            }
            else {
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
            yield this.setSnoozeEntry(file, intervalHours, expireTime);
            new Notice(`${file.name} snoozed for ${intervalHours} hour(s)`);
        });
    }
    isNoteSnoozed(file) {
        const entry = this.getSnoozeEntry(file);
        return !!(entry && Date.now() < entry.expire);
    }
    /**
     * Create a FileRecord from a TFile with all metadata including snooze info.
     */
    getFileRecord(file) {
        const snoozeEntry = this.getSnoozeEntry(file);
        return {
            path: file.path,
            name: file.name,
            mtime: file.stat.mtime,
            snoozeInfo: {
                interval: snoozeEntry === null || snoozeEntry === void 0 ? void 0 : snoozeEntry.interval,
                expireTime: snoozeEntry === null || snoozeEntry === void 0 ? void 0 : snoozeEntry.expire,
            }
        };
    }
    openFileInLeaf(file, leaf) {
        return __awaiter(this, void 0, void 0, function* () {
            yield leaf.openFile(file);
        });
    }
    onunload() {
        // Commands are automatically cleaned up by Obsidian when the plugin unloads
        this.registeredFolderPaths.clear();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUmVib2FyZGVyUGx1Z2luLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiUmVib2FyZGVyUGx1Z2luLnRzeCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBaUIsTUFBTSxVQUFVLENBQUM7QUFDekUsT0FBTyxFQUFxQixnQkFBZ0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQzVFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQzlELE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3RELE9BQU8sRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixFQUFvQyxtQkFBbUIsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLFNBQVMsQ0FBQztBQUNwSixPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sS0FBSyxDQUFDO0FBQ3hCLE9BQU8sT0FBTyxNQUFNLFNBQVMsQ0FBQztBQUU5QixNQUFNLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDakMsUUFBUSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDL0IsVUFBVSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDakMsQ0FBQyxDQUFDO0FBRUgsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUN4QyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtJQUNoQixJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtJQUNoQixLQUFLLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtJQUNqQixVQUFVLEVBQUUsZ0JBQWdCO0NBQzVCLENBQUMsQ0FBQztBQUlILHdCQUF3QjtBQUN4QixNQUFNLFVBQVUsbUJBQW1CLENBQUMsTUFBa0I7SUFDckQsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUN0RixDQUFDO0FBRUQsTUFBTSxVQUFVLDJCQUEyQixDQUFDLE1BQWtCO0lBQzdELElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFVBQVUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ2xFLE9BQU8sU0FBUyxDQUFDO0tBQ2pCO0lBQ0QsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzlELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDbEQsQ0FBQztBQUdELE1BQU0sQ0FBQyxPQUFPLE9BQU8sZUFBZ0IsU0FBUSxNQUFNO0lBQW5EOztRQUVTLDBCQUFxQixHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRXZELG1CQUFjLEdBQUcsZ0JBQWdCLENBQy9CLHNCQUFzQixDQUFDO1lBQ3RCLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQztZQUNuQixPQUFPLEVBQUUsR0FBUyxFQUFFO2dCQUNuQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDeEMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDaEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFDekIsT0FBTyxXQUFXLENBQUM7WUFDcEIsQ0FBQyxDQUFBO1lBQ0QsV0FBVyxFQUFFLFdBQVc7WUFDeEIsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7Z0JBQ2hCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztZQUNsQixDQUFDO1lBQ0QsUUFBUSxFQUFFLENBQU8sRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO2dCQUNuQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hELE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEVBQUUsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUV0RSwrQ0FBK0M7Z0JBQy9DLElBQUksUUFBUSxDQUFDLElBQUksS0FBSyxRQUFRLENBQUMsSUFBSSxFQUFFO29CQUNwQyw2RUFBNkU7b0JBQzdFLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDeEUsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUMsV0FBVyxZQUFZLEtBQUssQ0FBQyxFQUFFO3dCQUNwRCxPQUFPLENBQUMsS0FBSyxDQUFDLDJCQUEyQixFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDMUQsT0FBTztxQkFDUDtvQkFFRCxnREFBZ0Q7b0JBQ2hELE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQ2xFO2dCQUNELG9HQUFvRztZQUNyRyxDQUFDLENBQUE7WUFDRCxRQUFRLEVBQUUsQ0FBTyxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7Z0JBQ25DLE1BQU0sT0FBTyxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO2dCQUNsRCxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUM5QyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQ3hCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQVUsRUFDM0QsT0FBTyxDQUFDLFVBQVUsQ0FBQyxRQUFTLEVBQzVCLE9BQU8sQ0FBQyxVQUFVLENBQUMsVUFBVyxDQUM5QixDQUFDO1lBQ0gsQ0FBQyxDQUFBO1lBQ0QsUUFBUSxFQUFFLENBQU8sRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO2dCQUNuQyxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMxQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMxRSxJQUFJLElBQUksRUFBRTtvQkFDVCxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7b0JBQ3hDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7aUJBQ3JEO1lBQ0YsQ0FBQyxDQUFBO1NBQ0QsQ0FBQyxDQUNGLENBQUM7SUFtVUosQ0FBQztJQWpVQSxVQUFVO1FBQ1QsTUFBTSxPQUFPLEdBQWMsRUFBRSxDQUFDO1FBRTlCLE1BQU0sUUFBUSxHQUFHLENBQUMsTUFBZSxFQUFFLEVBQUU7WUFDcEMsNkJBQTZCO1lBQzdCLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxZQUFZLEtBQUssSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxDQUFDO1lBQ2xHLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQ3JCLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDckI7WUFFRCwrQkFBK0I7WUFDL0IsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQy9CLElBQUksS0FBSyxZQUFZLE9BQU8sRUFBRTtvQkFDN0IsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUNoQjtZQUNGLENBQUMsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBRUYsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNqRCxJQUFJLEtBQUssWUFBWSxPQUFPLEVBQUU7Z0JBQzdCLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUNoQjtRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVLLE1BQU07O1lBQ1gscURBQXFEO1lBQ3JELE1BQU0sSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBRTFCLHdDQUF3QztZQUN4QyxNQUFNLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBRXJDLDBCQUEwQjtZQUMxQixJQUFJLENBQUMsWUFBWSxDQUNoQixtQkFBbUIsRUFDbkIsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FDdkMsQ0FBQztZQUVGLHlDQUF5QztZQUN6QyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUU3Qix5REFBeUQ7WUFDekQsSUFBSSxDQUFDLGFBQWEsQ0FDakIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO2dCQUNwQyxJQUFJLElBQUksWUFBWSxPQUFPLEVBQUU7b0JBQzVCLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO2lCQUM3QjtxQkFBTSxJQUFJLElBQUksWUFBWSxLQUFLLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUU7b0JBQzVELCtEQUErRDtvQkFDL0QsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7aUJBQzdCO1lBQ0YsQ0FBQyxDQUFDLENBQ0YsQ0FBQztZQUVGLElBQUksQ0FBQyxhQUFhLENBQ2pCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTtnQkFDcEMsSUFBSSxJQUFJLFlBQVksT0FBTyxFQUFFO29CQUM1QixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztpQkFDN0I7cUJBQU0sSUFBSSxJQUFJLFlBQVksS0FBSyxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO29CQUM1RCxpRUFBaUU7b0JBQ2pFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO2lCQUM3QjtZQUNGLENBQUMsQ0FBQyxDQUNGLENBQUM7WUFFRixJQUFJLENBQUMsYUFBYSxDQUNqQixJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxFQUFFO2dCQUM3QyxJQUFJLElBQUksWUFBWSxPQUFPLEVBQUU7b0JBQzVCLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO2lCQUM3QjtxQkFBTSxJQUFJLElBQUksWUFBWSxLQUFLLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLEVBQUU7b0JBQzVELHVFQUF1RTtvQkFDdkUsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7aUJBQzdCO1lBQ0YsQ0FBQyxDQUFDLENBQ0YsQ0FBQztZQUVGLG1CQUFtQjtZQUNuQixJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksbUJBQW1CLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzdELENBQUM7S0FBQTtJQUVPLHFCQUFxQjtRQUM1QixzQkFBc0I7UUFDdEIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2xDLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRTdELGdGQUFnRjtRQUNoRixJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3pDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ2xDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDeEM7UUFDRixDQUFDLENBQUMsQ0FBQztRQUVILCtCQUErQjtRQUMvQixPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBZSxFQUFFLEVBQUU7WUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNqRCxNQUFNLFNBQVMsR0FBRyxrQkFBa0IsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUM7Z0JBRXJGLElBQUksQ0FBQyxVQUFVLENBQUM7b0JBQ2YsRUFBRSxFQUFFLFNBQVM7b0JBQ2IsSUFBSSxFQUFFLGVBQWUsTUFBTSxDQUFDLElBQUksRUFBRTtvQkFDbEMsUUFBUSxFQUFFLEdBQUcsRUFBRTt3QkFDZCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDaEMsQ0FBQztpQkFDRCxDQUFDLENBQUM7Z0JBRUgsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDNUM7UUFDRixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFSyxZQUFZLENBQUMsaUJBQXlCOztZQUMzQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUUvQixPQUFPLENBQUMsR0FBRyxDQUFDLDZDQUE2QyxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFFOUUseURBQXlEO1lBQ3pELDhEQUE4RDtZQUM5RCxNQUFNLElBQUksR0FBRyxTQUFTLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRXRDLGtEQUFrRDtZQUNsRCxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUM7Z0JBQ3ZCLElBQUksRUFBRSxtQkFBbUI7Z0JBQ3pCLE1BQU0sRUFBRSxJQUFJO2dCQUNaLEtBQUssRUFBRSxFQUFFLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFO2FBQy9DLENBQUMsQ0FBQztZQUVILFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDNUIsQ0FBQztLQUFBO0lBRUssWUFBWTs7WUFDakIsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzVFLENBQUM7S0FBQTtJQUVLLFlBQVk7O1lBQ2pCLE1BQU0sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbkMsa0ZBQWtGO1lBQ2xGLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQzlCLENBQUM7S0FBQTtJQUVEOztPQUVHO0lBQ1csdUJBQXVCOztZQUNwQyxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLEVBQWtFLENBQUM7WUFDbkcsTUFBTSxNQUFNLEdBQWlDLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxVQUFVLENBQUM7WUFDOUQsSUFBSSxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDO2dCQUFFLE9BQU87WUFFeEQsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ25ELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLElBQUksSUFBSSxJQUFJLFlBQVksS0FBSyxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxFQUFFO29CQUM3RCxvQ0FBb0M7b0JBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQzNDLElBQUksQ0FBQyxRQUFRLEVBQUU7d0JBQ2QsTUFBTSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztxQkFDOUQ7aUJBQ0Q7YUFDRDtZQUNELGlDQUFpQztZQUNqQyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDdkIsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzFCLElBQUksTUFBTSxDQUFDLHdEQUF3RCxDQUFDLENBQUM7UUFDdEUsQ0FBQztLQUFBO0lBRUQscURBQXFEO0lBQzdDLGNBQWMsQ0FBQyxJQUFXOztRQUNqQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEQsT0FBTyxNQUFBLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxXQUFXLG1DQUFJLElBQUksQ0FBQztJQUNuQyxDQUFDO0lBRUQseUVBQXlFO0lBQ3pFLGNBQWMsQ0FBQyxJQUFXO1FBQ3pCLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLEVBQUU7WUFBRSxPQUFPLElBQUksQ0FBQztRQUVyQixNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUN6QyxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUVyQyxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7WUFDL0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsQ0FBQztTQUM1QjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELHFFQUFxRTtJQUN2RCxlQUFlLENBQUMsSUFBVyxFQUFFLE9BQWdEOztZQUMxRixNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNqQixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNmLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDOUIsT0FBTyxHQUFHLENBQUMsQ0FBQztnQkFDWixLQUFLLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFO29CQUNqQix3Q0FBd0M7b0JBQ3hDLE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsSUFBSSxLQUFLLEtBQUssQ0FBQyxDQUFDO3dCQUFFLEtBQUssR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsb0NBQW9DOzt3QkFDcEUsS0FBSyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7aUJBQzVCO2FBQ0Q7WUFFRCxJQUFJLGNBQWMsR0FBRyxFQUFFLENBQUM7WUFDeEIsSUFBSSxPQUFPLEtBQUssQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRTtnQkFDbEMsNkRBQTZEO2dCQUM3RCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDeEMsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbEMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMscUJBQXFCO2dCQUVwQyw0Q0FBNEM7Z0JBQzVDLE9BQU8sS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtvQkFBRSxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQzlFLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSztvQkFBRSxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQzlFLGNBQWMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ2xDO1lBRUQsTUFBTSxHQUFHLEdBQW1CLEVBQUUsQ0FBQztZQUMvQixJQUFJLGNBQWMsRUFBRTtnQkFDbkIsY0FBYyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3pDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsNEJBQTRCLENBQUMsQ0FBQztvQkFDdkQsSUFBSSxLQUFLLEVBQUU7d0JBQ1YsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7cUJBQ3RFO2dCQUNGLENBQUMsQ0FBQyxDQUFDO2FBQ0g7WUFFRCxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFYiw2QkFBNkI7WUFDN0IsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxTQUFTLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUk7Z0JBQUUsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUUvRixvRUFBb0U7WUFDcEUsSUFBSSxDQUFDLENBQUMsbUJBQW1CLElBQUksR0FBRyxJQUFJLGlCQUFpQixJQUFJLEdBQUcsQ0FBQyxFQUFFO2dCQUM5RCxPQUFPLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2dCQUNoQyxPQUFPLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2FBQzlCO1lBRUQsSUFBSSxVQUFrQixDQUFDO1lBQ3ZCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUIsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDdEIsNEVBQTRFO2dCQUM1RSxJQUFJLE9BQU8sS0FBSyxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsQ0FBQyxFQUFFO29CQUNsQyxVQUFVLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLHdCQUF3QjtpQkFDM0Q7cUJBQU07b0JBQ04sVUFBVSxHQUFHLE9BQU8sQ0FBQyxDQUFDLG9CQUFvQjtpQkFDMUM7YUFDRDtpQkFBTTtnQkFDTixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2pFLE1BQU0sT0FBTyxHQUFHLFFBQVEsWUFBWSxTQUFTLENBQUM7Z0JBQzlDLElBQUksT0FBTyxLQUFLLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxDQUFDLEVBQUU7b0JBQ2xDLFVBQVUsR0FBRyxPQUFPLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDNUM7cUJBQU07b0JBQ04sVUFBVSxHQUFHLE9BQU8sR0FBRyxPQUFPLENBQUM7aUJBQy9CO2FBQ0Q7WUFDRCxJQUFJLFVBQVUsS0FBSyxPQUFPLEVBQUU7Z0JBQzNCLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsQ0FBQzthQUM5QztRQUNGLENBQUM7S0FBQTtJQUVhLGNBQWMsQ0FBQyxJQUFXLEVBQUUsUUFBZ0IsRUFBRSxNQUFjOztZQUN6RSxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxFQUFFO2dCQUN0QyxHQUFHLENBQUMsbUJBQW1CLENBQUMsR0FBRyxRQUFRLENBQUM7Z0JBQ3BDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUNqQyxDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7S0FBQTtJQUVLLGdCQUFnQixDQUFDLElBQVc7O1lBQ2pDLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUU7Z0JBQ3RDLE9BQU8sR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBQ2hDLE9BQU8sR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDL0IsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO0tBQUE7SUFFSyxVQUFVLENBQUMsSUFBVyxFQUFFLEtBQWE7O1lBQzFDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN2QixJQUFJLGFBQXFCLENBQUM7WUFDMUIsSUFBSSxLQUFLLElBQUksS0FBSyxHQUFHLENBQUMsRUFBRTtnQkFDdkIsYUFBYSxHQUFHLEtBQUssQ0FBQyxDQUFDLFdBQVc7YUFDbEM7aUJBQU07Z0JBQ04sTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDckYsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDO2dCQUNoQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN4QyxJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsRUFBRTtvQkFDaEMsTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ2xFLE9BQU8sR0FBRyxVQUFVLEtBQUssQ0FBQyxDQUFDLElBQUksVUFBVSxHQUFHLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztpQkFDekc7Z0JBQ0QsYUFBYSxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQzthQUNuQztZQUNELE1BQU0sVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDLGFBQWEsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQzFELE1BQU0sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQzNELElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksZ0JBQWdCLGFBQWEsVUFBVSxDQUFDLENBQUM7UUFDakUsQ0FBQztLQUFBO0lBRUQsYUFBYSxDQUFDLElBQVc7UUFDeEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4QyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQy9DLENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWEsQ0FBQyxJQUFXO1FBQ3hCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFOUMsT0FBTztZQUNOLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLEtBQUssRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUs7WUFDdEIsVUFBVSxFQUFFO2dCQUNYLFFBQVEsRUFBRSxXQUFXLGFBQVgsV0FBVyx1QkFBWCxXQUFXLENBQUUsUUFBUTtnQkFDL0IsVUFBVSxFQUFFLFdBQVcsYUFBWCxXQUFXLHVCQUFYLFdBQVcsQ0FBRSxNQUFNO2FBQy9CO1NBQ0QsQ0FBQztJQUNILENBQUM7SUFFSyxjQUFjLENBQUMsSUFBVyxFQUFFLElBQW1COztZQUNwRCxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0IsQ0FBQztLQUFBO0lBRUQsUUFBUTtRQUNQLDRFQUE0RTtRQUM1RSxJQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDcEMsQ0FBQztDQUNEIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUGx1Z2luLCBURm9sZGVyLCBURmlsZSwgTm90aWNlLCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSAnb2JzaWRpYW4nO1xuaW1wb3J0IHsgUmVib2FyZGVyU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MgfSBmcm9tICdhcHAvUmVib2FyZGVyU2V0dGluZ3MnO1xuaW1wb3J0IHsgUmVib2FyZGVyU2V0dGluZ1RhYiB9IGZyb20gJ2FwcC9SZWJvYXJkZXJTZXR0aW5nVGFiJztcbmltcG9ydCB7IHF1ZXJ5Q29sbGVjdGlvbk9wdGlvbnMgfSBmcm9tICdAdGFuc3RhY2svcXVlcnktZGItY29sbGVjdGlvbic7XG5pbXBvcnQgeyBjcmVhdGVDb2xsZWN0aW9uIH0gZnJvbSAnQHRhbnN0YWNrL3JlYWN0LWRiJztcbmltcG9ydCB7IFJlYm9hcmRlclZpZXcsIHF1ZXJ5Q2xpZW50LCBSRUJPQVJERVJfVklFV19UWVBFLCBMZWdhY3lTbm9vemVEYXRhLCBGcm9udG1hdHRlck1hcCwgU05PT1pFX0lOVEVSVkFMX0tFWSwgU05PT1pFX0VYUElSRV9LRVkgfSBmcm9tICcuLi9NYWluJztcbmltcG9ydCB7IHogfSBmcm9tICd6b2QnO1xuaW1wb3J0IGNvbnNvbGUgZnJvbSAnY29uc29sZSc7XG5cbmNvbnN0IFNub296ZUluZm9TY2hlbWEgPSB6Lm9iamVjdCh7XG5cdGludGVydmFsOiB6Lm51bWJlcigpLm9wdGlvbmFsKCksXG5cdGV4cGlyZVRpbWU6IHoubnVtYmVyKCkub3B0aW9uYWwoKSxcbn0pO1xuXG5leHBvcnQgY29uc3QgRmlsZVJlY29yZFNjaGVtYSA9IHoub2JqZWN0KHtcblx0cGF0aDogei5zdHJpbmcoKSxcblx0bmFtZTogei5zdHJpbmcoKSxcblx0bXRpbWU6IHoubnVtYmVyKCksXG5cdHNub296ZUluZm86IFNub296ZUluZm9TY2hlbWEsXG59KTtcblxuZXhwb3J0IHR5cGUgRmlsZVJlY29yZCA9IHouaW5mZXI8dHlwZW9mIEZpbGVSZWNvcmRTY2hlbWE+O1xuXG4vLyBEZXJpdmVkIGZpZWxkIGhlbHBlcnNcbmV4cG9ydCBmdW5jdGlvbiBpc0ZpbGVSZWNvcmRTbm9vemVkKHJlY29yZDogRmlsZVJlY29yZCk6IGJvb2xlYW4ge1xuXHRyZXR1cm4gISEocmVjb3JkLnNub296ZUluZm8uZXhwaXJlVGltZSAmJiBEYXRlLm5vdygpIDwgcmVjb3JkLnNub296ZUluZm8uZXhwaXJlVGltZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGaWxlUmVjb3JkUmVtYWluaW5nSG91cnMocmVjb3JkOiBGaWxlUmVjb3JkKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0aWYgKCFyZWNvcmQuc25vb3plSW5mby5leHBpcmVUaW1lIHx8ICFpc0ZpbGVSZWNvcmRTbm9vemVkKHJlY29yZCkpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGNvbnN0IHJlbWFpbmluZ01zID0gcmVjb3JkLnNub296ZUluZm8uZXhwaXJlVGltZSAtIERhdGUubm93KCk7XG5cdHJldHVybiBNYXRoLmNlaWwocmVtYWluaW5nTXMgLyAoNjAgKiA2MCAqIDEwMDApKTtcbn1cblxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBSZWJvYXJkZXJQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHRzZXR0aW5nczogUmVib2FyZGVyU2V0dGluZ3M7XG5cdHByaXZhdGUgcmVnaXN0ZXJlZEZvbGRlclBhdGhzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRmaWxlQ29sbGVjdGlvbiA9IGNyZWF0ZUNvbGxlY3Rpb24oXG5cdFx0XHRxdWVyeUNvbGxlY3Rpb25PcHRpb25zKHtcblx0XHRcdFx0cXVlcnlLZXk6IFsnbm90ZXMnXSxcblx0XHRcdFx0cXVlcnlGbjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVzID0gdGhpcy5hcHAudmF1bHQuZ2V0RmlsZXMoKTtcblx0XHRcdFx0XHRjb25zdCBmaWxlUmVjb3JkcyA9IGZpbGVzLm1hcChmaWxlID0+IHRoaXMuZ2V0RmlsZVJlY29yZChmaWxlKSk7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coZmlsZVJlY29yZHMpO1xuXHRcdFx0XHRcdHJldHVybiBmaWxlUmVjb3Jkcztcblx0XHRcdFx0fSxcblx0XHRcdFx0cXVlcnlDbGllbnQ6IHF1ZXJ5Q2xpZW50LFxuXHRcdFx0XHRnZXRLZXk6IChpdGVtKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGl0ZW0ubmFtZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0b25VcGRhdGU6IGFzeW5jICh7IHRyYW5zYWN0aW9uIH0pID0+IHtcblx0XHRcdFx0XHRjb25zdCB7IG9yaWdpbmFsLCBtb2RpZmllZCB9ID0gdHJhbnNhY3Rpb24ubXV0YXRpb25zWzBdO1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKFwiVXBkYXRpbmcgZmlsZSBmcm9tXCIsIG9yaWdpbmFsLnBhdGgsIFwidG9cIiwgbW9kaWZpZWQucGF0aCk7XG5cblx0XHRcdFx0XHQvLyBPbmx5IHJlbmFtZSBpZiB0aGUgcGF0aCBoYXMgYWN0dWFsbHkgY2hhbmdlZFxuXHRcdFx0XHRcdGlmIChvcmlnaW5hbC5wYXRoICE9PSBtb2RpZmllZC5wYXRoKSB7XG5cdFx0XHRcdFx0XHQvLyBHZXQgdGhlIGN1cnJlbnQgZmlsZSBmcm9tIHRoZSB2YXVsdCB0byBlbnN1cmUgd2UgaGF2ZSB0aGUgbGF0ZXN0IHJlZmVyZW5jZVxuXHRcdFx0XHRcdFx0Y29uc3QgY3VycmVudEZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgob3JpZ2luYWwucGF0aCk7XG5cdFx0XHRcdFx0XHRpZiAoIWN1cnJlbnRGaWxlIHx8ICEoY3VycmVudEZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcihcIkZpbGUgdG8gcmVuYW1lIG5vdCBmb3VuZDpcIiwgb3JpZ2luYWwucGF0aCk7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gQ2hlY2sgaWYgd2UncmUgbm90IGFscmVhZHkgYXQgdGhlIHRhcmdldCBwYXRoXG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmFwcC5maWxlTWFuYWdlci5yZW5hbWVGaWxlKGN1cnJlbnRGaWxlLCBtb2RpZmllZC5wYXRoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gPyBXaGF0IGhhcHBlbnMgdG8gdGhlIGNvbGxlY3Rpb24gaXRzZWxmPyBJcyBpdCB1cGRhdGVkIGFzIHNvb24gYXMgdGhlIG9uVXBkYXRlIG1ldGhvZCB0ZXJtaW5hdGVzP1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRvbkluc2VydDogYXN5bmMgKHsgdHJhbnNhY3Rpb24gfSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG5ld0l0ZW0gPSB0cmFuc2FjdGlvbi5tdXRhdGlvbnNbMF0ubW9kaWZpZWQ7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKG5ld0l0ZW0ucGF0aCwgXCJcIik7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5zZXRTbm9vemVFbnRyeShcblx0XHRcdFx0XHRcdHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChuZXdJdGVtLnBhdGgpIGFzIFRGaWxlLFxuXHRcdFx0XHRcdFx0bmV3SXRlbS5zbm9vemVJbmZvLmludGVydmFsISxcblx0XHRcdFx0XHRcdG5ld0l0ZW0uc25vb3plSW5mby5leHBpcmVUaW1lIVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9uRGVsZXRlOiBhc3luYyAoeyB0cmFuc2FjdGlvbiB9KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgbXV0YXRpb24gPSB0cmFuc2FjdGlvbi5tdXRhdGlvbnNbMF07XG5cdFx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChtdXRhdGlvbi5vcmlnaW5hbC5wYXRoKTtcblx0XHRcdFx0XHRpZiAoZmlsZSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQudHJhc2goZmlsZSwgZmFsc2UpO1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coXCJEZWxldGVkIGZpbGU6XCIsIG11dGF0aW9uLm9yaWdpbmFsLnBhdGgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pXG5cdFx0KTtcblxuXHRnZXRGb2xkZXJzKCk6IFRGb2xkZXJbXSB7XG5cdFx0Y29uc3QgZm9sZGVyczogVEZvbGRlcltdID0gW107XG5cblx0XHRjb25zdCB0cmF2ZXJzZSA9IChmb2xkZXI6IFRGb2xkZXIpID0+IHtcblx0XHRcdC8vIEFkZCBmb2xkZXIgaWYgaXQgaGFzIG5vdGVzXG5cdFx0XHRjb25zdCBub3RlcyA9IGZvbGRlci5jaGlsZHJlbi5maWx0ZXIoY2hpbGQgPT4gY2hpbGQgaW5zdGFuY2VvZiBURmlsZSAmJiBjaGlsZC5leHRlbnNpb24gPT09ICdtZCcpO1xuXHRcdFx0aWYgKG5vdGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Zm9sZGVycy5wdXNoKGZvbGRlcik7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlY3Vyc2l2ZWx5IGNoZWNrIHN1YmZvbGRlcnNcblx0XHRcdGZvbGRlci5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcblx0XHRcdFx0aWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikge1xuXHRcdFx0XHRcdHRyYXZlcnNlKGNoaWxkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKS5jaGlsZHJlbi5mb3JFYWNoKGNoaWxkID0+IHtcblx0XHRcdGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcblx0XHRcdFx0dHJhdmVyc2UoY2hpbGQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGZvbGRlcnM7XG5cdH1cblxuXHRhc3luYyBvbmxvYWQoKSB7XG5cdFx0Ly8gTG9hZCBzZXR0aW5ncyBmaXJzdCBiZWZvcmUgYW55dGhpbmcgZWxzZSB1c2VzIHRoZW1cblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG5cdFx0Ly8gTWlncmF0ZSBsZWdhY3kgc25vb3plIGRhdGEgaWYgcHJlc2VudFxuXHRcdGF3YWl0IHRoaXMubWlncmF0ZUxlZ2FjeVNub296ZURhdGEoKTtcblxuXHRcdC8vIFJlZ2lzdGVyIHRoZSBib2FyZCB2aWV3XG5cdFx0dGhpcy5yZWdpc3RlclZpZXcoXG5cdFx0XHRSRUJPQVJERVJfVklFV19UWVBFLFxuXHRcdFx0KGxlYWYpID0+IG5ldyBSZWJvYXJkZXJWaWV3KGxlYWYsIHRoaXMpXG5cdFx0KTtcblxuXHRcdC8vIFJlZ2lzdGVyIGNvbW1hbmRzIGZvciBleGlzdGluZyBmb2xkZXJzXG5cdFx0dGhpcy5yZWdpc3RlckJvYXJkQ29tbWFuZHMoKTtcblxuXHRcdC8vIExpc3RlbiBmb3IgdmF1bHQgZXZlbnRzIHRvIGR5bmFtaWNhbGx5IHVwZGF0ZSBjb21tYW5kc1xuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLnZhdWx0Lm9uKCdjcmVhdGUnLCAoZmlsZSkgPT4ge1xuXHRcdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcblx0XHRcdFx0XHR0aGlzLnJlZ2lzdGVyQm9hcmRDb21tYW5kcygpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlLmV4dGVuc2lvbiA9PT0gJ21kJykge1xuXHRcdFx0XHRcdC8vIEEgbm90ZSB3YXMgY3JlYXRlZCwgbWlnaHQgbWFrZSBhIGZvbGRlciBlbGlnaWJsZSBmb3IgYSBib2FyZFxuXHRcdFx0XHRcdHRoaXMucmVnaXN0ZXJCb2FyZENvbW1hbmRzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFdmVudChcblx0XHRcdHRoaXMuYXBwLnZhdWx0Lm9uKCdkZWxldGUnLCAoZmlsZSkgPT4ge1xuXHRcdFx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcblx0XHRcdFx0XHR0aGlzLnJlZ2lzdGVyQm9hcmRDb21tYW5kcygpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSAmJiBmaWxlLmV4dGVuc2lvbiA9PT0gJ21kJykge1xuXHRcdFx0XHRcdC8vIEEgbm90ZSB3YXMgZGVsZXRlZCwgbWlnaHQgbWFrZSBhIGZvbGRlciBpbmVsaWdpYmxlIGZvciBhIGJvYXJkXG5cdFx0XHRcdFx0dGhpcy5yZWdpc3RlckJvYXJkQ29tbWFuZHMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSlcblx0XHQpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAudmF1bHQub24oJ3JlbmFtZScsIChmaWxlLCBvbGRQYXRoKSA9PiB7XG5cdFx0XHRcdGlmIChmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikge1xuXHRcdFx0XHRcdHRoaXMucmVnaXN0ZXJCb2FyZENvbW1hbmRzKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUuZXh0ZW5zaW9uID09PSAnbWQnKSB7XG5cdFx0XHRcdFx0Ly8gQSBub3RlIHdhcyBtb3ZlZCwgbWlnaHQgYWZmZWN0IHdoaWNoIGZvbGRlcnMgYXJlIGVsaWdpYmxlIGZvciBib2FyZHNcblx0XHRcdFx0XHR0aGlzLnJlZ2lzdGVyQm9hcmRDb21tYW5kcygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHQvLyBBZGQgc2V0dGluZ3MgdGFiXG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBSZWJvYXJkZXJTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQm9hcmRDb21tYW5kcygpIHtcblx0XHQvLyBHZXQgY3VycmVudCBmb2xkZXJzXG5cdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMuZ2V0Rm9sZGVycygpO1xuXHRcdGNvbnN0IGN1cnJlbnRGb2xkZXJQYXRocyA9IG5ldyBTZXQoZm9sZGVycy5tYXAoZiA9PiBmLnBhdGgpKTtcblxuXHRcdC8vIFJlbW92ZSB0cmFja2VkIHBhdGhzIGZvciBmb2xkZXJzIHRoYXQgbm8gbG9uZ2VyIGV4aXN0IG9yIG5vIGxvbmdlciBoYXZlIG5vdGVzXG5cdFx0dGhpcy5yZWdpc3RlcmVkRm9sZGVyUGF0aHMuZm9yRWFjaChwYXRoID0+IHtcblx0XHRcdGlmICghY3VycmVudEZvbGRlclBhdGhzLmhhcyhwYXRoKSkge1xuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyZWRGb2xkZXJQYXRocy5kZWxldGUocGF0aCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBBZGQgY29tbWFuZHMgZm9yIG5ldyBmb2xkZXJzXG5cdFx0Zm9sZGVycy5mb3JFYWNoKChmb2xkZXI6IFRGb2xkZXIpID0+IHtcblx0XHRcdGlmICghdGhpcy5yZWdpc3RlcmVkRm9sZGVyUGF0aHMuaGFzKGZvbGRlci5wYXRoKSkge1xuXHRcdFx0XHRjb25zdCBjb21tYW5kSWQgPSBgb3Blbi1yZWJvYXJkZXItJHtmb2xkZXIubmFtZS5yZXBsYWNlKC9cXHMrL2csICctJykudG9Mb3dlckNhc2UoKX1gO1xuXG5cdFx0XHRcdHRoaXMuYWRkQ29tbWFuZCh7XG5cdFx0XHRcdFx0aWQ6IGNvbW1hbmRJZCxcblx0XHRcdFx0XHRuYW1lOiBgT3BlbiBib2FyZDogJHtmb2xkZXIubmFtZX1gLFxuXHRcdFx0XHRcdGNhbGxiYWNrOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLmFjdGl2YXRlVmlldyhmb2xkZXIucGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyZWRGb2xkZXJQYXRocy5hZGQoZm9sZGVyLnBhdGgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgYWN0aXZhdGVWaWV3KHNlbGVjdGVkQm9hcmRQYXRoOiBzdHJpbmcpIHtcblx0XHRjb25zdCB7IHdvcmtzcGFjZSB9ID0gdGhpcy5hcHA7XG5cblx0XHRjb25zb2xlLmxvZygnYWN0aXZhdGVWaWV3IGNhbGxlZCB3aXRoIHNlbGVjdGVkQm9hcmRQYXRoOicsIHNlbGVjdGVkQm9hcmRQYXRoKTtcblxuXHRcdC8vIEFsd2F5cyBjcmVhdGUgYSBuZXcgbGVhZiBmb3IgbmF2aWdhdGlvbiBiZXR3ZWVuIGJvYXJkc1xuXHRcdC8vIFRoaXMgZW5zdXJlcyBlYWNoIGJvYXJkIHZpZXcgaGFzIGl0cyBvd24gbmF2aWdhdGlvbiBoaXN0b3J5XG5cdFx0Y29uc3QgbGVhZiA9IHdvcmtzcGFjZS5nZXRMZWFmKCd0YWInKTtcblxuXHRcdC8vIFNldCB0aGUgdmlldyBzdGF0ZSB3aXRoIHRoZSBzZWxlY3RlZCBib2FyZCBwYXRoXG5cdFx0YXdhaXQgbGVhZi5zZXRWaWV3U3RhdGUoe1xuXHRcdFx0dHlwZTogUkVCT0FSREVSX1ZJRVdfVFlQRSxcblx0XHRcdGFjdGl2ZTogdHJ1ZSxcblx0XHRcdHN0YXRlOiB7IHNlbGVjdGVkQm9hcmRQYXRoOiBzZWxlY3RlZEJvYXJkUGF0aCB9XG5cdFx0fSk7XG5cblx0XHR3b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWFmKTtcblx0fVxuXG5cdGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcblx0XHR0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpIHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHRcdC8vIFJlLXJlZ2lzdGVyIGNvbW1hbmRzIHdoZW4gc2V0dGluZ3MgY2hhbmdlIChleGNsdWRlZCBmb2xkZXJzIG1pZ2h0IGhhdmUgY2hhbmdlZClcblx0XHR0aGlzLnJlZ2lzdGVyQm9hcmRDb21tYW5kcygpO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1pZ3JhdGlvbjogbW92ZSBsZWdhY3kgY2VudHJhbCBzbm9vemVEYXRhIHN0b3JlIGludG8gcGVyLW5vdGUgZnJvbnRtYXR0ZXIuXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIG1pZ3JhdGVMZWdhY3lTbm9vemVEYXRhKCkge1xuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWREYXRhKCkgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gJiB7IHNub296ZURhdGE/OiBMZWdhY3lTbm9vemVEYXRhOyB9O1xuXHRcdGNvbnN0IGxlZ2FjeTogTGVnYWN5U25vb3plRGF0YSB8IHVuZGVmaW5lZCA9IGRhdGE/LnNub296ZURhdGE7XG5cdFx0aWYgKCFsZWdhY3kgfHwgT2JqZWN0LmtleXMobGVnYWN5KS5sZW5ndGggPT09IDApIHJldHVybjtcblxuXHRcdGZvciAoY29uc3QgW3BhdGgsIGVudHJ5XSBvZiBPYmplY3QuZW50cmllcyhsZWdhY3kpKSB7XG5cdFx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuXHRcdFx0aWYgKGZpbGUgJiYgZmlsZSBpbnN0YW5jZW9mIFRGaWxlICYmIGZpbGUuZXh0ZW5zaW9uID09PSAnbWQnKSB7XG5cdFx0XHRcdC8vIE9ubHkgd3JpdGUgaWYgbm90IGFscmVhZHkgcHJlc2VudFxuXHRcdFx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuZ2V0U25vb3plRW50cnkoZmlsZSk7XG5cdFx0XHRcdGlmICghZXhpc3RpbmcpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnNldFNub296ZUVudHJ5KGZpbGUsIGVudHJ5LmludGVydmFsLCBlbnRyeS5leHBpcmUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIFJlbW92ZSBsZWdhY3kgZGF0YSBhbmQgcGVyc2lzdFxuXHRcdGRlbGV0ZSBkYXRhLnNub296ZURhdGE7XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YShkYXRhKTtcblx0XHRuZXcgTm90aWNlKCdSZWJvYXJkZXI6IG1pZ3JhdGVkIGxlZ2FjeSBzbm9vemVzIHRvIG5vdGUgZnJvbnRtYXR0ZXInKTtcblx0fVxuXG5cdC8qKiBSZWFkIGN1cnJlbnQgZnJvbnRtYXR0ZXIgdXNpbmcgbWV0YWRhdGEgY2FjaGUuICovXG5cdHByaXZhdGUgZ2V0RnJvbnRtYXR0ZXIoZmlsZTogVEZpbGUpOiBGcm9udG1hdHRlck1hcCB8IG51bGwge1xuXHRcdGNvbnN0IGNhY2hlID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk7XG5cdFx0cmV0dXJuIGNhY2hlPy5mcm9udG1hdHRlciA/PyBudWxsO1xuXHR9XG5cblx0LyoqIFJldHVybiBzbm9vemUgZW50cnkgZnJvbSBhIG5vdGUgZnJvbnRtYXR0ZXIsIGlmIHByZXNlbnQgYW5kIHZhbGlkLiAqL1xuXHRnZXRTbm9vemVFbnRyeShmaWxlOiBURmlsZSk6IHsgaW50ZXJ2YWw6IG51bWJlcjsgZXhwaXJlOiBudW1iZXI7IH0gfCBudWxsIHtcblx0XHRjb25zdCBmbSA9IHRoaXMuZ2V0RnJvbnRtYXR0ZXIoZmlsZSk7XG5cdFx0aWYgKCFmbSkgcmV0dXJuIG51bGw7XG5cblx0XHRjb25zdCBpbnRlcnZhbCA9IGZtW1NOT09aRV9JTlRFUlZBTF9LRVldO1xuXHRcdGNvbnN0IGV4cGlyZSA9IGZtW1NOT09aRV9FWFBJUkVfS0VZXTtcblxuXHRcdGlmICh0eXBlb2YgaW50ZXJ2YWwgPT09ICdudW1iZXInICYmIHR5cGVvZiBleHBpcmUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRyZXR1cm4geyBpbnRlcnZhbCwgZXhwaXJlIH07XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0LyoqIEdlbmVyaWMgZnJvbnRtYXR0ZXIgZWRpdCBoZWxwZXIgKHZlcnkgbGlnaHR3ZWlnaHQgWUFNTCBtYW5pcCkuICovXG5cdHByaXZhdGUgYXN5bmMgZWRpdEZyb250bWF0dGVyKGZpbGU6IFRGaWxlLCBtdXRhdG9yOiAobWFwOiBGcm9udG1hdHRlck1hcCkgPT4gdm9pZCB8IGJvb2xlYW4pIHtcblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRsZXQgZm1TdGFydCA9IC0xO1xuXHRcdGxldCBmbUVuZCA9IC0xO1xuXHRcdGlmIChjb250ZW50LnN0YXJ0c1dpdGgoJy0tLScpKSB7XG5cdFx0XHRmbVN0YXJ0ID0gMDtcblx0XHRcdGZtRW5kID0gY29udGVudC5pbmRleE9mKCdcXG4tLS0nLCAzKTtcblx0XHRcdGlmIChmbUVuZCAhPT0gLTEpIHtcblx0XHRcdFx0Ly8gcG9zaXRpb24gcmlnaHQgYWZ0ZXIgY2xvc2luZyAtLS0gbGluZVxuXHRcdFx0XHRjb25zdCBhZnRlciA9IGNvbnRlbnQuaW5kZXhPZignXFxuJywgZm1FbmQgKyA0KTtcblx0XHRcdFx0aWYgKGFmdGVyICE9PSAtMSkgZm1FbmQgPSBhZnRlciArIDE7IC8vIGluY2x1ZGUgbmV3bGluZSBhZnRlciBjbG9zaW5nIC0tLVxuXHRcdFx0XHRlbHNlIGZtRW5kID0gY29udGVudC5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGZyb250bWF0dGVyUmF3ID0gJyc7XG5cdFx0aWYgKGZtU3RhcnQgPT09IDAgJiYgZm1FbmQgIT09IC0xKSB7XG5cdFx0XHQvLyBFeHRyYWN0IGJldHdlZW4gZmlyc3QgJy0tLVxcbicgYW5kIHRoZSBsaW5lIHdpdGggb25seSAnLS0tJ1xuXHRcdFx0Y29uc3QgZm1CbG9jayA9IGNvbnRlbnQuc2xpY2UoMCwgZm1FbmQpO1xuXHRcdFx0Y29uc3QgbGluZXMgPSBmbUJsb2NrLnNwbGl0KCdcXG4nKTtcblx0XHRcdGxpbmVzLnNoaWZ0KCk7IC8vIHJlbW92ZSBvcGVuaW5nIC0tLVxuXG5cdFx0XHQvLyByZW1vdmUgY2xvc2luZyAtLS0gKGxhc3Qgbm9uLWVtcHR5ICctLS0nKVxuXHRcdFx0d2hpbGUgKGxpbmVzLmxlbmd0aCA+IDAgJiYgbGluZXNbbGluZXMubGVuZ3RoIC0gMV0udHJpbSgpID09PSAnJykgbGluZXMucG9wKCk7XG5cdFx0XHRpZiAobGluZXMubGVuZ3RoID4gMCAmJiBsaW5lc1tsaW5lcy5sZW5ndGggLSAxXS50cmltKCkgPT09ICctLS0nKSBsaW5lcy5wb3AoKTtcblx0XHRcdGZyb250bWF0dGVyUmF3ID0gbGluZXMuam9pbignXFxuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWFwOiBGcm9udG1hdHRlck1hcCA9IHt9O1xuXHRcdGlmIChmcm9udG1hdHRlclJhdykge1xuXHRcdFx0ZnJvbnRtYXR0ZXJSYXcuc3BsaXQoL1xcbi8pLmZvckVhY2gobGluZSA9PiB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXihbQS1aYS16MC05Xy1dKyk6XFxzKiguKikkLyk7XG5cdFx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRcdG1hcFttYXRjaFsxXV0gPSBpc05hTihOdW1iZXIobWF0Y2hbMl0pKSA/IG1hdGNoWzJdIDogTnVtYmVyKG1hdGNoWzJdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0bXV0YXRvcihtYXApO1xuXG5cdFx0Ly8gQ2xlYW4gb3V0IHVuZGVmaW5lZCAvIG51bGxcblx0XHRPYmplY3Qua2V5cyhtYXApLmZvckVhY2goayA9PiB7IGlmIChtYXBba10gPT09IHVuZGVmaW5lZCB8fCBtYXBba10gPT09IG51bGwpIGRlbGV0ZSBtYXBba107IH0pO1xuXG5cdFx0Ly8gUmVtb3ZlIG91ciBrZXlzIGlmIHRoZXkgYXJlIG5vdCBib3RoIHByZXNlbnQgKGF2b2lkIHBhcnRpYWwgZGF0YSlcblx0XHRpZiAoIShTTk9PWkVfSU5URVJWQUxfS0VZIGluIG1hcCAmJiBTTk9PWkVfRVhQSVJFX0tFWSBpbiBtYXApKSB7XG5cdFx0XHRkZWxldGUgbWFwW1NOT09aRV9JTlRFUlZBTF9LRVldO1xuXHRcdFx0ZGVsZXRlIG1hcFtTTk9PWkVfRVhQSVJFX0tFWV07XG5cdFx0fVxuXG5cdFx0bGV0IG5ld0NvbnRlbnQ6IHN0cmluZztcblx0XHRjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobWFwKTtcblx0XHRpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIFJlbW92ZSBmcm9udG1hdHRlciBlbnRpcmVseSBpZiBpdCBvbmx5IGNvbnRhaW5lZCBvdXIga2V5cyBvciBiZWNhbWUgZW1wdHlcblx0XHRcdGlmIChmbVN0YXJ0ID09PSAwICYmIGZtRW5kICE9PSAtMSkge1xuXHRcdFx0XHRuZXdDb250ZW50ID0gY29udGVudC5zbGljZShmbUVuZCk7IC8vIHN0cmlwIG9sZCBmcm9udG1hdHRlclxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmV3Q29udGVudCA9IGNvbnRlbnQ7IC8vIG5vdGhpbmcgdG8gY2hhbmdlXG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGZtU2VyaWFsaXplZCA9IGtleXMubWFwKGsgPT4gYCR7a306ICR7bWFwW2tdfWApLmpvaW4oJ1xcbicpO1xuXHRcdFx0Y29uc3QgcmVidWlsdCA9IGAtLS1cXG4ke2ZtU2VyaWFsaXplZH1cXG4tLS1cXG5gO1xuXHRcdFx0aWYgKGZtU3RhcnQgPT09IDAgJiYgZm1FbmQgIT09IC0xKSB7XG5cdFx0XHRcdG5ld0NvbnRlbnQgPSByZWJ1aWx0ICsgY29udGVudC5zbGljZShmbUVuZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXdDb250ZW50ID0gcmVidWlsdCArIGNvbnRlbnQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChuZXdDb250ZW50ICE9PSBjb250ZW50KSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZmlsZSwgbmV3Q29udGVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZXRTbm9vemVFbnRyeShmaWxlOiBURmlsZSwgaW50ZXJ2YWw6IG51bWJlciwgZXhwaXJlOiBudW1iZXIpIHtcblx0XHRhd2FpdCB0aGlzLmVkaXRGcm9udG1hdHRlcihmaWxlLCBtYXAgPT4ge1xuXHRcdFx0bWFwW1NOT09aRV9JTlRFUlZBTF9LRVldID0gaW50ZXJ2YWw7XG5cdFx0XHRtYXBbU05PT1pFX0VYUElSRV9LRVldID0gZXhwaXJlO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgY2xlYXJTbm9vemVFbnRyeShmaWxlOiBURmlsZSkge1xuXHRcdGF3YWl0IHRoaXMuZWRpdEZyb250bWF0dGVyKGZpbGUsIG1hcCA9PiB7XG5cdFx0XHRkZWxldGUgbWFwW1NOT09aRV9JTlRFUlZBTF9LRVldO1xuXHRcdFx0ZGVsZXRlIG1hcFtTTk9PWkVfRVhQSVJFX0tFWV07XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBzbm9vemVOb3RlKGZpbGU6IFRGaWxlLCBob3VyczogbnVtYmVyKSB7XG5cdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRsZXQgaW50ZXJ2YWxIb3VyczogbnVtYmVyO1xuXHRcdGlmIChob3VycyAmJiBob3VycyA+IDApIHtcblx0XHRcdGludGVydmFsSG91cnMgPSBob3VyczsgLy8gZXhwbGljaXRcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZHVyYXRpb25zID0gT2JqZWN0LnZhbHVlcyh0aGlzLnNldHRpbmdzLnNub296ZUR1cmF0aW9ucykuc29ydCgoYSwgYikgPT4gYSAtIGIpO1xuXHRcdFx0bGV0IG5leHRJZHggPSAwO1xuXHRcdFx0Y29uc3QgZW50cnkgPSB0aGlzLmdldFNub296ZUVudHJ5KGZpbGUpO1xuXHRcdFx0aWYgKGVudHJ5ICYmIGVudHJ5LmV4cGlyZSA+IG5vdykge1xuXHRcdFx0XHRjb25zdCBjdXJyZW50SWR4ID0gZHVyYXRpb25zLmZpbmRJbmRleChkID0+IGQgPT09IGVudHJ5LmludGVydmFsKTtcblx0XHRcdFx0bmV4dElkeCA9IGN1cnJlbnRJZHggIT09IC0xICYmIGN1cnJlbnRJZHggPCBkdXJhdGlvbnMubGVuZ3RoIC0gMSA/IGN1cnJlbnRJZHggKyAxIDogZHVyYXRpb25zLmxlbmd0aCAtIDE7XG5cdFx0XHR9XG5cdFx0XHRpbnRlcnZhbEhvdXJzID0gZHVyYXRpb25zW25leHRJZHhdO1xuXHRcdH1cblx0XHRjb25zdCBleHBpcmVUaW1lID0gbm93ICsgKGludGVydmFsSG91cnMgKiA2MCAqIDYwICogMTAwMCk7XG5cdFx0YXdhaXQgdGhpcy5zZXRTbm9vemVFbnRyeShmaWxlLCBpbnRlcnZhbEhvdXJzLCBleHBpcmVUaW1lKTtcblx0XHRuZXcgTm90aWNlKGAke2ZpbGUubmFtZX0gc25vb3plZCBmb3IgJHtpbnRlcnZhbEhvdXJzfSBob3VyKHMpYCk7XG5cdH1cblxuXHRpc05vdGVTbm9vemVkKGZpbGU6IFRGaWxlKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZW50cnkgPSB0aGlzLmdldFNub296ZUVudHJ5KGZpbGUpO1xuXHRcdHJldHVybiAhIShlbnRyeSAmJiBEYXRlLm5vdygpIDwgZW50cnkuZXhwaXJlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBGaWxlUmVjb3JkIGZyb20gYSBURmlsZSB3aXRoIGFsbCBtZXRhZGF0YSBpbmNsdWRpbmcgc25vb3plIGluZm8uXG5cdCAqL1xuXHRnZXRGaWxlUmVjb3JkKGZpbGU6IFRGaWxlKTogRmlsZVJlY29yZCB7XG5cdFx0Y29uc3Qgc25vb3plRW50cnkgPSB0aGlzLmdldFNub296ZUVudHJ5KGZpbGUpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHBhdGg6IGZpbGUucGF0aCxcblx0XHRcdG5hbWU6IGZpbGUubmFtZSxcblx0XHRcdG10aW1lOiBmaWxlLnN0YXQubXRpbWUsXG5cdFx0XHRzbm9vemVJbmZvOiB7XG5cdFx0XHRcdGludGVydmFsOiBzbm9vemVFbnRyeT8uaW50ZXJ2YWwsXG5cdFx0XHRcdGV4cGlyZVRpbWU6IHNub296ZUVudHJ5Py5leHBpcmUsXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIG9wZW5GaWxlSW5MZWFmKGZpbGU6IFRGaWxlLCBsZWFmOiBXb3Jrc3BhY2VMZWFmKSB7XG5cdFx0YXdhaXQgbGVhZi5vcGVuRmlsZShmaWxlKTtcblx0fVxuXG5cdG9udW5sb2FkKCkge1xuXHRcdC8vIENvbW1hbmRzIGFyZSBhdXRvbWF0aWNhbGx5IGNsZWFuZWQgdXAgYnkgT2JzaWRpYW4gd2hlbiB0aGUgcGx1Z2luIHVubG9hZHNcblx0XHR0aGlzLnJlZ2lzdGVyZWRGb2xkZXJQYXRocy5jbGVhcigpO1xuXHR9XG59XG4iXX0=