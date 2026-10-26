import { error } from '@sveltejs/kit';
import { listUserCalendars } from '#lib/server/calendars.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, depends }) => {
	if (!locals.user) error(401);
	depends('app:calendars');
	return { calendars: listUserCalendars(locals.user.id) };
};
