import { error, json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { saveAttachment } from '#lib/server/files.js';
import type { RequestHandler } from './$types';

/** Upload a file to attach to an event: multipart `file` + `calendarId`. Attached on save. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const form = await request.formData();
	const file = form.get('file');
	const calendarId = String(form.get('calendarId') ?? '');
	if (!(file instanceof File)) error(400, 'No file');
	requireMember(locals.user!.id, calendarId);
	const id = await saveAttachment(file, locals.user!.id, calendarId);
	return json({ id, name: file.name, size: file.size });
};
