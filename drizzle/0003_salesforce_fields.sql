ALTER TABLE `opportunities` ADD `salesforce_opportunity_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `salesforce_account_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `account_website` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `industry` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `forecast_category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `last_activity_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `source_system` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_profiles` ADD `salesforce_account_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_profiles` ADD `account_website` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `opportunities_salesforce_opportunity_idx` ON `opportunities` (`salesforce_opportunity_id`);--> statement-breakpoint
CREATE INDEX `opportunities_salesforce_account_idx` ON `opportunities` (`salesforce_account_id`);
