CREATE TABLE `session_edge` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`task_id` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_edge_session_task_unique` ON `session_edge` (`session_id`, `task_id`);
--> statement-breakpoint
INSERT INTO `session_edge` (`id`, `session_id`, `task_id`)
SELECT lower(hex(randomblob(16))), `id`, `task_id`
FROM `session`
WHERE `task_id` IS NOT NULL AND trim(`task_id`) != '';
--> statement-breakpoint
CREATE TABLE `session_new` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	`ended_at` text DEFAULT CURRENT_TIMESTAMP,
	`status` integer DEFAULT 0 NOT NULL,
	`aftermath_id` text,
	FOREIGN KEY (`aftermath_id`) REFERENCES `aftermath`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `session_new` (`id`, `started_at`, `ended_at`, `status`, `aftermath_id`)
SELECT
	`id`,
	`started_at`,
	`ended_at`,
	CASE
		WHEN `status` = 'started' THEN 1
		WHEN `status` = 'finished' THEN 2
		ELSE 0
	END,
	`aftermath_id`
FROM `session`;
--> statement-breakpoint
DROP TABLE `session`;
--> statement-breakpoint
ALTER TABLE `session_new` RENAME TO `session`;
