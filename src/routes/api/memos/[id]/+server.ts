import { error, json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { deleteMemo, getMemo, memoInput, updateMemo } from '#lib/server/memos.js';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const memo = getMemo(params.id);
	const member = requireMember(locals.user!.id, memo.calendarId);
	const parsed = memoInput.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid memo');
	if (parsed.data.calendarId !== memo.calendarId)
		error(400, 'Memos cannot move between calendars.');
	await updateMemo(member, locals.user!.id, memo, parsed.data);
	return json({ id: memo.id });
};

export const DELETE: RequestHandler = ({ params, locals }) => {
	const memo = getMemo(params.id);
	deleteMemo(requireMember(locals.user!.id, memo.calendarId), memo);
	return json({ ok: true });
};
