<?php
// Simple migration script to add must_change_password column
define('PREVENT_DIRECT_ACCESS', TRUE);
require_once 'index.php'; // Load the framework

// Get database instance
$db = lava_instance()->db;

// Migration SQL
$sql = "ALTER TABLE `users` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`;";

try {
    // Execute the migration
    $result = $db->query($sql);

    if ($result) {
        echo "Migration completed successfully!\n";
        echo "Added must_change_password column to users table.\n";
    } else {
        echo "Migration failed!\n";
    }
} catch (Exception $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
}
?>