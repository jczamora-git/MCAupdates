-- Enrollment Tables Schema
-- Run this SQL to create the enrollment-related tables

-- Table: enrollments
-- Stores parent enrollment submissions for new learners
CREATE TABLE IF NOT EXISTS `enrollments` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` bigint UNSIGNED NOT NULL,
  
  -- Learner Information
  `learner_first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `learner_middle_name` varchar(100) COLLATE utf8mb4_unicode_ci,
  `learner_last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `birth_date` date NOT NULL,
  `gender` enum('Male', 'Female') COLLATE utf8mb4_unicode_ci NOT NULL,
  `psa_birth_cert_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grade_level` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'e.g., Nursery 1, Kinder, Grade 1, etc.',
  
  -- Current Address
  `current_address` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_barangay` varchar(100) COLLATE utf8mb4_unicode_ci,
  `current_municipality` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_province` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_zip_code` varchar(10) COLLATE utf8mb4_unicode_ci,
  `current_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  
  -- Permanent Address
  `permanent_address` varchar(255) COLLATE utf8mb4_unicode_ci,
  `permanent_barangay` varchar(100) COLLATE utf8mb4_unicode_ci,
  `permanent_municipality` varchar(100) COLLATE utf8mb4_unicode_ci,
  `permanent_province` varchar(100) COLLATE utf8mb4_unicode_ci,
  `permanent_zip_code` varchar(10) COLLATE utf8mb4_unicode_ci,
  
  -- Special Information
  `is_returning_student` tinyint(1) DEFAULT 0,
  `is_indigenous_ip` tinyint(1) DEFAULT 0,
  `is_4ps_beneficiary` tinyint(1) DEFAULT 0,
  `has_disability` tinyint(1) DEFAULT 0,
  `disability_type` varchar(100) COLLATE utf8mb4_unicode_ci,
  `special_language` varchar(100) COLLATE utf8mb4_unicode_ci,
  
  -- Parent/Guardian Information
  `father_name` varchar(150) COLLATE utf8mb4_unicode_ci,
  `father_contact` varchar(20) COLLATE utf8mb4_unicode_ci,
  `father_email` varchar(100) COLLATE utf8mb4_unicode_ci,
  `mother_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mother_contact` varchar(20) COLLATE utf8mb4_unicode_ci,
  `mother_email` varchar(100) COLLATE utf8mb4_unicode_ci,
  `guardian_name` varchar(150) COLLATE utf8mb4_unicode_ci,
  `guardian_contact` varchar(20) COLLATE utf8mb4_unicode_ci,
  `guardian_email` varchar(100) COLLATE utf8mb4_unicode_ci,
  
  -- Enrollment Status
  `status` enum('pending', 'incomplete', 'under_review', 'approved', 'rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `status_notes` text COLLATE utf8mb4_unicode_ci COMMENT 'Admin notes or rejection reason',
  `is_complete` tinyint(1) DEFAULT 0 COMMENT 'All steps completed',
  
  -- Timestamps
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_learner_name` (`learner_first_name`, `learner_last_name`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_enrollment_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Parent enrollment submissions for new learners';

-- Table: enrollment_documents
-- Stores uploaded documents for enrollments
CREATE TABLE IF NOT EXISTS `enrollment_documents` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` bigint UNSIGNED NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Stored filename (unique)',
  `original_file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original filename from upload',
  `file_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'e.g., application/pdf, image/jpeg',
  `file_size` int UNSIGNED NOT NULL COMMENT 'Size in bytes',
  `verification_status` enum('pending', 'verified', 'rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `verification_notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  KEY `idx_enrollment_id` (`enrollment_id`),
  KEY `idx_verification_status` (`verification_status`),
  CONSTRAINT `fk_enrollment_doc` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Uploaded documents for enrollment applications';

-- Table: enrollment_status_logs (Optional - for audit trail)
-- Tracks status changes and admin actions
CREATE TABLE IF NOT EXISTS `enrollment_status_logs` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` bigint UNSIGNED NOT NULL,
  `admin_id` bigint UNSIGNED,
  `old_status` varchar(50) COLLATE utf8mb4_unicode_ci,
  `new_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  KEY `idx_enrollment_id` (`enrollment_id`),
  KEY `idx_admin_id` (`admin_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_log_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_log_admin` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit log for enrollment status changes';

-- Create uploads directory structure (via application)
-- The PHP application will create: /public/uploads/enrollments/{enrollment_id}/

-- Create index for faster queries
ALTER TABLE `enrollments` ADD UNIQUE KEY `uk_enrollment_duplicate_check` 
  (`user_id`, `learner_first_name`, `learner_last_name`, `birth_date`);
