ALTER TABLE `task_status` ADD COLUMN `is_terminal` integer DEFAULT 0;
--> statement-breakpoint
UPDATE `task_status` SET `is_terminal` = 1 WHERE `id` = 'status-done';
