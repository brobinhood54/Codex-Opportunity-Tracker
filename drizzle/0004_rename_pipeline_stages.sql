UPDATE `opportunities`
SET `stage` = 'Qualification', `progress` = 15
WHERE `stage` = 'Qualified';
--> statement-breakpoint
UPDATE `opportunities`
SET `progress` = 30
WHERE `stage` = 'Discovery';
--> statement-breakpoint
UPDATE `opportunities`
SET `stage` = 'POV Planning', `progress` = 45
WHERE `stage` = 'Solution';
--> statement-breakpoint
UPDATE `opportunities`
SET `progress` = 60
WHERE `stage` = 'POV';
--> statement-breakpoint
UPDATE `opportunities`
SET `stage` = 'Decision / Negotiations', `progress` = 75
WHERE `stage` IN ('Proposal', 'Negotiation');
--> statement-breakpoint
UPDATE `opportunities`
SET `stage` = 'Closed', `progress` = 100
WHERE `stage` = 'Commit';
