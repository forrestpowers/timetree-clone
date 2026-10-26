import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { isHexColor } from '#lib/palette.js';
import { logActivity, removeMember, requireMember, requireOwner } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import {
	CALENDAR_PURPOSES,
	MEMBER_ATTRIBUTES,
	calendarMembers,
	calendars,
	files
} from '#lib/server/db/schema.js';
import { deleteStoredFile } from '#lib/server/files.js';
import type { RequestHandler } from './$types';

const patchSchema = z.object({
	// Shared calendar settings
	name: z.string().trim().min(1).max(50).optional(),
	description: z.string().max(500).optional(),
	purpose: z.enum(CALENDAR_PURPOSES).optional(),
	coverFileId: z.string().nullable().optional(),
	background: z
		.union([
			z.object({ type: z.literal('none') }),
			z.object({ type: z.literal('color'), color: z.string().refine(isHexColor) }),
			z.object({ type: z.literal('image'), fileId: z.string() })
		])
		.optional(),
	// The caller's own preferences and calendar profile
	visible: z.boolean().optional(),
	showMemberBirthdays: z.boolean().optional(),
	defaultView: z.enum(['month', 'week', 'list', 'day', 'three_day']).optional(),
	notifyMode: z.enum(['all', 'attending', 'summary', 'off']).optional(),
	notifySummaryTime: z
		.string()
		.regex(/^\d{2}:\d{2}$/)
		.optional(),
	useCalendarProfile: z.boolean().optional(),
	profileName: z.string().trim().max(50).optional(),
	profileAvatarFileId: z.string().nullable().optional(),
	attribute: z.enum(MEMBER_ATTRIBUTES).nullable().optional()
});

/** Uploaded images may only be attached by the person who uploaded them. */
function ownFile(fileId: string | null | undefined, userId: string, kinds: string[]) {
	if (!fileId) return;
	const file = db.select().from(files).where(eq(files.id, fileId)).get();
	if (!file || file.ownerUserId !== userId || !kinds.includes(file.kind))
		error(400, 'Unknown file');
}

export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	const user = locals.user!;
	const member = requireMember(user.id, params.id);
	const parsed = patchSchema.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid input');
	const p = parsed.data;

	const calendar = db.select().from(calendars).where(eq(calendars.id, params.id)).get()!;
	const calendarPatch: Partial<typeof calendars.$inferInsert> = {};
	if (p.name !== undefined) calendarPatch.name = p.name;
	if (p.description !== undefined) calendarPatch.description = p.description;
	if (p.purpose !== undefined) calendarPatch.purpose = p.purpose;
	if (p.coverFileId !== undefined) {
		ownFile(p.coverFileId, user.id, ['cover']);
		calendarPatch.coverFileId = p.coverFileId;
	}
	if (p.background !== undefined) {
		if (p.background.type === 'image') ownFile(p.background.fileId, user.id, ['background']);
		calendarPatch.background = p.background;
	}

	const memberPatch: Partial<typeof calendarMembers.$inferInsert> = {};
	for (const key of [
		'visible',
		'showMemberBirthdays',
		'defaultView',
		'notifyMode',
		'notifySummaryTime',
		'useCalendarProfile',
		'profileName',
		'attribute'
	] as const) {
		if (p[key] !== undefined) Object.assign(memberPatch, { [key]: p[key] });
	}
	if (p.profileAvatarFileId !== undefined) {
		ownFile(p.profileAvatarFileId, user.id, ['avatar']);
		memberPatch.profileAvatarFileId = p.profileAvatarFileId;
	}

	db.transaction((tx) => {
		if (Object.keys(calendarPatch).length) {
			tx.update(calendars).set(calendarPatch).where(eq(calendars.id, params.id)).run();
			logActivity(tx, params.id, member.id, 'calendar_updated', {
				fields: Object.keys(calendarPatch)
			});
		}
		if (Object.keys(memberPatch).length) {
			tx.update(calendarMembers).set(memberPatch).where(eq(calendarMembers.id, member.id)).run();
		}
	});

	// Clean up replaced images
	if (p.coverFileId !== undefined && calendar.coverFileId !== p.coverFileId)
		await deleteStoredFile(calendar.coverFileId);
	if (
		p.background !== undefined &&
		calendar.background.type === 'image' &&
		(p.background.type !== 'image' || p.background.fileId !== calendar.background.fileId)
	) {
		await deleteStoredFile(calendar.background.fileId);
	}
	if (p.profileAvatarFileId !== undefined && member.profileAvatarFileId !== p.profileAvatarFileId) {
		await deleteStoredFile(member.profileAvatarFileId);
	}
	return json({ ok: true });
};

/** Delete the calendar for everyone (owner only). */
export const DELETE: RequestHandler = ({ params, locals }) => {
	requireOwner(locals.user!.id, params.id);
	db.update(calendars).set({ deletedAt: Date.now() }).where(eq(calendars.id, params.id)).run();
	return json({ ok: true });
};

/** Leave the calendar, or (owner only) remove another member: POST { action: 'leave' | 'remove', memberId? } */
export const POST: RequestHandler = async ({ params, locals, request }) => {
	const body = z
		.object({ action: z.enum(['leave', 'remove']), memberId: z.string().optional() })
		.safeParse(await request.json());
	if (!body.success) error(400, 'Invalid input');
	const me = requireMember(locals.user!.id, params.id);
	if (body.data.action === 'leave') {
		removeMember(params.id, me.id, me.id);
	} else {
		if (me.role !== 'owner') error(403, 'Only the calendar owner can remove members');
		if (!body.data.memberId || body.data.memberId === me.id) error(400, 'Invalid member');
		const target = db
			.select()
			.from(calendarMembers)
			.where(
				and(eq(calendarMembers.id, body.data.memberId), eq(calendarMembers.calendarId, params.id))
			)
			.get();
		if (!target) error(404, 'Member not found');
		removeMember(params.id, target.id, me.id);
	}
	return json({ ok: true });
};
