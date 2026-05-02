<?php
// Migration script to extend password_resets table for account setup
define('PREVENT_DIRECT_ACCESS', TRUE);
require_once 'index.php'; // Load the framework

// Get database instance
$db = lava_instance()->db;

echo "Extending password_resets table for account setup tokens...\n";

try {
    // Add user_id column
    $db->query("ALTER TABLE `password_resets` ADD COLUMN `user_id` INT UNSIGNED NULL AFTER `email`");
    echo "✓ Added user_id column\n";

    // Add foreign key constraint
    $db->query("ALTER TABLE `password_resets` ADD CONSTRAINT `fk_password_resets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE");
    echo "✓ Added foreign key constraint\n";

    // Modify type enum to include account_setup
    $db->query("ALTER TABLE `password_resets` MODIFY COLUMN `type` ENUM('password','pin','account_setup') NOT NULL DEFAULT 'password'");
    echo "✓ Extended type enum to include 'account_setup'\n";

    // Update table comment
    $db->query("ALTER TABLE `password_resets` COMMENT 'Stores reset tokens for password reset, PIN reset, and account setup'");
    echo "✓ Updated table comment\n";

    // Add must_change_password column to users table
    $db->query("ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`");
    echo "✓ Added must_change_password column to users table\n";

    echo "Migration completed successfully!\n";
    echo "The password_resets table now supports account setup tokens.\n";
    echo "The users table now has the must_change_password field.\n";

} catch (Exception $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
    echo "This might be because the columns already exist or the migration was already run.\n";
}
?>