import { App, TFile } from 'obsidian';
import { QueryClient } from '@tanstack/react-query';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/react-db';
import { type FileRecord } from './FileRecord';
import { setSnoozeEntry, clearSnoozeEntry } from 'src/snooze/snooze';

export function createFileCollection(
	app: App,
	qClient: QueryClient,
	getFileRecord: (file: TFile) => FileRecord
) {
	return createCollection(
		queryCollectionOptions({
			queryKey: ['notes'],
			queryFn: async () => {
				const files = app.vault.getFiles();
				const fileRecords = files.map(file => getFileRecord(file));
				console.log(fileRecords);
				return fileRecords;
			},
			queryClient: qClient,
			getKey: (item) => {
				return item.name;
			},
			onUpdate: async ({ transaction }) => {
				const { original, modified } = transaction.mutations[0];
				console.log("Updating file record:", original, "->", modified);

				// Get the current file from the vault
				const currentFile = app.vault.getAbstractFileByPath(original.path);
				if (!currentFile || !(currentFile instanceof TFile)) {
					console.error("File to update not found:", original.path);
					return;
				}

				// Only rename if the path has actually changed
				if (original.path !== modified.path) {
					await app.fileManager.renameFile(currentFile, modified.path);
				}

				// Update snooze information if it has changed
				const snoozeChanged =
					original.snoozeInfo.interval !== modified.snoozeInfo.interval ||
					original.snoozeInfo.expireTime !== modified.snoozeInfo.expireTime;

				if (snoozeChanged) {
					// Get the file after potential rename - use modified.path since the file may have been renamed
					const targetFile = app.vault.getAbstractFileByPath(modified.path) as TFile;

					if (!targetFile) {
						console.error("File to update snooze info not found:", modified.path);
						return;
					}

					if (modified.snoozeInfo.interval && modified.snoozeInfo.expireTime) {
						// Set new snooze information
						await setSnoozeEntry(app, targetFile, modified.snoozeInfo.interval, modified.snoozeInfo.expireTime);
					} else {
						// Clear snooze information
						await clearSnoozeEntry(app, targetFile);
					}
				}
			},
			onInsert: async ({ transaction }) => {
				const newItem = transaction.mutations[0].modified;
				await app.vault.create(newItem.path, "");
				await setSnoozeEntry(
					app,
					app.vault.getAbstractFileByPath(newItem.path) as TFile,
					newItem.snoozeInfo.interval!,
					newItem.snoozeInfo.expireTime!
				);
			},
			onDelete: async ({ transaction }) => {
				const mutation = transaction.mutations[0];
				const file = app.vault.getAbstractFileByPath(mutation.original.path);
				if (file) {
					await app.vault.trash(file, false);
					console.log("Deleted file:", mutation.original.path);
				}
			},
		})
	);
}
