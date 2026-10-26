import { isValidTimeZone } from '#lib/dates.js';
import { toClientUser } from '#lib/server/users.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies }) => {
	const user = locals.user ? toClientUser(locals.user) : null;
	const deviceTz = cookies.get('tz');
	const tz =
		(isValidTimeZone(user?.settings.timeZone) && user?.settings.timeZone) ||
		(isValidTimeZone(deviceTz) && deviceTz) ||
		'UTC';
	return { user, tz };
};
