import { error, json } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { requireMember } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { eventAttendees, virtualMembers } from '#lib/server/db/schema.js';
import { deleteStoredFile } from '#lib/server/files.js';
import { checkAvatar, virtualMemberSchema } from '#lib/server/virtual-members.js';
import type { RequestHandler } from './$types';

function find(calendarId: string, id: string) {
	const row = db
		.select()
		.from(virtualMembers)
		.where(
			and(
				eq(virtualMembers.id, id),
				eq(virtualMembers.calendarId, calendarId),
				isNull(virtualMembers.deletedAt)
			)
		)
		.get();
	if (!row) error(404, 'Virtual member not found');
	return row;
}

export const PUT: RequestHandler = async ({ params, locals, request }) => {
	requireMember(locals.user!.id, params.id);
	const existing = find(params.id, params.vid);
	const parsed = virtualMemberSchema.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid input');
	if (parsed.data.avatarFileId !== existing.avatarFileId)
		checkAvatar(parsed.data.avatarFileId, locals.user!.id);
	db.update(virtualMembers).set(parsed.data).where(eq(virtualMembers.id, existing.id)).run();
	if (existing.avatarFileId && existing.avatarFileId !== parsed.data.avatarFileId)
		await deleteStoredFile(existing.avatarFileId);
	return json({ ok: true });
};

/** Deleting also removes them from every event's attendee list. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireMember(locals.user!.id, params.id);
	const existing = find(params.id, params.vid);
	db.transaction((tx) => {
		tx.update(virtualMembers)
			.set({ deletedAt: Date.now() })
			.where(eq(virtualMembers.id, existing.id))
			.run();
		tx.delete(eventAttendees).where(eq(eventAttendees.attendeeId, existing.id)).run();
	});
	await deleteStoredFile(existing.avatarFileId);
	return json({ ok: true });
};
