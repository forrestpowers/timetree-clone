import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireMember } from '#lib/server/calendars.js';
import { sendMessage } from '#lib/server/chat.js';
import type { RequestHandler } from './$types';

const schema = z.object({
	body: z.string().max(4000).default(''),
	eventId: z.string().nullable().default(null)
});

/** Send a chat message ({ body }) or share an event into the chat ({ eventId, body? }). */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const member = requireMember(locals.user!.id, params.id);
	const body = schema.safeParse(await request.json());
	if (!body.success) error(400, 'Invalid input');
	const id = sendMessage(member, body.data.body, body.data.eventId);
	return json({ id });
};
