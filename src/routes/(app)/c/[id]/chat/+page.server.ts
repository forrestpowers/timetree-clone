import { getCalendar, listMembers, requireMember } from '#lib/server/calendars.js';
import { loadChat } from '#lib/server/chat.js';
import { markRead } from '#lib/server/feed.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, url, depends }) => {
	// The chat also shows event and memo changes between messages
	depends('app:chat', 'app:events', 'app:memos');
	const member = requireMember(locals.user!.id, params.id);
	const before = Number(url.searchParams.get('before')) || null;
	const chat = loadChat(member, before);
	if (!before) markRead(member.id, 'chat');
	return {
		calendar: getCalendar(locals.user!.id, params.id),
		members: listMembers([params.id], locals.user!.id),
		...chat,
		before
	};
};
