import { redirect } from '@sveltejs/kit';
import {
	clearSessionCookie,
	invalidateSession,
	invalidateUserSessions
} from '#lib/server/auth/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	logout: ({ locals, cookies }) => {
		if (locals.session) invalidateSession(locals.session.id);
		clearSessionCookie(cookies);
		redirect(303, '/login');
	},
	all: ({ locals, cookies }) => {
		if (locals.user) invalidateUserSessions(locals.user.id);
		clearSessionCookie(cookies);
		redirect(303, '/login');
	}
};
