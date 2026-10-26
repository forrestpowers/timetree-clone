import { error } from '@sveltejs/kit';
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { LABEL_COLORS } from '#lib/palette.js';
import { randomToken } from '#lib/server/auth/crypto.js';
import { db } from '#lib/server/db/index.js';
import {
	activities,
	calendarMembers,
	calendars,
	invites,
	labels,
	users,
	virtualMembers,
	type ActivityType,
	type CalendarPurpose
} from '#lib/server/db/schema.js';
import type { ClientCalendar, ClientLabel, ClientMember, ClientVirtualMember } from '#lib/types.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | Tx;

export const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;
export const MAX_CALENDARS = 50;
export const MAX_MEMBERS = 100;
export const MAX_VIRTUAL_MEMBERS = 30;
export const MAX_LABELS = 30;

export type Member = typeof calendarMembers.$inferSelect;

/** The caller's membership, or 404 if they can't see this calendar. */
export function requireMember(userId: string, calendarId: string): Member {
	const row = db
		.select({ member: calendarMembers })
		.from(calendarMembers)
		.innerJoin(calendars, eq(calendars.id, calendarMembers.calendarId))
		.where(
			and(
				eq(calendarMembers.calendarId, calendarId),
				eq(calendarMembers.userId, userId),
				isNull(calendarMembers.removedAt),
				isNull(calendars.deletedAt)
			)
		)
		.get();
	if (!row) error(404, 'Calendar not found');
	return row.member;
}

export function requireOwner(userId: string, calendarId: string): Member {
	const member = requireMember(userId, calendarId);
	if (member.role !== 'owner') error(403, 'Only the calendar owner can do that');
	return member;
}

export function logActivity(
	tx: Db,
	calendarId: string,
	actorMemberId: string | null,
	type: ActivityType,
	data: Record<string, unknown> = {},
	eventId: string | null = null
) {
	tx.insert(activities).values({ calendarId, actorMemberId, type, data, eventId }).run();
}

export type NewLabel = { name: string; color: string; externalId?: number | null };

export function assertCanCreateCalendar(userId: string) {
	const count = db
		.select({ n: sql<number>`count(*)` })
		.from(calendarMembers)
		.where(and(eq(calendarMembers.userId, userId), isNull(calendarMembers.removedAt)))
		.get()!.n;
	if (count >= MAX_CALENDARS) error(400, 'You have reached the maximum number of calendars.');
}

/** Insert a calendar owned by `userId`, inside an existing transaction. */
export function insertCalendar(
	tx: Tx,
	userId: string,
	input: { name: string; purpose: CalendarPurpose },
	initialLabels: NewLabel[] = LABEL_COLORS.map((c) => ({ name: '', color: c.hex }))
) {
	const calendar = tx
		.insert(calendars)
		.values({ name: input.name, purpose: input.purpose, createdByUserId: userId })
		.returning()
		.get()!;
	const maxOrder =
		tx
			.select({ m: sql<number>`coalesce(max(sort_order), -1)` })
			.from(calendarMembers)
			.where(eq(calendarMembers.userId, userId))
			.get()?.m ?? -1;
	const member = tx
		.insert(calendarMembers)
		.values({ calendarId: calendar.id, userId, role: 'owner', sortOrder: maxOrder + 1 })
		.returning()
		.get()!;
	tx.insert(labels)
		.values(
			initialLabels.map((l, i) => ({
				calendarId: calendar.id,
				name: l.name,
				color: l.color,
				externalId: l.externalId ?? null,
				sortOrder: i
			}))
		)
		.run();
	logActivity(tx, calendar.id, member.id, 'member_joined');
	return { calendar, member };
}

export function createCalendar(userId: string, input: { name: string; purpose: CalendarPurpose }) {
	assertCanCreateCalendar(userId);
	return db.transaction((tx) => insertCalendar(tx, userId, input).calendar);
}

export function listUserCalendars(userId: string): ClientCalendar[] {
	const rows = db
		.select({ calendar: calendars, member: calendarMembers })
		.from(calendarMembers)
		.innerJoin(calendars, eq(calendars.id, calendarMembers.calendarId))
		.where(
			and(
				eq(calendarMembers.userId, userId),
				isNull(calendarMembers.removedAt),
				isNull(calendars.deletedAt)
			)
		)
		.orderBy(asc(calendarMembers.sortOrder), asc(calendarMembers.joinedAt))
		.all();
	const ids = rows.map((r) => r.calendar.id);
	const counts = ids.length
		? db
				.select({ calendarId: calendarMembers.calendarId, n: sql<number>`count(*)` })
				.from(calendarMembers)
				.where(and(inArray(calendarMembers.calendarId, ids), isNull(calendarMembers.removedAt)))
				.groupBy(calendarMembers.calendarId)
				.all()
		: [];
	const countBy = new Map(counts.map((c) => [c.calendarId, c.n]));
	return rows.map(({ calendar, member }) =>
		toClientCalendar(calendar, member, countBy.get(calendar.id) ?? 1)
	);
}

