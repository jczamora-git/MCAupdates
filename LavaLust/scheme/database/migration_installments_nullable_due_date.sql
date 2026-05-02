-- Migration: Make due_date nullable in installments table
-- Date: 2026-02-19
-- Purpose: Allow "Upon Enrollment" installments to have flexible due dates

-- Modify due_date column to allow NULL
ALTER TABLE `installments`
MODIFY COLUMN `due_date` DATE NULL COMMENT 'Payment deadline (NULL for Upon Enrollment - to be set later)';
