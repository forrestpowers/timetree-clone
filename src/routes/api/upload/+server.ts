import { error, json } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { saveImage } from '#lib/server/files.js';
import type { RequestHandler } from './$types';

/** Upload an image: multipart form with `file`, `kind` (avatar | cover | background) and optional `calendarId`. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user!;
	const form = await request.formData();
	const file = form.get('file');
	const kind = String(form.get('kind') ?? '');
	const calendarId = form.get('calendarId') ? String(form.get('calendarId')) : null;
	if (!(file instanceof File)) error(400, 'No file');
	if (kind !== 'avatar' && kind !== 'cover' && kind !== 'background') error(400, 'Invalid kind');
	if (calendarId) requireMember(user.id, calendarId);
	// Avatars are visible to anyone who shares a calendar with you, so they aren't tied to one calendar
	const id = await saveImage(file, kind, user.id, kind === 'avatar' ? null : calendarId);
	return json({ id });
};
