import { getCalendar, listLabels, listMembers } from '#lib/server/calendars.js';
import { listComments } from '#lib/server/comments.js';
import { markRead } from '#lib/server/feed.js';
import { getMemo } from '#lib/server/memos.js';
import { reactionsFor } from '#lib/server/reactions.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, depends }) => {
	depends('app:event', 'app:memos');
	const memo = getMemo(params.id);
	const calendar = getCalendar(locals.user!.id, memo.calendarId);
	const mine = new Set([calendar.me.memberId]);
	markRead(calendar.me.memberId, `event:${memo.id}`);
	return {
		memo,
		calendar,
		labels: listLabels([memo.calendarId]),
		members: listMembers([memo.calendarId], locals.user!.id),
		comments: listComments([memo.id], mine),
		reactions: reactionsFor('event', [memo.id], mine).get(memo.id) ?? []
	};
};
