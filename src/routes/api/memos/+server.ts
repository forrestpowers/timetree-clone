import { error, json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { createMemo, memoInput } from '#lib/server/memos.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	const parsed = memoInput.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid memo');
	const member = requireMember(locals.user!.id, parsed.data.calendarId);
	return json({ id: createMemo(member, locals.user!.id, parsed.data) });
};
