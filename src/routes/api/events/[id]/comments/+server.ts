import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { addComment } from '#lib/server/comments.js';
import { loadEvent } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

const schema = z.object({
	body: z.string().max(4000).default(''),
	fileIds: z.array(z.string()).max(10).default([])
});

/** Post a comment on an event: { body, fileIds } (image ids from /api/upload, kind "comment"). */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const { event, member } = loadEvent(params.id, locals.user!.id);
	const body = schema.safeParse(await request.json());
	if (!body.success) error(400, 'Invalid input');
	addComment(member, locals.user!.id, event, body.data.body, body.data.fileIds);
	return json({ ok: true });
};