export function toClientCalendar(
	calendar: typeof calendars.$inferSelect,
	member: Member,
	memberCount: number
): ClientCalendar {
	return {
		id: calendar.id,
		name: calendar.name,
		description: calendar.description,
		purpose: calendar.purpose,
		coverFileId: calendar.coverFileId,
		background: calendar.background,
		chatEnabled: calendar.chatEnabled,
		memberCount,
		me: {
			memberId: member.id,
			role: member.role,
			visible: member.visible,
			useCalendarProfile: member.useCalendarProfile,
			sortOrder: member.sortOrder,
			showMemberBirthdays: member.showMemberBirthdays,
			defaultView: member.defaultView,
			lastLabelId: member.lastLabelId,
			notifyMode: member.notifyMode,
			notifySummaryTime: member.notifySummaryTime
		}
	};
}

export function getCalendar(userId: string, calendarId: string): ClientCalendar {
	const member = requireMember(userId, calendarId);
	const calendar = db.select().from(calendars).where(eq(calendars.id, calendarId)).get()!;
	const n = db
		.select({ n: sql<number>`count(*)` })
		.from(calendarMembers)
		.where(and(eq(calendarMembers.calendarId, calendarId), isNull(calendarMembers.removedAt)))
		.get()!.n;
	return toClientCalendar(calendar, member, n);
}

export function listMembers(calendarIds: string[], viewerUserId: string): ClientMember[] {
	if (!calendarIds.length) return [];
	const rows = db
		.select({ member: calendarMembers, user: users })
		.from(calendarMembers)
		.innerJoin(users, eq(users.id, calendarMembers.userId))
		.where(and(inArray(calendarMembers.calendarId, calendarIds), isNull(calendarMembers.removedAt)))
		.orderBy(asc(calendarMembers.joinedAt))
		.all();
	return rows.map(({ member, user }) => ({
		id: member.id,
		calendarId: member.calendarId,
		userId: user.id,
		name:
			(member.useCalendarProfile && member.profileName) || user.name || user.email.split('@')[0],
		avatarFileId: (member.useCalendarProfile && member.profileAvatarFileId) || user.avatarFileId,
		role: member.role,
		attribute: member.attribute,
		birthday: user.showBirthday ? user.birthday : null,
		statusText: user.statusText,
		isMe: user.id === viewerUserId,
		lastAccessedAt: member.lastAccessedAt,
		joinedAt: member.joinedAt
	}));
}

export function listVirtualMembers(calendarIds: string[]): ClientVirtualMember[] {
	if (!calendarIds.length) return [];
	return db
		.select()
		.from(virtualMembers)
		.where(and(inArray(virtualMembers.calendarId, calendarIds), isNull(virtualMembers.deletedAt)))
		.orderBy(asc(virtualMembers.createdAt))
		.all()
		.map((v) => ({
			id: v.id,
			calendarId: v.calendarId,
			preset: v.preset,
			name: v.name,
			avatarFileId: v.avatarFileId,
			birthday: v.birthday,
			showBirthday: v.showBirthday,
			statusText: v.statusText
		}));
}

export function listLabels(calendarIds: string[]): ClientLabel[] {
	if (!calendarIds.length) return [];
	return db
		.select({
			id: labels.id,
			calendarId: labels.calendarId,
			name: labels.name,
			color: labels.color,
			sortOrder: labels.sortOrder
		})
		.from(labels)
		.where(inArray(labels.calendarId, calendarIds))
		.orderBy(asc(labels.sortOrder))
		.all();
}

export function touchMember(memberId: string) {
	db.update(calendarMembers)
		.set({ lastAccessedAt: Date.now() })
		.where(eq(calendarMembers.id, memberId))
		.run();
}

