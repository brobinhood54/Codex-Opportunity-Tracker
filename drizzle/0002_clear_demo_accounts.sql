DELETE FROM `research_briefs`
WHERE `account_name` IN (
  'Northstar Health',
  'Atlas Robotics',
  'Brightline Foods',
  'Cobalt Bank'
);
--> statement-breakpoint
DELETE FROM `call_transcripts`
WHERE `account_name` IN (
  'Northstar Health',
  'Atlas Robotics',
  'Brightline Foods',
  'Cobalt Bank'
);
--> statement-breakpoint
DELETE FROM `context_sources`
WHERE `account_name` IN (
  'Northstar Health',
  'Atlas Robotics',
  'Brightline Foods',
  'Cobalt Bank'
);
--> statement-breakpoint
DELETE FROM `account_profiles`
WHERE `account_name` IN (
  'Northstar Health',
  'Atlas Robotics',
  'Brightline Foods',
  'Cobalt Bank'
);
--> statement-breakpoint
DELETE FROM `opportunities`
WHERE `account_name` IN (
  'Northstar Health',
  'Atlas Robotics',
  'Brightline Foods',
  'Cobalt Bank'
);
