import { App, TFile, TFolder } from "obsidian";
import { FileNameSchema, EpochMsSchema, FilePathSchema } from "./model/brands";
import { createFileCollection } from "./model/fileCollection";

export class Notes {
    static async createNew(
        folder: TFolder,
        fileCollection: ReturnType<typeof createFileCollection>,
        app: App
    ): Promise<TFile> {
        const baseName = 'New Note';
        let fileName = `${baseName}.md`;
        let idx = 1;
        while (fileCollection.has(FileNameSchema.parse(fileName)) ||
               app.vault.getAbstractFileByPath(folder.path + '/' + fileName)) {
            fileName = `${baseName} ${idx}.md`;
            idx++;
        }

        const path = folder.path + '/' + fileName;
        const tfile = await app.vault.create(path, "");

        const record = {
            name: FileNameSchema.parse(fileName),
            mtime: EpochMsSchema.parse(Date.now()),
            path: FilePathSchema.parse(path),
            snoozeInfo: { expireTime: undefined }
        };
        fileCollection.insert(record);
        return tfile;
    }
}