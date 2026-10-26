import { error, json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { getMemo, memoToEvent, scheduleInput } from '#lib/server/memos.js';
import type { RequestHandler } from './$types';

/** Turn a memo into an event: { allDay, date, startTime?, endTime?, tz } */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const memo = getMemo(params.id);
	const member = requireMember(locals.user!.id, memo.calendarId);
	const parsed = scheduleInput.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid date');
	memoToEvent(member, memo, parsed.data);
	return json({ id: memo.id });
};
