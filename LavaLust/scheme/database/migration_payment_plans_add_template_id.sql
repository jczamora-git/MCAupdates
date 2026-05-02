-- Migration: Add template_id to payment_plans table
-- Date: 2026-02-19
-- Purpose: Link payment plans to payment schedule templates for flexible installment scheduling

-- Add template_id column
ALTER TABLE `payment_plans`
ADD COLUMN `template_id` INT UNSIGNED NULL COMMENT 'References payment_schedule_templates' AFTER `number_of_installments`,
ADD INDEX `idx_template_id` (`template_id`);

-- Add foreign key constraint (optional - can be commented out if you want to allow orphaned references)
-- ALTER TABLE `payment_plans`
-- ADD CONSTRAINT `fk_payment_plans_template`
-- FOREIGN KEY (`template_id`) REFERENCES `payment_schedule_templates` (`id`)
-- ON DELETE SET NULL
-- ON UPDATE CASCADE;
