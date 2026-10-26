import { mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { DATA_DIR } from '$app/env/private';
import { db } from '#lib/server/db/index.js';
import { files } from '#lib/server/db/schema.js';

const FILES_DIR = path.join(DATA_DIR, 'files');
mkdirSync(FILES_DIR, { recursive: true });

type Kind = (typeof files.$inferSelect)['kind'];

export const IMAGE_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/heic',
	'image/heif'
];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const filePath = (id: string) => path.join(FILES_DIR, id);

/** Store an uploaded image (avatar, cover, background). Images are resized in the browser first. */
export async function saveImage(
	file: File,
	kind: Extract<Kind, 'avatar' | 'cover' | 'background'>,
	ownerUserId: string,
	calendarId: string | null = null
): Promise<string> {
	if (!IMAGE_TYPES.includes(file.type)) error(400, 'Files with this format are not supported.');
	if (file.size > MAX_IMAGE_BYTES) error(400, 'The image is too large.');
	const id = crypto.randomUUID();
	await writeFile(filePath(id), Buffer.from(await file.arrayBuffer()));
	db.insert(files)
		.values({
			id,
			kind,
			mime: file.type,
			size: file.size,
			ownerUserId,
			calendarId,
			originalName: file.name.slice(0, 200)
		})
		.run();
	return id;
}

export async function readStoredFile(id: string) {
	const row = db.select().from(files).where(eq(files.id, id)).get();
	if (!row) return null;
	try {
		return { row, data: await readFile(filePath(id)) };
	} catch {
		return null;
	}
}

export async function deleteStoredFile(id: string | null | undefined) {
	if (!id) return;
	db.delete(files).where(eq(files.id, id)).run();
	await unlink(filePath(id)).catch(() => {});
}
