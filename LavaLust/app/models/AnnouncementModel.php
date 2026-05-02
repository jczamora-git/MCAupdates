<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * AnnouncementModel - simple CRUD for announcements table
 */
class AnnouncementModel extends Model
{
    protected $table = 'announcements';

    public function get_all($filters = [])
    {
        $query = $this->db->table($this->table)
            ->select('id, title, message, audience, status, published_at, starts_at, ends_at, created_by, created_at, updated_at');

        if (!empty($filters['audience'])) {
            $query = $query->where('audience', $filters['audience']);
        }

        if (!empty($filters['created_by'])) {
            $query = $query->where('created_by', $filters['created_by']);
        }

        if (!empty($filters['status'])) {
            $query = $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $s = '%' . $filters['search'] . '%';
            $query = $query->where_group_start();
            $query = $query->like('title', $s);
            $query = $query->or_like('message', $s);
            $query = $query->where_group_end();
        }

        return $query->order_by('published_at', 'DESC')->get_all();
    }

    public function get_announcement($id)
    {
        return $this->db->table($this->table)
            ->select('id, title, message, audience, status, published_at, starts_at, ends_at, created_by, created_at, updated_at')
            ->where('id', $id)
            ->get();
    }

    public function create($data)
    {
        $now = app_now();
        $insert = [
            'title' => $data['title'] ?? '',
            'message' => $data['message'] ?? '',
            'audience' => $data['audience'] ?? 'all',
            'status' => $data['status'] ?? 'active',
            'published_at' => $data['published_at'] ?? $now,
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
            'created_by' => $data['created_by'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $res = $this->db->table($this->table)->insert($insert);
        if ($res === false) return false;
        if (is_int($res)) return $res;
        return $this->db->insert_id() ?? true;
    }

    public function update_announcement($id, $data)
    {
        $data['updated_at'] = app_now();
        $allowed = ['title','message','audience','status','published_at','starts_at','ends_at','updated_at'];
        $update = [];
        foreach ($data as $k => $v) {
            if (in_array($k, $allowed)) $update[$k] = $v;
        }
        return $this->db->table($this->table)->where('id', $id)->update($update);
    }

    public function delete_announcement($id)
    {
        // soft delete: mark as archived
        return $this->db->table($this->table)->where('id', $id)->update(['status' => 'archived', 'updated_at' => app_now()]);
    }

    /**
     * Get all announcements with per-user is_read flag.
     * @param array $filters
     * @param int|null $user_id  If provided, adds is_read column
     * @return array
     */
    public function get_all_with_read_status($filters = [], $user_id = null)
    {
        $where_clauses = ['a.status != \'archived\''];
        $params = [];
        $now = app_now();

        $includeExpired = !empty($filters['include_expired']);
        if (!$includeExpired) {
            $where_clauses[] = '(a.published_at IS NULL OR a.published_at <= ?)';
            $params[] = $now;
            $where_clauses[] = '(a.starts_at IS NULL OR a.starts_at <= ?)';
            $params[] = $now;
            $where_clauses[] = '(a.ends_at IS NULL OR a.ends_at >= ?)';
            $params[] = $now;
        }

        if (!empty($filters['audience'])) {
            $where_clauses[] = 'a.audience = ?';
            $params[] = $filters['audience'];
        }
        if (!empty($filters['created_by'])) {
            $where_clauses[] = 'a.created_by = ?';
            $params[] = $filters['created_by'];
        }
        if (!empty($filters['status'])) {
            $where_clauses[] = 'a.status = ?';
            $params[] = $filters['status'];
        }
        if (!empty($filters['search'])) {
            $s = '%' . $filters['search'] . '%';
            $where_clauses[] = '(a.title LIKE ? OR a.message LIKE ?)';
            $params[] = $s;
            $params[] = $s;
        }

        $where_sql = count($where_clauses) ? 'WHERE ' . implode(' AND ', $where_clauses) : '';

        if ($user_id) {
            $sql = "
                SELECT a.id, a.title, a.message, a.audience, a.status,
                       a.published_at, a.starts_at, a.ends_at, a.created_by,
                       a.created_at, a.updated_at,
                       CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END AS is_read,
                       ar.read_at
                FROM announcements a
                LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = ?
                $where_sql
                ORDER BY a.published_at DESC
            ";
            array_unshift($params, $user_id);
        } else {
            $sql = "
                SELECT a.id, a.title, a.message, a.audience, a.status,
                       a.published_at, a.starts_at, a.ends_at, a.created_by,
                       a.created_at, a.updated_at,
                       0 AS is_read, NULL AS read_at
                FROM announcements a
                $where_sql
                ORDER BY a.published_at DESC
            ";
        }

        $stmt = $this->db->raw($sql, $params);
        return $stmt ? $stmt->fetchAll(\PDO::FETCH_ASSOC) : [];
    }

    /**
     * Mark an announcement as read for a user (upsert).
     */
    public function mark_as_read($announcement_id, $user_id)
    {
        $sql = "INSERT INTO announcement_reads (announcement_id, user_id, read_at)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE read_at = ?";
        $now = app_now();
        $stmt = $this->db->raw($sql, [$announcement_id, $user_id, $now, $now]);
        return $stmt !== false;
    }
}
