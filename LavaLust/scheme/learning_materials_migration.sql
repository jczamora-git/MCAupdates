-- Learning Materials Table Migration
-- This table stores learning materials (text content, uploaded files, and shared links)
-- Created for Course Management - Learning Materials feature

CREATE TABLE IF NOT EXISTS `learning_materials` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `subject_id` int UNSIGNED NOT NULL COMMENT 'Reference to subjects table',
  `section_id` int UNSIGNED DEFAULT NULL COMMENT 'Optional: Reference to sections table',
  `type` enum('text','file','link') NOT NULL COMMENT 'Material type: text (composed), file (uploaded), link (shared URL)',
  `title` varchar(255) NOT NULL COMMENT 'Material title',
  `description` text DEFAULT NULL COMMENT 'Material description or composed text content (HTML)',
  `file_url` varchar(500) DEFAULT NULL COMMENT 'Full URL to uploaded file (for type=file)',
  `file_name` varchar(255) DEFAULT NULL COMMENT 'Original filename (for type=file)',
  `file_size` int DEFAULT NULL COMMENT 'File size in bytes (for type=file)',
  `link_url` varchar(500) DEFAULT NULL COMMENT 'Shared URL (for type=link)',
  `created_by` int UNSIGNED NOT NULL COMMENT 'Teacher user ID who created this material',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_subject_id` (`subject_id`),
  KEY `idx_section_id` (`section_id`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_type` (`type`),
  KEY `idx_subject_section` (`subject_id`, `section_id`),
  KEY `idx_created_at` (`created_at` DESC),
  CONSTRAINT `fk_learning_materials_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_learning_materials_section` FOREIGN KEY (`section_id`) REFERENCES `sections` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_learning_materials_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Stores learning materials for subjects/sections';

-- Sample data (optional - remove if not needed)
-- INSERT INTO learning_materials (subject_id, section_id, type, title, description, created_by) VALUES
-- (29, 1, 'text', 'Welcome to Reading Readiness', '<p><strong>Welcome!</strong> This is a sample text material.</p>', 2),
-- (29, 1, 'link', 'Reading Tutorial Video', 'Great tutorial for beginners', 2);
