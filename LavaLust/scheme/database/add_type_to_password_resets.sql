-- Add type column to password_resets table to support both password and PIN resets
-- Run this migration to enable PIN reset functionality

ALTER TABLE `password_resets`
ADD COLUMN `type` ENUM('password', 'pin') NOT NULL DEFAULT 'password' AFTER `token`;

-- Add index for better query performance
ALTER TABLE `password_resets`
ADD INDEX `idx_type` (`type`);

-- Update schema comment
ALTER TABLE `password_resets` COMMENT = 'Stores reset tokens for both password and PIN resets';
