ALTER TABLE `session` ADD COLUMN `status` text DEFAULT 'planned' NOT NULL;
--> statement-breakpoint
UPDATE `session` SET `status` = 'finished' WHERE `aftermath_id` IS NOT NULL;
