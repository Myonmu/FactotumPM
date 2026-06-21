CREATE TABLE `task_dependency` (
	`id` text PRIMARY KEY NOT NULL,
	`from_task_id` text NOT NULL,
	`to_task_id` text NOT NULL,
	FOREIGN KEY (`from_task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_dependency_from_to_unique` ON `task_dependency` (`from_task_id`, `to_task_id`);
