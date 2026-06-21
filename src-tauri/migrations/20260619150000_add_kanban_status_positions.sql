ALTER TABLE `task_status` ADD COLUMN `kanban_pos_x` real;
--> statement-breakpoint
ALTER TABLE `task_status` ADD COLUMN `kanban_pos_y` real;
--> statement-breakpoint
UPDATE `task_status` SET `kanban_pos_x` = `pos_x`, `kanban_pos_y` = `pos_y` WHERE `kanban_pos_x` IS NULL;
