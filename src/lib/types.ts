// Shapes sent from the server to the browser.

import type {
	CalendarBackground,
	CalendarPurpose,
	CalendarView,
	DayCount,
	NotifyMode,
	UserSettings
} from '#lib/server/db/schema.js';

export type {
	CalendarBackground,
	CalendarPurpose,
	CalendarView,
	DayCount,
	NotifyMode,
	UserSettings
};

export type ClientUser = {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	avatarFileId: string | null;
	birthday: string | null;
	showBirthday: boolean;
	statusText: string;
	settings: UserSettings;
	hasPassword: boolean;
};

export type ClientCalendar = {
	id: string;
	name: string;
	description: string;
	purpose: CalendarPurpose;
	coverFileId: string | null;
	background: CalendarBackground;
	chatEnabled: boolean;
	memberCount: number;
	me: {
		memberId: string;
		role: 'owner' | 'member';
		visible: boolean;
		useCalendarProfile: boolean;
		sortOrder: number;
		showMemberBirthdays: boolean;
		defaultView: CalendarView;
		lastLabelId: string | null;
		notifyMode: NotifyMode;
		notifySummaryTime: string;
	};
};

export type ClientMember = {
	id: string;
	calendarId: string;
	userId: string;
	name: string;
	avatarFileId: string | null;
	role: 'owner' | 'member';
	attribute: string | null;
	birthday: string | null;
	statusText: string;
	isMe: boolean;
	lastAccessedAt: number | null;
	joinedAt: number;
};

export type ClientVirtualMember = {
	id: string;
	calendarId: string;
	preset: 'child' | 'pet' | 'car' | 'grandfather' | 'grandmother' | 'other';
	name: string;
	avatarFileId: string | null;
	birthday: string | null;
	showBirthday: boolean;
	statusText: string;
};

export type ClientLabel = {
	id: string;
	calendarId: string;
	name: string;
	color: string;
	sortOrder: number;
};

export type Attendee = { id: string; type: 'member' | 'virtual' };
export type ChecklistItem = {
	id: string;
	text: string;
	done: boolean;
	doneByMemberId: string | null;
};
export type EventFile = { id: string; name: string; mime: string; size: number };

export type ClientEvent = {
	id: string;
	calendarId: string;
	kind: 'event' | 'memo';
	title: string;
	allDay: boolean;
	startAt: number | null;
	endAt: number | null;
	startTz: string;
	endTz: string;
	locationName: string;
	locationLat: number | null;
	locationLon: number | null;
	url: string;
	note: string;
	labelId: string | null;
	recurrence: string[];
	/** Set on events split off a repeating series */
	parentId: string | null;
	attendees: Attendee[];
	alerts: number[];
	checklist: ChecklistItem[];
	files: EventFile[];
	pinnedAt: number | null;
	pinnedOccurrences: number[];
	dayCount: DayCount | null;
	createdByMemberId: string | null;
	createdAt: number;
	updatedAt: number;
};

/** Generated, read-only entries such as birthdays and holidays. */
export type VirtualEntry = {
	id: string;
	kind: 'birthday' | 'holiday';
	title: string;
	date: string;
	calendarId?: string;
};

export type ClientActivity = {
	id: string;
	calendarId: string;
	eventId: string | null;
	actorMemberId: string | null;
	type: import('#lib/server/db/schema.js').ActivityType;
	data: Record<string, unknown>;
	createdAt: number;
	updatedAt: number;
	/** The event as it is now (title may have changed since) */
	event: { title: string; kind: 'event' | 'memo'; deleted: boolean } | null;
};

export type ReactionSummary = { emoji: string; count: number; mine: boolean; memberIds: string[] };

export type ClientChatMessage = {
	id: string;
	calendarId: string;
	memberId: string;
	kind: 'text' | 'event';
	body: string;
	event: {
		id: string;
		title: string;
		startAt: number | null;
		allDay: boolean;
		startTz: string;
	} | null;
	reactions: ReactionSummary[];
	createdAt: number;
	editedAt: number | null;
	deleted: boolean;
};
