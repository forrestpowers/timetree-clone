import { error, json } from '@sveltejs/kit';
import { deleteComment, editComment } from '#lib/server/comments.js';
import { loadEvent } from '#lib/server/events.js';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const { member } = loadEvent(params.id, locals.user!.id);
	const body = await request.json().catch(() => null);
	if (typeof body?.body !== 'string') error(400, 'Invalid input');
	editComment(member, params.commentId, body.body);
	return json({ ok: true });
};

export const DELETE: RequestHandler = ({ params, locals }) => {
	const { member } = loadEvent(params.id, locals.user!.id);
	deleteComment(member, params.commentId);
	return json({ ok: true });
};
