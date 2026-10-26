import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { sessions, users } from '#lib/server/db/schema.js';
import { randomToken, sha256 } from './crypto.js';

export const SESSION_COOKIE = 'session';
const DAY = 24 * 60 * 60 * 1000;
const SESSION_TTL = 60 * DAY;
const RENEW_WHEN_LEFT = 30 * DAY;
const TOUCH_EVERY = 5 * 60 * 1000;

export type SessionUser = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;

export function createSession(userId: string, event: RequestEvent): string {
	const token = randomToken();
	db.insert(sessions)
		.values({
			id: sha256(token),
			userId,
			expiresAt: Date.now() + SESSION_TTL,
			userAgent: event.request.headers.get('user-agent')?.slice(0, 300) ?? '',
			ip: safeClientAddress(event)
		})
		.run();
	setSessionCookie(event.cookies, token, Date.now() + SESSION_TTL);
	return token;
}

export function validateSession(token: string): { session: Session; user: SessionUser } | null {
	const row = db
		.select({ session: sessions, user: users })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(
			and(
				eq(sessions.id, sha256(token)),
				gt(sessions.expiresAt, Date.now()),
				isNull(users.deletedAt)
			)
		)
		.get();
	if (!row) return null;

	const now = Date.now();
	const patch: Partial<Session> = {};
	if (row.session.expiresAt - now < RENEW_WHEN_LEFT) patch.expiresAt = now + SESSION_TTL;
	if (now - row.session.lastSeenAt > TOUCH_EVERY) patch.lastSeenAt = now;
	if (Object.keys(patch).length) {
		db.update(sessions).set(patch).where(eq(sessions.id, row.session.id)).run();
		Object.assign(row.session, patch);
	}
	return row;
}

export function invalidateSession(sessionId: string) {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export function invalidateUserSessions(userId: string) {
	db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: number) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: new Date(expiresAt)
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function safeClientAddress(event: RequestEvent): string {
	try {
		return event.getClientAddress();
	} catch {
		return '';
	}
}
