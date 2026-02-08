import { TFolder } from "obsidian";
import { FileNameSchema, EpochMsSchema, FilePathSchema } from "./model/brands";
import { createFileCollection } from "./model/fileCollection";

export class Notes {
    static createNewNote(
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

        fileCollection.insert({
            name: FileNameSchema.parse(fileName),
            mtime: EpochMsSchema.parse(Date.now()),
            path: FilePathSchema.parse((folder.path + '/' + fileName)),
            snoozeInfo: { expireTime: undefined }
        });
    }
}