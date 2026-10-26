import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { applyTimeTreeImport } from '#lib/server/import/timetree-apply.js';
import { planTimeTreeImport } from '#lib/server/import/timetree-plan.js';
import type { RequestHandler } from './$types';

const body = z.object({
	file: z.unknown(),
	dryRun: z.boolean().default(false),
	target: z
		.union([
			z.object({ type: z.literal('new'), name: z.string().max(50) }),
			z.object({ type: z.literal('existing'), calendarId: z.string() })
		])
		.optional(),
	users: z.record(z.string(), z.enum(['me', 'virtual', 'ignore'])).default({}),
	virtualNames: z.record(z.string(), z.string().max(50)).default({})
});

/**
 * POST { file, dryRun: true } -> summary of what would be imported.
 * POST { file, target, users } -> performs the import.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Invalid request');
	const { file, dryRun, target, users, virtualNames } = parsed.data;

	let plan;
	try {
		plan = planTimeTreeImport(file);
	} catch (e) {
		error(400, (e as Error).message);
	}

	if (dryRun) {
		// The summary only; the event list itself isn't needed for the preview
		return json({ ...plan, events: undefined });
	}
	if (!target) error(400, 'Choose where to import the events.');
	const result = applyTimeTreeImport(plan, {
		userId: locals.user!.id,
		target,
		users,
		virtualNames
	});
	return json(result);
};
