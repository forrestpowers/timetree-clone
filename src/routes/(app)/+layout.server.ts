import { error } from '@sveltejs/kit';
import { listUserCalendars } from '#lib/server/calendars.js';
import { unreadCounts } from '#lib/server/feed.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, depends }) => {
	if (!locals.user) error(401);
	depends('app:calendars', 'app:feed', 'app:memos', 'app:unread');
	const calendars = listUserCalendars(locals.user.id);
	return { calendars, unread: unreadCounts(calendars) };
};
