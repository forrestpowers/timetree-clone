import type { Handle } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, validateSession, clearSessionCookie } from '#lib/server/auth/session.js';

// Routes reachable without signing in
const PUBLIC_PREFIXES = [
	'/login',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/verify-email',
	'/change-email',
	'/invite',
	'/api/auth/passkey/login',
	'/manifest.webmanifest',
	'/feeds',
	'/favicon.ico'
];

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = null;
	event.locals.session = null;
	if (token) {
		const result = validateSession(token);
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	const path = event.url.pathname;
	const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
	if (!event.locals.user && !isPublic) {
		if (path.startsWith('/api/') || event.request.method !== 'GET') {
			return new Response('Unauthorized', { status: 401 });
		}
		const next = path === '/' ? '' : `?next=${encodeURIComponent(path + event.url.search)}`;
		redirect(303, `/login${next}`);
	}

	const response = await resolve(event);
	if (path === '/service-worker.js') response.headers.set('cache-control', 'no-cache');
	return response;
};
