CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY,
	`calendar_id` text NOT NULL,
	`member_id` text NOT NULL,
	`kind` text DEFAULT 'text' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`event_id` text,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	CONSTRAINT `fk_chat_messages_calendar_id_calendars_id_fk` FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`member_id` text NOT NULL,
	`emoji` text NOT NULL,
	`calendar_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `reactions_pk` PRIMARY KEY(`target_type`, `target_id`, `member_id`, `emoji`),
	CONSTRAINT `fk_reactions_calendar_id_calendars_id_fk` FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `read_markers` (
	`member_id` text NOT NULL,
	`scope` text NOT NULL,
	`last_read_at` integer NOT NULL,
	CONSTRAINT `read_markers_pk` PRIMARY KEY(`member_id`, `scope`)
);
--> statement-breakpoint
CREATE INDEX `chat_cal_idx` ON `chat_messages` (`calendar_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `reactions_target_idx` ON `reactions` (`target_type`,`target_id`);