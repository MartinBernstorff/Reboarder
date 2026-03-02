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
	const isSnoozed = !!record.snoozeInfo.expireTime;
	if (isSnoozed) {
		console.log(`File ${record.path} is snoozed until ${record.snoozeInfo.expireTime}`);
		return true;
	}
	return false;
}

export function getFileRecordRemainingHours(record: FileRecord): number | undefined {
	if (!record.snoozeInfo.expireTime || !isSnoozed(record)) {
		return undefined;
	}
	const remainingMs = record.snoozeInfo.expireTime.getTime() - Date.now();
	return Math.ceil(remainingMs / (60 * 60 * 1000));
}
