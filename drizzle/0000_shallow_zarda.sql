CREATE TABLE `opportunities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_name` text NOT NULL,
	`opportunity_name` text NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'Discovery' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`probability` integer DEFAULT 20 NOT NULL,
	`progress` integer DEFAULT 15 NOT NULL,
	`close_date` text DEFAULT '' NOT NULL,
	`next_step` text DEFAULT '' NOT NULL,
	`next_step_date` text DEFAULT '' NOT NULL,
	`risk_level` text DEFAULT 'Medium' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `opportunities_status_idx` ON `opportunities` (`status`);--> statement-breakpoint
CREATE INDEX `opportunities_stage_idx` ON `opportunities` (`stage`);--> statement-breakpoint
CREATE INDEX `opportunities_close_date_idx` ON `opportunities` (`close_date`);