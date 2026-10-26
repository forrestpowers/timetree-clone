import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import type { SessionUser } from '#lib/server/auth/session.js';
import type { ClientUser } from '#lib/types.js';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isEmail = (email: string) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

export function toClientUser(user: SessionUser): ClientUser {
	return {
		id: user.id,
		email: user.email,
		emailVerified: !!user.emailVerifiedAt,
		name: user.name,
		avatarFileId: user.avatarFileId,
		birthday: user.birthday,
		showBirthday: user.showBirthday,
		statusText: user.statusText,
		settings: user.settings,
		hasPassword: !!user.passwordHash
	};
}

export function findUserByEmail(email: string) {
	return db
		.select()
		.from(users)
		.where(and(eq(users.email, normalizeEmail(email)), isNull(users.deletedAt)))
		.get();
}

export function userCount(): number {
	return db
		.select({ n: sql<number>`count(*)` })
		.from(users)
		.where(isNull(users.deletedAt))
		.get()!.n;
}
