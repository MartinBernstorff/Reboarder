import { TFolder } from "obsidian";
import { FileNameSchema, EpochMsSchema, FilePathSchema } from "./model/brands";
import { createFileCollection } from "./model/fileCollection";

export class Notes {
    static createNew(
        folder: TFolder,
        fileCollection: ReturnType<typeof createFileCollection>
    ) {
        const baseName = 'New Note';
        let fileName = `${baseName}.md`;
        let idx = 1;
        while (fileCollection.has(FileNameSchema.parse(fileName))) {
            fileName = `${baseName} ${idx}.md`;
            idx++;
        }

        const record = {
            name: FileNameSchema.parse(fileName),
            mtime: EpochMsSchema.parse(Date.now()),
            path: FilePathSchema.parse((folder.path + '/' + fileName)),
            snoozeInfo: { expireTime: undefined }
        };
        fileCollection.insert(record);
        return record;
    }
}