import { z } from 'zod';
import { FilePathSchema, FileNameSchema, EpochMsSchema, SnoozeIntervalHoursSchema, ExpireTimeSchema } from 'src/model/brands';
import { type ExpireTime } from 'src/model/brands';
import { parseISODateTime } from 'src/snooze/snooze';

const SnoozeInfoSchema = z.object({
	interval: SnoozeIntervalHoursSchema.optional(),
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
	return !!(record.snoozeInfo.expireTime && Date.now() < parseISODateTime(record.snoozeInfo.expireTime).getTime());
}

export function getFileRecordRemainingHours(record: FileRecord): number | undefined {
	if (!record.snoozeInfo.expireTime || !isSnoozed(record)) {
		return undefined;
	}
	const remainingMs = parseISODateTime(record.snoozeInfo.expireTime).getTime() - Date.now();
	return Math.ceil(remainingMs / (60 * 60 * 1000));
}
