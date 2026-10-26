import { json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { deleteMessage } from '#lib/server/chat.js';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = ({ params, locals }) => {
	deleteMessage(requireMember(locals.user!.id, params.id), params.messageId);
	return json({ ok: true });
};
