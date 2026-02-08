import { z } from 'zod';
import { FilePathSchema, FileNameSchema, EpochMsSchema, ExpireTimeSchema } from 'src/model/brands';

const SnoozeInfoSchema = z.object({
	expireTime: ExpireTimeSchema.optional(),
});

export const FileRecordSchema = z.object({
	path: FilePathSchema,
	name: FileNameSchema,
	mtime: EpochMsSchema,
	snoozeInfo: SnoozeInfoSchema,
});

export type FileRecord = z.infer<typeof FileRecordSchema>;

export function isSnoozed(record: FileRecord): boolean {
	return !!(record.snoozeInfo.expireTime && Date.now() < record.snoozeInfo.expireTime.getTime());
}

export function getFileRecordRemainingHours(record: FileRecord): number | undefined {
	if (!record.snoozeInfo.expireTime || !isSnoozed(record)) {
		return undefined;
	}
	const remainingMs = record.snoozeInfo.expireTime.getTime() - Date.now();
	return Math.ceil(remainingMs / (60 * 60 * 1000));
}
