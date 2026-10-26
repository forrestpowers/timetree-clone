import { error, json } from '@sveltejs/kit';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { MAX_VIRTUAL_MEMBERS, requireMember } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { virtualMembers } from '#lib/server/db/schema.js';
import { virtualMemberSchema, checkAvatar } from '#lib/server/virtual-members.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request }) => {
	requireMember(locals.user!.id, params.id);
	const parsed = virtualMemberSchema.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid input');
	checkAvatar(parsed.data.avatarFileId, locals.user!.id);

	const count = db
		.select({ n: sql<number>`count(*)` })
		.from(virtualMembers)
		.where(and(eq(virtualMembers.calendarId, params.id), isNull(virtualMembers.deletedAt)))
		.get()!.n;
	if (count >= MAX_VIRTUAL_MEMBERS) error(400, 'Max. number of virtual members reached.');

	const row = db
		.insert(virtualMembers)
		.values({ ...parsed.data, calendarId: params.id })
		.returning({ id: virtualMembers.id })
		.get()!;
	return json({ id: row.id });
};
