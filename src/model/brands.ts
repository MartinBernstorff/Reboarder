import { z } from 'zod';

/** Vault-relative file path (e.g. "folder/note.md") */
export const FilePathSchema = z.string().brand('FilePath');
export type FilePath = z.infer<typeof FilePathSchema>;

/** File name with extension (e.g. "note.md") */
export const FileNameSchema = z.string().brand('FileName');
export type FileName = z.infer<typeof FileNameSchema>;

/** Unix timestamp in milliseconds */
export const EpochMsSchema = z.number().brand('EpochMs');
export type EpochMs = z.infer<typeof EpochMsSchema>;

/** Date for snooze expiration */
export const ExpireTimeSchema = z.coerce.date().brand('ExpireTime');
export type ExpireTime = z.infer<typeof ExpireTimeSchema>;
