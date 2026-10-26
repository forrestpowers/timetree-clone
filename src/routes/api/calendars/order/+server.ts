import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { reorderCalendars } from '#lib/server/calendars.js';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, request }) => {
	const parsed = z
		.array(z.string())
		.max(200)
		.safeParse(await request.json());
	if (!parsed.success) error(400, 'Invalid order');
	reorderCalendars(locals.user!.id, parsed.data);
	return json({ ok: true });
};
