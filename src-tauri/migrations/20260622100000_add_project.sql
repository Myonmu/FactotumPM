CREATE TABLE `project` (
    `id` text PRIMARY KEY NOT NULL,
    `name` text NOT NULL,
    `description` text,
    `color` integer,
    `icon` text,
    `created_at` text DEFAULT CURRENT_TIMESTAMP,
    `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE `task` ADD COLUMN `project_id` text REFERENCES `project`(`id`);

ALTER TABLE `session` ADD COLUMN `project_id` text REFERENCES `project`(`id`);

ALTER TABLE `domain` ADD COLUMN `project_id` text REFERENCES `project`(`id`);

ALTER TABLE `aftermath` ADD COLUMN `project_id` text REFERENCES `project`(`id`);

ALTER TABLE `task_status` ADD COLUMN `project_id` text REFERENCES `project`(`id`);

CREATE TABLE `kanban_graph_position` (
    `id` text PRIMARY KEY NOT NULL,
    `project_id` text REFERENCES `project`(`id`),
    `task_status_id` text NOT NULL REFERENCES `task_status`(`id`),
    `pos_x` real NOT NULL DEFAULT 0,
    `pos_y` real NOT NULL DEFAULT 0
);
