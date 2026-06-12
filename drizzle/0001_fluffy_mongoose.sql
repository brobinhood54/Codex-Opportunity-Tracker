CREATE TABLE `account_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_name` text NOT NULL,
	`industry` text DEFAULT 'Unknown' NOT NULL,
	`segment` text DEFAULT 'Prospect' NOT NULL,
	`health` text DEFAULT 'At Risk' NOT NULL,
	`score` integer DEFAULT 35 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_profiles_account_name_unique` ON `account_profiles` (`account_name`);--> statement-breakpoint
CREATE INDEX `account_profiles_account_name_idx` ON `account_profiles` (`account_name`);--> statement-breakpoint
CREATE TABLE `call_transcripts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_name` text NOT NULL,
	`title` text NOT NULL,
	`call_date` text DEFAULT '' NOT NULL,
	`attendees_json` text DEFAULT '[]' NOT NULL,
	`transcript` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`questions_json` text DEFAULT '[]' NOT NULL,
	`signals_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `call_transcripts_account_idx` ON `call_transcripts` (`account_name`);--> statement-breakpoint
CREATE INDEX `call_transcripts_call_date_idx` ON `call_transcripts` (`call_date`);--> statement-breakpoint
CREATE TABLE `context_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_name` text NOT NULL,
	`source_type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`source_date` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `context_sources_account_idx` ON `context_sources` (`account_name`);--> statement-breakpoint
CREATE INDEX `context_sources_source_type_idx` ON `context_sources` (`source_type`);--> statement-breakpoint
CREATE TABLE `research_briefs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_name` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`sources_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `research_briefs_account_idx` ON `research_briefs` (`account_name`);--> statement-breakpoint
CREATE INDEX `research_briefs_status_idx` ON `research_briefs` (`status`);