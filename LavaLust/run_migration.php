<?php
// Simple migration script to add password_reset_tokens table
define('PREVENT_DIRECT_ACCESS', TRUE);
require_once 'index.php'; // Load the framework

// Get database instance
$db = lava_instance()->db;

// Migration SQL
$sql = "
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hash of the reset token',
  `expires_at` DATETIME NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_token_hash` (`token_hash`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_password_reset_tokens_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Secure password reset tokens for account setup and password recovery';
";

try {
    // Execute the migration
    $result = $db->query($sql);

    if ($result) {
        echo "Migration completed successfully!\n";
        echo "password_reset_tokens table created.\n";
    } else {
        echo "Migration failed!\n";
    }
} catch (Exception $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
}

// Also add the must_change_password column if it doesn't exist
$alterSql = "ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`;";

try {
    $result = $db->query($alterSql);
    if ($result) {
        echo "Added must_change_password column to users table.\n";
    }
} catch (Exception $e) {
    echo "Error adding column: " . $e->getMessage() . "\n";
}
?>