import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { isValidTimeZone } from '#lib/dates.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import type { RequestHandler } from './$types';

const schema = z
	.object({
		theme: z.enum(['system', 'light', 'dark']),
		weekStart: z.union([z.literal(0), z.literal(1), z.literal(6)]),
		weekNumbers: z.boolean(),
		saturdayBlue: z.boolean(),
		monthFontSize: z.enum(['smallest', 'small', 'medium', 'large', 'largest']),
		timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone').nullable(),
		mapApp: z.enum(['apple', 'google']),
		holidayCountries: z.array(z.string().length(2)).max(10),
		eventAutocomplete: z.boolean()
	})
	.partial();

/** Merge-update the user's app settings. */
export const PATCH: RequestHandler = async ({ locals, request }) => {
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid settings');
	const settings = { ...locals.user!.settings, ...parsed.data };
	db.update(users).set({ settings }).where(eq(users.id, locals.user!.id)).run();
	return json({ settings });
};
