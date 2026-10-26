import { sql } from 'drizzle-orm';
import {
	blob,
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

// All timestamps are integer milliseconds since the epoch (UTC).
const now = () => Date.now();
const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer('created_at').notNull().$defaultFn(now);
const updatedAt = () => integer('updated_at').notNull().$defaultFn(now).$onUpdateFn(now);

export type UserSettings = {
	theme?: 'system' | 'light' | 'dark';
	weekStart?: 0 | 1 | 6;
	weekNumbers?: boolean;
	saturdayBlue?: boolean;
	monthFontSize?: 'smallest' | 'small' | 'medium' | 'large' | 'largest';
	timeZone?: string | null;
	mapApp?: 'apple' | 'google';
	holidayCountries?: string[];
	eventAutocomplete?: boolean;
};

export const users = sqliteTable('users', {
	id: id(),
	email: text('email').notNull().unique(),
	emailVerifiedAt: integer('email_verified_at'),
	passwordHash: text('password_hash'),
	name: text('name').notNull().default(''),
	avatarFileId: text('avatar_file_id'),
	birthday: text('birthday'), // YYYY-MM-DD
	showBirthday: integer('show_birthday', { mode: 'boolean' }).notNull().default(false),
	statusText: text('status_text').notNull().default(''),
	settings: text('settings', { mode: 'json' }).$type<UserSettings>().notNull().default({}),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
	deletedAt: integer('deleted_at')
});

export const sessions = sqliteTable(
	'sessions',
	{
		// sha256(token) as hex; the raw token only lives in the cookie
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at').notNull(),
		createdAt: createdAt(),
		lastSeenAt: integer('last_seen_at').notNull().$defaultFn(now),
		userAgent: text('user_agent').notNull().default(''),
		ip: text('ip').notNull().default('')
	},
	(t) => [index('sessions_user_idx').on(t.userId)]
);

export const emailTokens = sqliteTable('email_tokens', {
	id: text('id').primaryKey(), // sha256(token)
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	kind: text('kind', { enum: ['verify', 'reset', 'change_email'] }).notNull(),
	newEmail: text('new_email'),
	expiresAt: integer('expires_at').notNull(),
	usedAt: integer('used_at'),
	createdAt: createdAt()
});

export const passkeys = sqliteTable(
	'passkeys',
	{
		id: text('id').primaryKey(), // credential id, base64url
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		publicKey: blob('public_key', { mode: 'buffer' }).notNull(),
		counter: integer('counter').notNull().default(0),
		transports: text('transports', { mode: 'json' }).$type<string[]>().notNull().default([]),
		name: text('name').notNull().default('Passkey'),
		createdAt: createdAt(),
		lastUsedAt: integer('last_used_at')
	},
	(t) => [index('passkeys_user_idx').on(t.userId)]
);

export const files = sqliteTable('files', {
	id: id(),
	ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
	calendarId: text('calendar_id'),
	kind: text('kind', {
		enum: ['avatar', 'cover', 'background', 'attachment', 'photo', 'comment']
	}).notNull(),
	mime: text('mime').notNull(),
	size: integer('size').notNull(),
	originalName: text('original_name').notNull().default(''),
	createdAt: createdAt()
});

export const CALENDAR_PURPOSES = [
	'family',
	'relationship',
	'friends',
	'work',
	'shift',
	'school',
	'lesson',
	'group',
	'hobby',
	'personal',
	'other'
] as const;
export type CalendarPurpose = (typeof CALENDAR_PURPOSES)[number];

export type CalendarBackground =
	{ type: 'none' } | { type: 'color'; color: string } | { type: 'image'; fileId: string };

export const calendars = sqliteTable('calendars', {
	id: id(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	purpose: text('purpose', { enum: CALENDAR_PURPOSES }).notNull().default('other'),
	coverFileId: text('cover_file_id'),
	background: text('background', { mode: 'json' })
		.$type<CalendarBackground>()
		.notNull()
		.default({ type: 'none' }),
	chatEnabled: integer('chat_enabled', { mode: 'boolean' }).notNull().default(true),
	createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
	deletedAt: integer('deleted_at')
});

export const MEMBER_ATTRIBUTES = [
	'husband',
	'wife',
	'child',
	'grandfather',
	'grandmother',
	'boyfriend',
	'girlfriend',
	'other'
] as const;

export type NotifyMode = 'all' | 'attending' | 'summary' | 'off';
export type CalendarView = 'month' | 'week' | 'list' | 'day' | 'three_day';

export const calendarMembers = sqliteTable(
	'calendar_members',
	{
		id: id(),
		calendarId: text('calendar_id')
			.notNull()
			.references(() => calendars.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'member'] })
			.notNull()
			.default('member'),
		// Per-calendar profile ("Calendar profile")
		useCalendarProfile: integer('use_calendar_profile', { mode: 'boolean' })
			.notNull()
			.default(false),
		profileName: text('profile_name').notNull().default(''),
		profileAvatarFileId: text('profile_avatar_file_id'),
		attribute: text('attribute', { enum: MEMBER_ATTRIBUTES }),
		// Per-user preferences for this calendar
		sortOrder: integer('sort_order').notNull().default(0),
		visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
		showMemberBirthdays: integer('show_member_birthdays', { mode: 'boolean' })
			.notNull()
			.default(true),
		defaultView: text('default_view').$type<CalendarView>().notNull().default('month'),
		lastLabelId: text('last_label_id'),
		notifyMode: text('notify_mode').$type<NotifyMode>().notNull().default('all'),
		notifySummaryTime: text('notify_summary_time').notNull().default('08:00'),
		joinedAt: integer('joined_at').notNull().$defaultFn(now),
		lastAccessedAt: integer('last_accessed_at'),
		removedAt: integer('removed_at')
	},
	(t) => [
		uniqueIndex('calendar_members_cal_user_idx').on(t.calendarId, t.userId),
		index('calendar_members_user_idx').on(t.userId)
	]
);

