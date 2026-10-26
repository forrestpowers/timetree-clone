import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db/index.js';
import { VIRTUAL_PRESETS, files } from '#lib/server/db/schema.js';

export const virtualMemberSchema = z.object({
	preset: z.enum(VIRTUAL_PRESETS),
	name: z.string().trim().min(1, 'Enter a name.').max(50),
	avatarFileId: z.string().nullable().default(null),
	birthday: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.default(null),
	showBirthday: z.boolean().default(false),
	statusText: z.string().trim().max(100).default('')
});

export function checkAvatar(fileId: string | null | undefined, userId: string) {
	if (!fileId) return;
	const file = db.select().from(files).where(eq(files.id, fileId)).get();
	if (!file || file.ownerUserId !== userId || file.kind !== 'avatar') error(400, 'Unknown file');
}
