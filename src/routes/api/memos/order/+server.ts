import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireMember } from '#lib/server/calendars.js';
import { reorderMemos } from '#lib/server/memos.js';
import type { RequestHandler } from './$types';

/** { calendarId, ids } in the new order */
export const PUT: RequestHandler = async ({ locals, request }) => {
	const body = z
		.object({ calendarId: z.string(), ids: z.array(z.string()).max(1000) })
		.safeParse(await request.json());
	if (!body.success) error(400, 'Invalid input');
	reorderMemos(requireMember(locals.user!.id, body.data.calendarId), body.data.ids);
	return json({ ok: true });
};
