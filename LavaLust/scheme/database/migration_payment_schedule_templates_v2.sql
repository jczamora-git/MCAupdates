-- Migration: Update payment schedule templates for week-based scheduling
-- Date: 2026-02-19
-- Description: Redesign payment schedule templates to support week-of-month format without academic period dependency

-- Step 1: Alter payment_schedule_templates table
ALTER TABLE `payment_schedule_templates` 
  MODIFY COLUMN `schedule_type` ENUM('Monthly','Quarterly','Semestral','Tri Semestral') COLLATE utf8mb4_unicode_ci NOT NULL,
  DROP COLUMN `academic_period_id`,
  ADD COLUMN `status` ENUM('active','inactive') DEFAULT 'active' AFTER `is_active`,
  MODIFY COLUMN `is_default` TINYINT(1) DEFAULT '0' COMMENT 'Deprecated - use status instead',
  MODIFY COLUMN `is_active` TINYINT(1) DEFAULT '1' COMMENT 'Deprecated - use status instead';

-- Step 2: Alter payment_schedule_installment_templates table
ALTER TABLE `payment_schedule_installment_templates`
  DROP COLUMN `due_date_offset_days`,
  DROP COLUMN `due_date_fixed`,
  DROP COLUMN `percentage_of_total`,
  DROP COLUMN `fixed_amount`,
  ADD COLUMN `month` VARCHAR(2) NULL COMMENT 'Month number 01-12, NULL for Upon Enrollment' AFTER `installment_number`,
  ADD COLUMN `week_of_month` VARCHAR(20) NOT NULL COMMENT 'Upon Enrollment, 1st week, 2nd week, 3rd week, 4th week, Last week' AFTER `month`,
  MODIFY COLUMN `label` VARCHAR(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display text: e.g., "January - 2nd week"';

-- Step 3: Add indexes for better performance
ALTER TABLE `payment_schedule_templates`
  ADD INDEX `idx_schedule_type` (`schedule_type`),
  ADD INDEX `idx_status` (`status`);

ALTER TABLE `payment_schedule_installment_templates`
  ADD INDEX `idx_template_installment` (`template_id`, `installment_number`);

-- Step 4: Create table for tracking overdue penalties (for actual payment plans, not templates)
CREATE TABLE IF NOT EXISTS `payment_installment_penalties` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `installment_id` INT UNSIGNED NOT NULL COMMENT 'References payment_plan_installments.id',
  `penalty_percentage` DECIMAL(5,2) NOT NULL DEFAULT 5.00 COMMENT 'Penalty percentage (e.g., 5.00 for 5%)',
  `penalty_amount` DECIMAL(10,2) NOT NULL COMMENT 'Calculated penalty amount',
  `original_amount` DECIMAL(10,2) NOT NULL COMMENT 'Original installment amount',
  `days_overdue` INT NOT NULL COMMENT 'Number of days overdue when penalty was calculated',
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `waived` TINYINT(1) DEFAULT '0' COMMENT 'If penalty was waived by admin',
  `waived_by` INT UNSIGNED NULL COMMENT 'Admin user who waived it',
  `waived_at` TIMESTAMP NULL,
  `notes` TEXT COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_installment` (`installment_id`),
  KEY `idx_applied_at` (`applied_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 5: Update existing data (if any)
-- Set all existing templates to 'active' status
UPDATE `payment_schedule_templates` SET `status` = 'active' WHERE `is_active` = 1;
UPDATE `payment_schedule_templates` SET `status` = 'inactive' WHERE `is_active` = 0;

-- Note: Existing installment templates will need manual data migration if they exist
-- The new structure is incompatible with offset days approach

DELIMITER //

CREATE TRIGGER `calculate_overdue_penalty` BEFORE INSERT ON `payment_installment_penalties`
FOR EACH ROW
BEGIN
  SET NEW.penalty_amount = NEW.original_amount * (NEW.penalty_percentage / 100);
END//

DELIMITER ;

-- Sample data for testing (optional - remove in production)
-- INSERT INTO `payment_schedule_templates` (`name`, `description`, `schedule_type`, `number_of_installments`, `status`)
-- VALUES 
-- ('Standard Monthly Plan', 'Default monthly payment schedule for academic year', 'Monthly', 10, 'active'),
-- ('Standard Quarterly Plan', 'Default quarterly payment schedule', 'Quarterly', 4, 'active'),
-- ('Standard Semestral Plan', 'Default semestral payment schedule', 'Semestral', 2, 'active');
