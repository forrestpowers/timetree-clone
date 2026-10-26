import { error } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { calendarMembers } from '#lib/server/db/schema.js';
import { subscribe, type LiveMessage } from '#lib/server/live.js';
import type { RequestHandler } from './$types';

const HEARTBEAT_MS = 25_000; // Cloudflare drops responses that are silent for 100s

function myCalendarIds(userId: string) {
	return new Set(
		db
			.select({ id: calendarMembers.calendarId })
			.from(calendarMembers)
			.where(and(eq(calendarMembers.userId, userId), isNull(calendarMembers.removedAt)))
			.all()
			.map((r) => r.id)
	);
}

/** Server-Sent Events: one message per change in a calendar the user belongs to. */
export const GET: RequestHandler = ({ locals, request }) => {
	const user = locals.user;
	if (!user) error(401);
	let calendarIds = myCalendarIds(user.id);
	const encoder = new TextEncoder();
	let cleanup = () => {};

	const stream = new ReadableStream({
		start(controller) {
			const send = (text: string) => {
				try {
					controller.enqueue(encoder.encode(text));
				} catch {
					cleanup();
				}
			};
			send('retry: 3000\n\n');
			const unsubscribe = subscribe((m: LiveMessage) => {
				// Joining or leaving changes which calendars this user hears about
				if (m.kinds.includes('calendars')) calendarIds = myCalendarIds(user.id);
				if (!calendarIds.has(m.calendarId)) return;
				send(`data: ${JSON.stringify(m)}\n\n`);
			});
			const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
			cleanup = () => {
				clearInterval(heartbeat);
				unsubscribe();
				cleanup = () => {};
			};
			request.signal.addEventListener('abort', () => {
				cleanup();
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			});
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			'x-accel-buffering': 'no',
			connection: 'keep-alive'
		}
	});
};
