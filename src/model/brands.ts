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

/** Snooze duration in hours */
export const SnoozeIntervalHoursSchema = z.number().brand('SnoozeIntervalHours');
export type SnoozeIntervalHours = z.infer<typeof SnoozeIntervalHoursSchema>;

/** ISO datetime string for snooze expiration */
export const ExpireTimeSchema = z.iso.datetime().brand('ExpireTime');
export type ExpireTime = z.infer<typeof ExpireTimeSchema>;
