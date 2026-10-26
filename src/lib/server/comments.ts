import { error } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { logActivity, type Member } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { activities, files } from '#lib/server/db/schema.js';
import { publish } from '#lib/server/live.js';
import { reactionsFor } from '#lib/server/reactions.js';
import type { ClientEvent, ReactionSummary } from '#lib/types.js';

export const MAX_COMMENT_LENGTH = 2000;
export const MAX_COMMENT_IMAGES = 4;

export type ClientComment = {
	id: string;
	memberId: string | null;
	body: string;
	fileIds: string[];
	createdAt: number;
	editedAt: number | null;
	reactions: ReactionSummary[];
};

function checkImages(fileIds: string[], userId: string, calendarId: string) {
	if (fileIds.length > MAX_COMMENT_IMAGES)
		error(400, `Up to ${MAX_COMMENT_IMAGES} images per comment.`);
	if (!fileIds.length) return;
	const rows = db.select().from(files).where(inArray(files.id, fileIds)).all();
	for (const id of fileIds) {
		const f = rows.find((r) => r.id === id);
		if (!f || f.kind !== 'comment' || f.ownerUserId !== userId || f.calendarId !== calendarId)
			error(400, 'Unknown image');
	}
}

export function addComment(
	member: Member,
	userId: string,
	event: ClientEvent,
	body: string,
	fileIds: string[]
) {
	const text = body.trim().slice(0, MAX_COMMENT_LENGTH);
	if (!text && !fileIds.length) error(400, 'Write a comment first.');
	checkImages(fileIds, userId, event.calendarId);
	db.transaction((tx) => {
		logActivity(
			tx,
			event.calendarId,
			member.id,
			'comment',
			{ body: text, fileIds, title: event.title },
			event.id
		);
	});
}

function findComment(commentId: string) {
	const row = db
		.select()
		.from(activities)
		.where(
			and(
				eq(activities.id, commentId),
				eq(activities.type, 'comment'),
				isNull(activities.deletedAt)
			)
		)
		.get();
	if (!row) error(404, 'Comment not found');
	return row;
}

export function editComment(member: Member, commentId: string, body: string) {
	const row = findComment(commentId);
	if (row.calendarId !== member.calendarId || row.actorMemberId !== member.id)
		error(403, 'You can only edit your own comments.');
	const text = body.trim().slice(0, MAX_COMMENT_LENGTH);
	if (!text) error(400, 'Comments cannot be empty.');
	db.update(activities)
		.set({ data: { ...row.data, body: text, editedAt: Date.now() } })
		.where(eq(activities.id, commentId))
		.run();
	publish({
		calendarId: row.calendarId,
		kinds: ['event', 'feed'],
		eventId: row.eventId,
		actorMemberId: member.id
	});
}

export function deleteComment(member: Member, commentId: string) {
	const row = findComment(commentId);
	if (row.calendarId !== member.calendarId) error(404, 'Comment not found');
	if (row.actorMemberId !== member.id && member.role !== 'owner')
		error(403, 'You can only delete your own comments.');
	db.update(activities).set({ deletedAt: Date.now() }).where(eq(activities.id, commentId)).run();
	publish({
		calendarId: row.calendarId,
		kinds: ['event', 'feed'],
		eventId: row.eventId,
		actorMemberId: member.id
	});
}

export function listComments(eventIds: string[], myMemberIds: Set<string>): ClientComment[] {
	if (!eventIds.length) return [];
	const rows = db
		.select()
		.from(activities)
		.where(
			and(
				inArray(activities.eventId, eventIds),
				eq(activities.type, 'comment'),
				isNull(activities.deletedAt)
			)
		)
		.orderBy(asc(activities.createdAt))
		.all();
	const reacts = reactionsFor(
		'comment',
		rows.map((r) => r.id),
		myMemberIds
	);
	return rows.map((r) => ({
		id: r.id,
		memberId: r.actorMemberId,
		body: String(r.data.body ?? ''),
		fileIds: (r.data.fileIds as string[] | undefined) ?? [],
		createdAt: r.createdAt,
		editedAt: (r.data.editedAt as number | undefined) ?? null,
		reactions: reacts.get(r.id) ?? []
	}));
}
