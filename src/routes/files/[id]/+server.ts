import { error } from '@sveltejs/kit';
import { requireMember } from '#lib/server/calendars.js';
import { readStoredFile } from '#lib/server/files.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) error(401);
	const stored = await readStoredFile(params.id);
	if (!stored) error(404, 'File not found');
	if (stored.row.calendarId) requireMember(user.id, stored.row.calendarId);

	const inline = stored.row.mime.startsWith('image/') || stored.row.mime === 'application/pdf';
	return new Response(new Uint8Array(stored.data), {
		headers: {
			'content-type': stored.row.mime,
			'content-length': String(stored.data.length),
			// Never let Cloudflare (or any shared cache) keep a copy
			'cache-control': 'private, max-age=31536000, immutable',
			'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(stored.row.originalName || 'file')}`,
			'x-content-type-options': 'nosniff'
		}
	});
};
