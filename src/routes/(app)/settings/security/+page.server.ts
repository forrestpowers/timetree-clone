import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { passkeys, sessions } from '#lib/server/db/schema.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends }) => {
	depends('app:security');
	const user = locals.user!;
	return {
		passkeys: db
			.select({
				id: passkeys.id,
				name: passkeys.name,
				createdAt: passkeys.createdAt,
				lastUsedAt: passkeys.lastUsedAt
			})
			.from(passkeys)
			.where(eq(passkeys.userId, user.id))
			.orderBy(desc(passkeys.createdAt))
			.all(),
		sessions: db
			.select({
				id: sessions.id,
				userAgent: sessions.userAgent,
				ip: sessions.ip,
				createdAt: sessions.createdAt,
				lastSeenAt: sessions.lastSeenAt
			})
			.from(sessions)
			.where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, Date.now())))
			.orderBy(desc(sessions.lastSeenAt))
			.all()
			.map((s) => ({ ...s, current: s.id === locals.session!.id })),
		hasPassword: !!user.passwordHash
	};
};

export const actions: Actions = {
	renamePasskey: async ({ locals, request }) => {
		const form = await request.formData();
		const name =
			String(form.get('name') ?? '')
				.trim()
				.slice(0, 60) || 'Passkey';
		db.update(passkeys)
			.set({ name })
			.where(and(eq(passkeys.id, String(form.get('id'))), eq(passkeys.userId, locals.user!.id)))
			.run();
	},
	deletePasskey: async ({ locals, request }) => {
		const id = String((await request.formData()).get('id'));
		db.delete(passkeys)
			.where(and(eq(passkeys.id, id), eq(passkeys.userId, locals.user!.id)))
			.run();
	},
	revokeSession: async ({ locals, request }) => {
		const id = String((await request.formData()).get('id'));
		if (id === locals.session!.id) return;
		db.delete(sessions)
			.where(and(eq(sessions.id, id), eq(sessions.userId, locals.user!.id)))
			.run();
	}
};
