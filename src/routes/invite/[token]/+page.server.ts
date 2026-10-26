import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { findInvite, joinCalendar, listMembers } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { calendarMembers, users } from '#lib/server/db/schema.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const found = findInvite(params.token);
	if (!found) return { valid: false as const };
	const { invite, calendar } = found;

	const members = listMembers([calendar.id], locals.user?.id ?? '');
	const inviter = invite.createdByUserId
		? db.select({ name: users.name }).from(users).where(eq(users.id, invite.createdByUserId)).get()
		: null;
	const alreadyMember = locals.user
		? !!db
				.select()
				.from(calendarMembers)
				.where(
					and(
						eq(calendarMembers.calendarId, calendar.id),
						eq(calendarMembers.userId, locals.user.id),
						isNull(calendarMembers.removedAt)
					)
				)
				.get()
		: false;

	return {
		valid: true as const,
		calendar: {
			id: calendar.id,
			name: calendar.name,
			coverFileId: calendar.coverFileId,
			purpose: calendar.purpose
		},
		inviterName: inviter?.name ?? '',
		expiresAt: invite.expiresAt,
		// Only show who's in the calendar to signed-in people
		members: locals.user
			? members.map((m) => ({ id: m.id, name: m.name, avatarFileId: m.avatarFileId }))
			: [],
		memberCount: members.length,
		alreadyMember,
		me: locals.user ? { name: locals.user.name, avatarFileId: locals.user.avatarFileId } : null
	};
};

export const actions: Actions = {
	default: async ({ params, locals, request }) => {
		if (!locals.user) redirect(303, `/login?next=/invite/${params.token}`);
		const found = findInvite(params.token);
		if (!found) error(400, 'This invitation has expired.');
		const form = await request.formData();
		const useCalendarProfile = form.get('profile') === 'calendar';
		const profileName = String(form.get('profileName') ?? '')
			.trim()
			.slice(0, 50);
		if (useCalendarProfile && !profileName)
			return fail(400, { message: 'Enter the name to use in this calendar.' });
		joinCalendar(locals.user.id, found.calendar.id, { useCalendarProfile, profileName });
		redirect(303, `/c/${found.calendar.id}?joined=1`);
	}
};
