-- Add submission_url column to activity_submissions table
-- For link-based submissions

ALTER TABLE `activity_submissions` 
ADD COLUMN `submission_url` VARCHAR(1000) NULL COMMENT 'For link-based submissions' AFTER `submission_text`;
