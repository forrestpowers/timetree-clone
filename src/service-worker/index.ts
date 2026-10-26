import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';

// App shell: hashed build files plus static assets. Pages and API responses are
// never cached here (they are per-user); offline reading comes in a later phase.
const CACHE = `shell-${version}`;
const SHELL = [...immutable, ...assets]
	.map((a) => a.path)
	.map((p) => (p.startsWith('/') ? p : `/${p}`));
const SHELL_SET = new Set(SHELL);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || !SHELL_SET.has(url.pathname)) return;
	event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
});
