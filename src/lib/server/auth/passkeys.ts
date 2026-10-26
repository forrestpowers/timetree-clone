import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { APP_NAME } from '$app/env/public';
import { APP_ORIGIN } from '$app/env/private';
import { db } from '#lib/server/db/index.js';
import { passkeys, users } from '#lib/server/db/schema.js';
import { randomToken } from './crypto.js';

const rpID = new URL(APP_ORIGIN).hostname;
const CHALLENGE_COOKIE = 'webauthn';
const CHALLENGE_TTL = 5 * 60 * 1000;

// Challenges are kept server-side and are single-use; the cookie only holds a lookup key.
const challenges = new Map<string, { challenge: string; userId?: string; expiresAt: number }>();

function storeChallenge(cookies: Cookies, challenge: string, userId?: string) {
	const key = randomToken(16);
	const now = Date.now();
	for (const [k, v] of challenges) if (v.expiresAt < now) challenges.delete(k);
	challenges.set(key, { challenge, userId, expiresAt: now + CHALLENGE_TTL });
	cookies.set(CHALLENGE_COOKIE, key, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		maxAge: 300
	});
}

function takeChallenge(cookies: Cookies) {
	const key = cookies.get(CHALLENGE_COOKIE);
	cookies.delete(CHALLENGE_COOKIE, { path: '/' });
	if (!key) return null;
	const entry = challenges.get(key);
	challenges.delete(key);
	if (!entry || entry.expiresAt < Date.now()) return null;
	return entry;
}

export async function registrationOptions(user: typeof users.$inferSelect, cookies: Cookies) {
	const existing = db.select().from(passkeys).where(eq(passkeys.userId, user.id)).all();
	const options = await generateRegistrationOptions({
		rpName: APP_NAME,
		rpID,
		userName: user.email,
		userDisplayName: user.name || user.email,
		userID: new TextEncoder().encode(user.id),
		excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports })),
		authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' }
	});
	storeChallenge(cookies, options.challenge, user.id);
	return options;
}

export async function verifyRegistration(
	user: typeof users.$inferSelect,
	cookies: Cookies,
	response: RegistrationResponseJSON,
	name: string
) {
	const entry = takeChallenge(cookies);
	if (!entry || entry.userId !== user.id) throw new Error('Passkey request expired. Try again.');
	const result = await verifyRegistrationResponse({
		response,
		expectedChallenge: entry.challenge,
		expectedOrigin: APP_ORIGIN,
		expectedRPID: rpID
	});
	if (!result.verified) throw new Error('Passkey could not be verified.');
	const { credential } = result.registrationInfo;
	db.insert(passkeys)
		.values({
			id: credential.id,
			userId: user.id,
			publicKey: Buffer.from(credential.publicKey),
			counter: credential.counter,
			transports: credential.transports ?? [],
			name: name.trim().slice(0, 60) || 'Passkey'
		})
		.run();
}

export async function authenticationOptions(cookies: Cookies) {
	const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
	storeChallenge(cookies, options.challenge);
	return options;
}

/** Returns the user id on success. */
export async function verifyAuthentication(cookies: Cookies, response: AuthenticationResponseJSON) {
	const entry = takeChallenge(cookies);
	if (!entry) throw new Error('Passkey request expired. Try again.');
	const passkey = db.select().from(passkeys).where(eq(passkeys.id, response.id)).get();
	if (!passkey) throw new Error('This passkey is not registered here.');
	const result = await verifyAuthenticationResponse({
		response,
		expectedChallenge: entry.challenge,
		expectedOrigin: APP_ORIGIN,
		expectedRPID: rpID,
		credential: {
			id: passkey.id,
			publicKey: new Uint8Array(passkey.publicKey),
			counter: passkey.counter,
			transports: passkey.transports as never
		}
	});
	if (!result.verified) throw new Error('Passkey could not be verified.');
	db.update(passkeys)
		.set({ counter: result.authenticationInfo.newCounter, lastUsedAt: Date.now() })
		.where(eq(passkeys.id, passkey.id))
		.run();
	return passkey.userId;
}
