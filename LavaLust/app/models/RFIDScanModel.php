<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class RFIDScanModel extends Model
{
    protected $table = 'rfid_scans';

    public function get_recent($date = null, $limit = 200)
    {
        $sql = "SELECT rs.*, CONCAT(u.first_name, ' ', u.last_name) as student_name\n"
             . "FROM rfid_scans rs\n"
             . "LEFT JOIN students s ON rs.student_id = s.id\n"
             . "LEFT JOIN users u ON s.user_id = u.id";

        $params = [];
        if (!empty($date)) {
            $start = $date . ' 00:00:00';
            $end = $date . ' 23:59:59';
            $sql .= "\nWHERE rs.scan_time >= ? AND rs.scan_time <= ?";
            $params[] = $start;
            $params[] = $end;
        }

        $limit = (int) $limit;
        if ($limit <= 0) {
            $limit = 200;
        }

        $sql .= "\nORDER BY rs.scan_time DESC\nLIMIT {$limit}";

        $stmt = $this->db->raw($sql, $params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function create_scan($data)
    {
        $payload = [
            'session_id' => $data['session_id'] ?? null,
            'student_id' => $data['student_id'] ?? null,
            'student_number' => $data['student_number'] ?? null,
            'rfid_code' => $data['rfid_code'],
            'scan_time' => $data['scan_time'] ?? app_now(),
            'scan_type' => $data['scan_type'],
            'status' => $data['status'] ?? 'success',
            'is_late' => $data['is_late'] ?? 0,
            'image_path' => $data['image_path'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_at' => app_now()
        ];

        return $this->db->table($this->table)->insert($payload);
    }

    public function find_session_duplicate($sessionId, $scanType, $studentId = null, $rfidCode = null)
    {
        if (empty($sessionId) || empty($scanType)) {
            return null;
        }

        $query = $this->db->table($this->table)
                          ->where('session_id', $sessionId)
                          ->where('scan_type', $scanType)
                          ->order_by('scan_time', 'DESC');

        if (!empty($studentId)) {
            $query = $query->where('student_id', $studentId);
        } elseif (!empty($rfidCode)) {
            $query = $query->where('rfid_code', $rfidCode);
        } else {
            return null;
        }

        return $query->get();
    }
}
