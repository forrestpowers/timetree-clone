import { and, eq, gt, isNull } from 'drizzle-orm';
import { APP_NAME } from '$app/env/public';
import { APP_ORIGIN } from '$app/env/private';
import { db } from '#lib/server/db/index.js';
import { emailTokens, users } from '#lib/server/db/schema.js';
import { sendMail } from '#lib/server/mail.js';
import { randomToken, sha256 } from './crypto.js';

type Kind = (typeof emailTokens.$inferSelect)['kind'];

const TTL: Record<Kind, number> = {
	verify: 3 * 24 * 60 * 60 * 1000,
	change_email: 24 * 60 * 60 * 1000,
	reset: 60 * 60 * 1000
};

function issue(userId: string, kind: Kind, newEmail?: string): string {
	// Only one live token of each kind per user
	db.delete(emailTokens)
		.where(and(eq(emailTokens.userId, userId), eq(emailTokens.kind, kind)))
		.run();
	const token = randomToken();
	db.insert(emailTokens)
		.values({ id: sha256(token), userId, kind, newEmail, expiresAt: Date.now() + TTL[kind] })
		.run();
	return token;
}

/** Marks the token used and returns it, or null if invalid or expired. */
export function consumeEmailToken(token: string, kind: Kind) {
	const row = db
		.select()
		.from(emailTokens)
		.where(
			and(
				eq(emailTokens.id, sha256(token)),
				eq(emailTokens.kind, kind),
				gt(emailTokens.expiresAt, Date.now()),
				isNull(emailTokens.usedAt)
			)
		)
		.get();
	if (!row) return null;
	db.update(emailTokens).set({ usedAt: Date.now() }).where(eq(emailTokens.id, row.id)).run();
	return row;
}

export function peekEmailToken(token: string, kind: Kind) {
	return db
		.select()
		.from(emailTokens)
		.where(
			and(
				eq(emailTokens.id, sha256(token)),
				eq(emailTokens.kind, kind),
				gt(emailTokens.expiresAt, Date.now()),
				isNull(emailTokens.usedAt)
			)
		)
		.get();
}

export async function sendVerificationEmail(user: { id: string; email: string }) {
	const token = issue(user.id, 'verify');
	await sendMail(
		user.email,
		`Verify your email for ${APP_NAME}`,
		`Confirm your email address by opening this link:\n\n${APP_ORIGIN}/verify-email/${token}\n\nThe link is valid for 3 days.`
	);
}

export async function sendPasswordResetEmail(email: string) {
	const user = db.select().from(users).where(eq(users.email, email)).get();
	// Same response either way, so the form can't be used to discover accounts
	if (!user || user.deletedAt) return;
	const token = issue(user.id, 'reset');
	await sendMail(
		user.email,
		`Reset your ${APP_NAME} password`,
		`Someone asked to reset the password for this account. If it was you, open:\n\n${APP_ORIGIN}/reset-password/${token}\n\nThe link is valid for 1 hour. If it wasn't you, ignore this email.`
	);
}

export async function sendChangeEmailConfirmation(userId: string, newEmail: string) {
	const token = issue(userId, 'change_email', newEmail);
	await sendMail(
		newEmail,
		`Confirm your new email for ${APP_NAME}`,
		`Open this link to make this your sign-in email:\n\n${APP_ORIGIN}/change-email/${token}\n\nThe link is valid for 24 hours.`
	);
}