/** Returns the current invite link token, creating one if none is valid. */
export function currentInvite(calendarId: string, userId: string, regenerate = false) {
	if (regenerate) {
		db.update(invites)
			.set({ revokedAt: Date.now() })
			.where(and(eq(invites.calendarId, calendarId), isNull(invites.revokedAt)))
			.run();
	}
	const live = db
		.select()
		.from(invites)
		.where(
			and(
				eq(invites.calendarId, calendarId),
				isNull(invites.revokedAt),
				gt(invites.expiresAt, Date.now())
			)
		)
		.orderBy(sql`${invites.expiresAt} desc`)
		.get();
	// Hand out a fresh link once the current one is past half its life
	if (live && live.expiresAt - Date.now() > INVITE_TTL / 2) return live;
	return db
		.insert(invites)
		.values({
			calendarId,
			token: randomToken(18),
			createdByUserId: userId,
			expiresAt: Date.now() + INVITE_TTL
		})
		.returning()
		.get();
}

export function findInvite(token: string) {
	const row = db
		.select({ invite: invites, calendar: calendars })
		.from(invites)
		.innerJoin(calendars, eq(calendars.id, invites.calendarId))
		.where(and(eq(invites.token, token), isNull(invites.revokedAt), isNull(calendars.deletedAt)))
		.get();
	if (!row || row.invite.expiresAt < Date.now()) return null;
	return row;
}

export function joinCalendar(
	userId: string,
	calendarId: string,
	profile: {
		useCalendarProfile: boolean;
		profileName?: string;
		profileAvatarFileId?: string | null;
	}
) {
	return db.transaction((tx) => {
		const existing = tx
			.select()
			.from(calendarMembers)
			.where(and(eq(calendarMembers.calendarId, calendarId), eq(calendarMembers.userId, userId)))
			.get();
		if (existing && !existing.removedAt) return existing;

		const count = tx
			.select({ n: sql<number>`count(*)` })
			.from(calendarMembers)
			.where(and(eq(calendarMembers.calendarId, calendarId), isNull(calendarMembers.removedAt)))
			.get()!.n;
		if (count >= MAX_MEMBERS) error(400, 'This calendar has reached its member limit.');

		const maxOrder =
			tx
				.select({ m: sql<number>`coalesce(max(sort_order), -1)` })
				.from(calendarMembers)
				.where(eq(calendarMembers.userId, userId))
				.get()?.m ?? -1;
		const values = {
			role: 'member' as const,
			useCalendarProfile: profile.useCalendarProfile,
			profileName: profile.profileName ?? '',
			profileAvatarFileId: profile.profileAvatarFileId ?? null,
			sortOrder: maxOrder + 1,
			joinedAt: Date.now(),
			removedAt: null,
			visible: true
		};
		const member = existing
			? tx
					.update(calendarMembers)
					.set(values)
					.where(eq(calendarMembers.id, existing.id))
					.returning()
					.get()
			: tx
					.insert(calendarMembers)
					.values({ calendarId, userId, ...values })
					.returning()
					.get();
		if (!member) throw new Error('Could not join calendar');
		logActivity(tx, calendarId, member.id, 'member_joined');
		return member;
	});
}

/** Leaving or being removed. The calendar is deleted when nobody is left. */
export function removeMember(calendarId: string, memberId: string, actorMemberId: string) {
	db.transaction((tx) => {
		const member = tx.select().from(calendarMembers).where(eq(calendarMembers.id, memberId)).get();
		if (!member || member.removedAt || member.calendarId !== calendarId)
			error(404, 'Member not found');
		tx.update(calendarMembers)
			.set({ removedAt: Date.now(), role: 'member' })
			.where(eq(calendarMembers.id, memberId))
			.run();
		logActivity(
			tx,
			calendarId,
			actorMemberId,
			memberId === actorMemberId ? 'member_left' : 'member_removed',
			{
				memberId
			}
		);

		const remaining = tx
			.select()
			.from(calendarMembers)
			.where(and(eq(calendarMembers.calendarId, calendarId), isNull(calendarMembers.removedAt)))
			.orderBy(asc(calendarMembers.joinedAt))
			.all();
		if (!remaining.length) {
			tx.update(calendars).set({ deletedAt: Date.now() }).where(eq(calendars.id, calendarId)).run();
		} else if (member.role === 'owner' && !remaining.some((m) => m.role === 'owner')) {
			tx.update(calendarMembers)
				.set({ role: 'owner' })
				.where(eq(calendarMembers.id, remaining[0].id))
				.run();
		}
	});
}

export function reorderCalendars(userId: string, calendarIds: string[]) {
	db.transaction((tx) => {
		calendarIds.forEach((calendarId, i) => {
			tx.update(calendarMembers)
				.set({ sortOrder: i })
				.where(and(eq(calendarMembers.userId, userId), eq(calendarMembers.calendarId, calendarId)))
				.run();
		});
	});
}
