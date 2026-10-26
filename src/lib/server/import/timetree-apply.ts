import { error } from '@sveltejs/kit';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import {
	assertCanCreateCalendar,
	insertCalendar,
	logActivity,
	requireMember
} from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import {
	eventAlerts,
	eventAttendees,
	events,
	labels,
	virtualMembers
} from '#lib/server/db/schema.js';
import type { ImportPlan } from './timetree-plan.js';

export type UserChoice = 'me' | 'virtual' | 'ignore';

export type ApplyOptions = {
	userId: string;
	target: { type: 'new'; name: string } | { type: 'existing'; calendarId: string };
	/** What each TimeTree user becomes. Unlisted users are ignored. */
	users: Record<string, UserChoice>;
	/** Names for TimeTree users that become virtual members */
	virtualNames?: Record<string, string>;
};

export type ApplyResult = {
	calendarId: string;
	imported: number;
	alreadyImported: number;
	virtualMembersCreated: number;
	labelsCreated: number;
};

const CHUNK = 400;

export function applyTimeTreeImport(plan: ImportPlan, opts: ApplyOptions): ApplyResult {
	if (opts.target.type === 'new') assertCanCreateCalendar(opts.userId);
	else requireMember(opts.userId, opts.target.calendarId);

	return db.transaction((tx) => {
		// ---- calendar and the importer's membership ----
		let calendarId: string;
		let myMemberId: string;
		let labelsCreated = 0;
		if (opts.target.type === 'new') {
			const name = opts.target.name.trim().slice(0, 50) || plan.source.name;
			const initial = plan.labels.length
				? plan.labels.map((l) => ({ name: l.name, color: l.color, externalId: l.externalId }))
				: undefined;
			const { calendar, member } = insertCalendar(
				tx,
				opts.userId,
				{ name, purpose: 'other' },
				initial
			);
			calendarId = calendar.id;
			myMemberId = member.id;
			labelsCreated = plan.labels.length;
		} else {
			calendarId = opts.target.calendarId;
			myMemberId = requireMember(opts.userId, calendarId).id;
		}

		// ---- labels: TimeTree label id -> our label id ----
		const existingLabels = tx.select().from(labels).where(eq(labels.calendarId, calendarId)).all();
		const labelMap = new Map<number, string>();
		for (const l of plan.labels) {
			const match =
				existingLabels.find((x) => x.externalId === l.externalId) ??
				existingLabels.find((x) => x.color.toLowerCase() === l.color.toLowerCase());
			if (match) {
				labelMap.set(l.externalId, match.id);
				if (match.externalId == null) {
					tx.update(labels).set({ externalId: l.externalId }).where(eq(labels.id, match.id)).run();
				}
			} else {
				const row = tx
					.insert(labels)
					.values({
						calendarId,
						name: l.name,
						color: l.color,
						externalId: l.externalId,
						sortOrder: existingLabels.length + labelsCreated
					})
					.returning({ id: labels.id })
					.get()!;
				labelMap.set(l.externalId, row.id);
				labelsCreated++;
			}
		}

		// ---- people: TimeTree user id -> attendee ----
		const people = new Map<string, { id: string; type: 'member' | 'virtual' }>();
		let virtualMembersCreated = 0;
		plan.users.forEach((u, i) => {
			const choice = opts.users[u.externalId] ?? 'ignore';
			if (choice === 'me') people.set(u.externalId, { id: myMemberId, type: 'member' });
			if (choice === 'virtual') {
				const name =
					(opts.virtualNames?.[u.externalId] ?? u.name).trim().slice(0, 50) ||
					`TimeTree member ${i + 1}`;
				const existing = tx
					.select()
					.from(virtualMembers)
					.where(
						and(
							eq(virtualMembers.calendarId, calendarId),
							eq(virtualMembers.name, name),
							isNull(virtualMembers.deletedAt)
						)
					)
					.get();
				const vid =
					existing?.id ??
					tx
						.insert(virtualMembers)
						.values({ calendarId, name, preset: 'other' })
						.returning({ id: virtualMembers.id })
						.get()!.id;
				if (!existing) virtualMembersCreated++;
				people.set(u.externalId, { id: vid, type: 'virtual' });
			}
		});

		// ---- events (idempotent by TimeTree UUID) ----
		const already = new Map(
			tx
				.select({ id: events.id, uuid: events.externalUuid })
				.from(events)
				.where(and(eq(events.calendarId, calendarId), isNotNull(events.externalUuid)))
				.all()
				.map((r) => [r.uuid!, r.id])
		);
		const fresh = plan.events.filter((e) => !already.has(e.externalUuid));
		const idByUuid = new Map(already);
		for (const e of fresh) idByUuid.set(e.externalUuid, crypto.randomUUID());

		for (let i = 0; i < fresh.length; i += CHUNK) {
			const chunk = fresh.slice(i, i + CHUNK);
			tx.insert(events)
				.values(
					chunk.map((e) => {
						const author = e.authorExternalId ? people.get(e.authorExternalId) : undefined;
						return {
							id: idByUuid.get(e.externalUuid)!,
							calendarId,
							kind: e.kind,
							title: e.title,
							allDay: e.allDay,
							startAt: e.startAt,
							endAt: e.endAt,
							startTz: e.startTz,
							endTz: e.endTz,
							locationName: e.locationName,
							locationLat: e.locationLat,
							locationLon: e.locationLon,
							url: e.url,
							note: e.note,
							labelId: e.labelExternalId != null ? (labelMap.get(e.labelExternalId) ?? null) : null,
							recurrence: e.recurrence,
							parentId: e.parentUuid ? (idByUuid.get(e.parentUuid) ?? null) : null,
							createdByMemberId: author?.type === 'member' ? author.id : null,
							externalUuid: e.externalUuid,
							createdAt: e.createdAt,
							updatedAt: e.updatedAt
						};
					})
				)
				.run();

			const attendeeRows = chunk.flatMap((e) => {
				const seen = new Set<string>();
				return e.attendeeExternalIds
					.map((x) => people.get(x))
					.filter((p) => p && !seen.has(p.id) && seen.add(p.id))
					.map((p) => ({
						eventId: idByUuid.get(e.externalUuid)!,
						attendeeId: p!.id,
						attendeeType: p!.type
					}));
			});
			if (attendeeRows.length) tx.insert(eventAttendees).values(attendeeRows).run();

			const alertRows = chunk.flatMap((e) =>
				e.alerts.map((m) => ({ eventId: idByUuid.get(e.externalUuid)!, minutesBefore: m }))
			);
			if (alertRows.length) tx.insert(eventAlerts).values(alertRows).run();
		}

		// Sanity check before committing: every planned event now exists exactly once
		const total = tx
			.select({ id: events.id })
			.from(events)
			.where(
				and(
					eq(events.calendarId, calendarId),
					inArray(
						events.externalUuid,
						plan.events.map((e) => e.externalUuid)
					)
				)
			)
			.all().length;
		if (total !== plan.events.length)
			error(500, `Import check failed: expected ${plan.events.length} events, found ${total}.`);

		if (fresh.length) {
			logActivity(tx, calendarId, myMemberId, 'calendar_updated', {
				imported: fresh.length,
				source: 'TimeTree',
				sourceName: plan.source.name
			});
		}

		return {
			calendarId,
			imported: fresh.length,
			alreadyImported: plan.events.length - fresh.length,
			virtualMembersCreated,
			labelsCreated
		};
	});
}
