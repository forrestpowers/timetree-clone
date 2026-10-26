import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password.normalize('NFKC'), salt, KEY_LEN, SCRYPT, (err, key) =>
			err ? reject(err) : resolve(key)
		);
	});
}

/** Returns `scrypt$N$r$p$salt$hash` (base64url parts). */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scryptAsync(password, salt);
	return [
		'scrypt',
		SCRYPT.N,
		SCRYPT.r,
		SCRYPT.p,
		salt.toString('base64url'),
		key.toString('base64url')
	].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, , , , saltB64, keyB64] = stored.split('$');
	if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
	const expected = Buffer.from(keyB64, 'base64url');
	const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64url'));
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Passwords must be 8-64 characters and mix at least two of letters, digits and symbols. */
export function passwordProblem(password: string): string | null {
	if (password.length < 8 || password.length > 64) return 'Password must be 8–64 characters.';
	const kinds = [/[a-zA-Z]/, /\d/, /[^a-zA-Z\d]/].filter((re) => re.test(password)).length;
	if (kinds < 2) return 'Use at least two of: letters, numbers, symbols.';
	return null;
}

export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}
