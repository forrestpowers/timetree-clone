import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { toggleReaction } from '#lib/server/reactions.js';
import type { RequestHandler } from './$types';

const schema = z.object({
	targetType: z.enum(['event', 'comment', 'chat']),
	targetId: z.string().min(1),
	emoji: z.string().min(1).max(16)
});

/** Toggle the caller's emoji reaction on an event, comment or chat message. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const body = schema.safeParse(await request.json());
	if (!body.success) error(400, 'Invalid input');
	const on = toggleReaction(
		locals.user!.id,
		body.data.targetType,
		body.data.targetId,
		body.data.emoji
	);
	return json({ on });
};
