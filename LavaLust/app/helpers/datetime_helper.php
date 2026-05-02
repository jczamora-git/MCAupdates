<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

if (!function_exists('db_time_value')) {
    function db_time_value($sql, $field)
    {
        static $cache = [];
        $cacheKey = $sql . '|' . $field;
        if (array_key_exists($cacheKey, $cache)) {
            return $cache[$cacheKey];
        }

        try {
            if (!class_exists('Database')) {
                $cache[$cacheKey] = null;
                return null;
            }

            $db = Database::instance('main');
            $row = $db->raw($sql)->fetch(PDO::FETCH_ASSOC);

            if (is_array($row) && isset($row[$field])) {
                $cache[$cacheKey] = $row[$field];
                return $cache[$cacheKey];
            }
        } catch (Throwable $e) {
            // Fallback to PHP runtime time when DB time lookup is unavailable.
        }

        $cache[$cacheKey] = null;
        return null;
    }
}

if (!function_exists('app_now')) {
    function app_now($format = 'Y-m-d H:i:s')
    {
        $dbNow = db_time_value('SELECT NOW() AS current_datetime', 'current_datetime');
        if (!empty($dbNow)) {
            $ts = strtotime($dbNow);
            if ($ts !== false) {
                return date($format, $ts);
            }

            // If parsing fails, return raw DB value for default format.
            if ($format === 'Y-m-d H:i:s') {
                return $dbNow;
            }
        }

        return date($format);
    }
}

if (!function_exists('app_today')) {
    function app_today($format = 'Y-m-d')
    {
        $dbToday = db_time_value('SELECT CURDATE() AS current_date', 'current_date');
        if (!empty($dbToday)) {
            $ts = strtotime($dbToday . ' 00:00:00');
            if ($ts !== false) {
                return date($format, $ts);
            }

            if ($format === 'Y-m-d') {
                return $dbToday;
            }
        }

        return date($format);
    }
}
