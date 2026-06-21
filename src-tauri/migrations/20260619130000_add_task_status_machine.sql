CREATE TABLE `task_status` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`pos_x` real DEFAULT 0 NOT NULL,
	`pos_y` real DEFAULT 0 NOT NULL,
	`is_initial` integer DEFAULT 0,
	`color` integer
);
--> statement-breakpoint
CREATE TABLE `task_status_edge` (
	`id` text PRIMARY KEY NOT NULL,
	`from_status_id` text NOT NULL,
	`to_status_id` text NOT NULL,
	`label` text,
	FOREIGN KEY (`from_status_id`) REFERENCES `task_status`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_status_id`) REFERENCES `task_status`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `task` ADD COLUMN `task_status_id` text;
--> statement-breakpoint
INSERT INTO `task_status` (`id`, `name`, `description`, `pos_x`, `pos_y`, `is_initial`) VALUES ('status-backlog', 'Backlog', 'Task is queued but not started', 80, 120, 1);
--> statement-breakpoint
INSERT INTO `task_status` (`id`, `name`, `description`, `pos_x`, `pos_y`, `is_initial`) VALUES ('status-active', 'Active', 'Task is in progress', 360, 120, 0);
--> statement-breakpoint
INSERT INTO `task_status` (`id`, `name`, `description`, `pos_x`, `pos_y`, `is_initial`) VALUES ('status-done', 'Done', 'Task is complete', 640, 120, 0);
--> statement-breakpoint
INSERT INTO `task_status_edge` (`id`, `from_status_id`, `to_status_id`, `label`) VALUES ('edge-backlog-active', 'status-backlog', 'status-active', 'start');
--> statement-breakpoint
INSERT INTO `task_status_edge` (`id`, `from_status_id`, `to_status_id`, `label`) VALUES ('edge-active-done', 'status-active', 'status-done', 'complete');
