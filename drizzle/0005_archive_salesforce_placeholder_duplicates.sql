UPDATE `opportunities`
SET `status` = 'archived', `updated_at` = CURRENT_TIMESTAMP
WHERE `status` = 'open'
  AND `source_system` = 'manual'
  AND `salesforce_opportunity_id` = ''
  AND `stage` IN ('Qualification', 'Discovery')
  AND `amount` = 0
  AND `next_step` = ''
  AND `notes` = ''
  AND EXISTS (
    SELECT 1
    FROM `opportunities` AS `imported`
    WHERE `imported`.`account_name` = `opportunities`.`account_name`
      AND `imported`.`status` = 'open'
      AND `imported`.`source_system` = 'salesforce_csv'
      AND `imported`.`salesforce_opportunity_id` <> ''
      AND `imported`.`id` <> `opportunities`.`id`
  );
