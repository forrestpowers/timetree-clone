import { redirect } from '@sveltejs/kit';
import { safeNext } from '#lib/server/redirects.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
};
