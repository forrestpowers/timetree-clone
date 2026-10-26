import { APP_NAME } from '$app/env/public';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const manifest = {
		name: APP_NAME,
		short_name: APP_NAME,
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: '#f4f6f5',
		theme_color: '#1fa971',
		icons: [
			{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
			{ src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
		],
		shortcuts: [
			{
				name: 'Create an event',
				url: '/events/new',
				icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
			},
			{
				name: 'Calendars',
				url: '/calendars',
				icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
			}
		]
	};
	return new Response(JSON.stringify(manifest), {
		headers: {
			'content-type': 'application/manifest+json',
			'cache-control': 'public, max-age=3600'
		}
	});
};
