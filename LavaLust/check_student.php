<?php
// Quick script to check student creation issue
require_once 'app/config/database.php';

$conn = new mysqli('localhost', 'root', '', 'capstonedb');

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "=== Checking user_id 438 ===\n";
$result = $conn->query("SELECT * FROM students WHERE user_id = 438");
if ($result && $result->num_rows > 0) {
    echo "User 438 ALREADY has a student profile:\n";
    while($row = $result->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "User 438 does NOT have a student profile yet\n";
}

echo "\n=== Current year levels ===\n";
$result = $conn->query("SELECT * FROM year_levels ORDER BY `order`");
if ($result) {
    while($row = $result->fetch_assoc()) {
        echo "ID: {$row['id']}, Name: {$row['name']}, Order: {$row['order']}\n";
    }
}

echo "\n=== Recent student IDs (MCAF2026-*) ===\n";
$result = $conn->query("SELECT student_id, user_id, year_level FROM students WHERE student_id LIKE 'MCAF2026-%' ORDER BY student_id DESC LIMIT 10");
if ($result) {
    while($row = $result->fetch_assoc()) {
        echo "ID: {$row['student_id']}, UserID: {$row['user_id']}, YearLevel: {$row['year_level']}\n";
    }
}

$conn->close();
