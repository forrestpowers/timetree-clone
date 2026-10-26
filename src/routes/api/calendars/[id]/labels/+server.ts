import { error, json } from '@sveltejs/kit';
import { and, eq, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { isHexColor } from '#lib/palette.js';
import { MAX_LABELS, requireMember } from '#lib/server/calendars.js';
import { db } from '#lib/server/db/index.js';
import { labels } from '#lib/server/db/schema.js';
import type { RequestHandler } from './$types';

const schema = z
	.array(
		z.object({
			id: z.string().optional(),
			name: z.string().trim().max(30),
			color: z.string().refine(isHexColor, 'Invalid color')
		})
	)
	.min(1, 'Keep at least one label.')
	.max(MAX_LABELS, `Up to ${MAX_LABELS} labels.`);

/** Replace the calendar's label list (order = array order). Labels left out are deleted. */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	requireMember(locals.user!.id, params.id);
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid labels');

	db.transaction((tx) => {
		const existing = new Set(
			tx
				.select({ id: labels.id })
				.from(labels)
				.where(eq(labels.calendarId, params.id))
				.all()
				.map((l) => l.id)
		);
		const keep: string[] = [];
		parsed.data.forEach((label, i) => {
			if (label.id && existing.has(label.id)) {
				tx.update(labels)
					.set({ name: label.name, color: label.color, sortOrder: i })
					.where(eq(labels.id, label.id))
					.run();
				keep.push(label.id);
			} else {
				const row = tx
					.insert(labels)
					.values({ calendarId: params.id, name: label.name, color: label.color, sortOrder: i })
					.returning({ id: labels.id })
					.get()!;
				keep.push(row.id);
			}
		});
		tx.delete(labels)
			.where(and(eq(labels.calendarId, params.id), notInArray(labels.id, keep)))
			.run();
	});
	return json({ ok: true });
};
