import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db/index.js';
import { files, users } from '#lib/server/db/schema.js';
import { deleteStoredFile } from '#lib/server/files.js';
import type { RequestHandler } from './$types';

const schema = z.object({
	name: z.string().trim().min(1, 'Enter your name.').max(50).optional(),
	birthday: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable()
		.optional(),
	showBirthday: z.boolean().optional(),
	statusText: z.string().trim().max(100).optional(),
	avatarFileId: z.string().nullable().optional()
});

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const user = locals.user!;
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid input');
	const p = parsed.data;
	if (p.avatarFileId) {
		const file = db.select().from(files).where(eq(files.id, p.avatarFileId)).get();
		if (!file || file.ownerUserId !== user.id || file.kind !== 'avatar') error(400, 'Unknown file');
	}
	db.update(users).set(p).where(eq(users.id, user.id)).run();
	if (p.avatarFileId !== undefined && user.avatarFileId && user.avatarFileId !== p.avatarFileId) {
		await deleteStoredFile(user.avatarFileId);
	}
	return json({ ok: true });
};