export const VIRTUAL_PRESETS = [
	'child',
	'pet',
	'car',
	'grandfather',
	'grandmother',
	'other'
] as const;

export const virtualMembers = sqliteTable(
	'virtual_members',
	{
		id: id(),
		calendarId: text('calendar_id')
			.notNull()
			.references(() => calendars.id, { onDelete: 'cascade' }),
		preset: text('preset', { enum: VIRTUAL_PRESETS }).notNull().default('other'),
		name: text('name').notNull(),
		avatarFileId: text('avatar_file_id'),
		birthday: text('birthday'), // YYYY-MM-DD; delivery date for cars
		showBirthday: integer('show_birthday', { mode: 'boolean' }).notNull().default(false),
		statusText: text('status_text').notNull().default(''),
		createdAt: createdAt(),
		deletedAt: integer('deleted_at')
	},
	(t) => [index('virtual_members_cal_idx').on(t.calendarId)]
);

export const invites = sqliteTable(
	'invites',
	{
		id: id(),
		calendarId: text('calendar_id')
			.notNull()
			.references(() => calendars.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		createdByUserId: text('created_by_user_id').references(() => users.id, {
			onDelete: 'set null'
		}),
		expiresAt: integer('expires_at').notNull(),
		revokedAt: integer('revoked_at'),
		createdAt: createdAt()
	},
	(t) => [index('invites_cal_idx').on(t.calendarId)]
);

export const labels = sqliteTable(
	'labels',
	{
		id: id(),
		calendarId: text('calendar_id')
			.notNull()
			.references(() => calendars.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default(''),
		color: text('color').notNull(),
		sortOrder: integer('sort_order').notNull().default(0),
		// TimeTree's numeric label id, kept for imports
		externalId: integer('external_id'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('labels_cal_idx').on(t.calendarId)]
);

export const events = sqliteTable(
	'events',
	{
		id: id(),
		calendarId: text('calendar_id')
			.notNull()
			.references(() => calendars.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['event', 'memo'] })
			.notNull()
			.default('event'),
		title: text('title').notNull(),
		allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
		// Timed events: UTC instants. All-day events: UTC midnight of the first and
		// last day (inclusive), with time zone 'UTC' (same convention as TimeTree).
		startAt: integer('start_at'),
		endAt: integer('end_at'),
		startTz: text('start_tz').notNull().default('UTC'),
		endTz: text('end_tz').notNull().default('UTC'),
		locationName: text('location_name').notNull().default(''),
		locationLat: real('location_lat'),
		locationLon: real('location_lon'),
		url: text('url').notNull().default(''),
		note: text('note').notNull().default(''),
		labelId: text('label_id').references(() => labels.id, { onDelete: 'set null' }),
		// RRULE / EXDATE / RDATE lines, as in iCalendar
		recurrence: text('recurrence', { mode: 'json' }).$type<string[]>().notNull().default([]),
		// Recurrence exceptions point at their series and the original occurrence start
		parentId: text('parent_id'),
		recurrenceStartAt: integer('recurrence_start_at'),
		memoOrder: integer('memo_order'),
		createdByMemberId: text('created_by_member_id'),
		externalUuid: text('external_uuid'),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: integer('deleted_at')
	},
	(t) => [
		index('events_cal_range_idx').on(t.calendarId, t.startAt, t.endAt),
		index('events_parent_idx').on(t.parentId),
		uniqueIndex('events_external_idx')
			.on(t.calendarId, t.externalUuid)
			.where(sql`external_uuid is not null`)
	]
);

export const eventAttendees = sqliteTable(
	'event_attendees',
	{
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		// Either a calendar member or a virtual member
		attendeeId: text('attendee_id').notNull(),
		attendeeType: text('attendee_type', { enum: ['member', 'virtual'] }).notNull()
	},
	(t) => [
		primaryKey({ columns: [t.eventId, t.attendeeId] }),
		index('event_attendees_attendee_idx').on(t.attendeeId)
	]
);

export const eventAlerts = sqliteTable(
	'event_alerts',
	{
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		// Minutes before start. For all-day events, measured from local midnight of the
		// first day, so -540 means "on the day at 09:00".
		minutesBefore: integer('minutes_before').notNull()
	},
	(t) => [primaryKey({ columns: [t.eventId, t.minutesBefore] })]
);

export const ACTIVITY_TYPES = [
	'event_created',
	'event_updated',
	'event_deleted',
	'memo_created',
	'memo_updated',
	'memo_deleted',
	'comment',
	'like',
	'member_joined',
	'member_left',
	'member_removed',
	'calendar_updated'
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const activities = sqliteTable(
	'activities',
	{
		id: id(),
		calendarId: text('calendar_id')
			.notNull()
			.references(() => calendars.id, { onDelete: 'cascade' }),
		eventId: text('event_id'),
		actorMemberId: text('actor_member_id'),
		type: text('type', { enum: ACTIVITY_TYPES }).notNull(),
		// e.g. { fields: ['title','date'], before: {...}, after: {...}, body: '...' }
		data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: integer('deleted_at')
	},
	(t) => [
		index('activities_cal_idx').on(t.calendarId, t.createdAt),
		index('activities_event_idx').on(t.eventId, t.createdAt)
	]
);
