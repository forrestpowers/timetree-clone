CREATE TABLE `activities` (
	`id` text PRIMARY KEY,
	`calendar_id` text NOT NULL,
	`event_id` text,
	`actor_member_id` text,
	`type` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_activities_calendar_id_calendars_id_fk` FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `calendar_members` (
	`id` text PRIMARY KEY,
	`calendar_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`use_calendar_profile` integer DEFAULT false NOT NULL,
	`profile_name` text DEFAULT '' NOT NULL,
	`profile_avatar_file_id` text,
	`attribute` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`show_member_birthdays` integer DEFAULT true NOT NULL,
	`default_view` text DEFAULT 'month' NOT NULL,
	`last_label_id` text,
	`notify_mode` text DEFAULT 'all' NOT NULL,
	`notify_summary_time` text DEFAULT '08:00' NOT NULL,
	`joined_at` integer NOT NULL,
	`last_accessed_at` integer,
	`removed_at` integer,
	CONSTRAINT `fk_calendar_members_calendar_id_calendars_id_fk` FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_calendar_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`purpose` text DEFAULT 'other' NOT NULL,
	`cover_file_id` text,
	`background` text DEFAULT '{"type":"none"}' NOT NULL,
	`chat_enabled` integer DEFAULT true NOT NULL,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_calendars_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `email_tokens` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`new_email` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_email_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `event_alerts` (
	`event_id` text NOT NULL,
	`minutes_before` integer NOT NULL,
	CONSTRAINT `event_alerts_pk` PRIMARY KEY(`event_id`, `minutes_before`),
	CONSTRAINT `fk_event_alerts_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `event_attendees` (
	`event_id` text NOT NULL,
	`attendee_id` text NOT NULL,
	`attendee_type` text NOT NULL,
	CONSTRAINT `event_attendees_pk` PRIMARY KEY(`event_id`, `attendee_id`),
	CONSTRAINT `fk_event_attendees_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY,
	`calendar_id` text NOT NULL,
	`kind` text DEFAULT 'event' NOT NULL,
	`title` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`start_at` integer,
	`end_at` integer,
	`start_tz` text DEFAULT 'UTC' NOT NULL,
	`end_tz` text DEFAULT 'UTC' NOT NULL,
	`location_name` text DEFAULT '' NOT NULL,
	`location_lat` real,
	`location_lon` real,
	`url` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`label_id` text,
	`recurrence` text DEFAULT '[]' NOT NULL,
	`parent_id` text,
	`recurrence_start_at` integer,
	`memo_order` integer,
	`created_by_member_id` text,
	`external_uuid` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_events_calendar_id_calendars_id_fk` FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_events_label_id_labels_id_fk` FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY,
	`owner_user_id` text,
	`calendar_id` text,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`original_name` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_files_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY,
	`calendar_id` text NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_by_user_id` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_invites_calendar_id_calendars_id_fk` FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_invites_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY,
	`calendar_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`external_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_labels_calendar_id_calendars_id_fk` FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text DEFAULT '[]' NOT NULL,
	`name` text DEFAULT 'Passkey' NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	CONSTRAINT `fk_passkeys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`ip` text DEFAULT '' NOT NULL,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`email_verified_at` integer,
	`password_hash` text,
	`name` text DEFAULT '' NOT NULL,
	`avatar_file_id` text,
	`birthday` text,
	`show_birthday` integer DEFAULT false NOT NULL,
	`status_text` text DEFAULT '' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `virtual_members` (
	`id` text PRIMARY KEY,
	`calendar_id` text NOT NULL,
	`preset` text DEFAULT 'other' NOT NULL,
	`name` text NOT NULL,
	`avatar_file_id` text,
	`birthday` text,
	`show_birthday` integer DEFAULT false NOT NULL,
	`status_text` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_virtual_members_calendar_id_calendars_id_fk` FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `activities_cal_idx` ON `activities` (`calendar_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activities_event_idx` ON `activities` (`event_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_members_cal_user_idx` ON `calendar_members` (`calendar_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `calendar_members_user_idx` ON `calendar_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `event_attendees_attendee_idx` ON `event_attendees` (`attendee_id`);--> statement-breakpoint
CREATE INDEX `events_cal_range_idx` ON `events` (`calendar_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `events_parent_idx` ON `events` (`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_external_idx` ON `events` (`calendar_id`,`external_uuid`) WHERE external_uuid is not null;--> statement-breakpoint
CREATE INDEX `invites_cal_idx` ON `invites` (`calendar_id`);--> statement-breakpoint
CREATE INDEX `labels_cal_idx` ON `labels` (`calendar_id`);--> statement-breakpoint
CREATE INDEX `passkeys_user_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `virtual_members_cal_idx` ON `virtual_members` (`calendar_id`);