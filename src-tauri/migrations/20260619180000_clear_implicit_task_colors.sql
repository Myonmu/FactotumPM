UPDATE `task`
SET `color` = NULL
WHERE `domain_id` IS NOT NULL
  AND `color` = (
      SELECT `domain`.`color`
      FROM `domain`
      WHERE `domain`.`id` = `task`.`domain_id`
  );
