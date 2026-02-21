CREATE TABLE `aftermath` (
	`id` text PRIMARY KEY NOT NULL,
	`score` integer,
	`description` text,
	`icon` text,
	`color` integer
);
--> statement-breakpoint
CREATE TABLE `domain` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_domain_id` text,
	`name` text NOT NULL,
	`description` text,
	`icon` blob,
	`color` integer,
	FOREIGN KEY (`parent_domain_id`) REFERENCES `domain`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP,
	`ended_at` text DEFAULT CURRENT_TIMESTAMP,
	`task_id` text,
	`aftermath_id` text,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aftermath_id`) REFERENCES `aftermath`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`domain_id` text,
	`parent_task_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`domain_id`) REFERENCES `domain`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action
);
