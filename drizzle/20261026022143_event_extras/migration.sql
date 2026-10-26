CREATE TABLE `event_checklist_items` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`done_by_member_id` text,
	`done_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_event_checklist_items_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `event_files` (
	`event_id` text NOT NULL,
	`file_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `event_files_pk` PRIMARY KEY(`event_id`, `file_id`),
	CONSTRAINT `fk_event_files_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_files_file_id_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `events` ADD `pinned_at` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `pinned_occurrences` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `day_count` text;--> statement-breakpoint
CREATE INDEX `checklist_event_idx` ON `event_checklist_items` (`event_id`);