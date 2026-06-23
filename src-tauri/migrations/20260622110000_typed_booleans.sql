UPDATE `task` SET `is_trophy` = 0 WHERE `is_trophy` IS NULL;
UPDATE `task` SET `route_pos_manual` = 0 WHERE `route_pos_manual` IS NULL;
UPDATE `task_status` SET `is_initial` = 0 WHERE `is_initial` IS NULL;
UPDATE `task_status` SET `is_terminal` = 0 WHERE `is_terminal` IS NULL;
