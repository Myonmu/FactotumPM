CREATE TABLE `observation` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`confidence` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
