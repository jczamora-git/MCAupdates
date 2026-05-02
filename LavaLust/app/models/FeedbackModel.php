<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class FeedbackModel extends Model
{
    protected $table = 'feedback';

    public function get_all($filters = [])
    {
        $query = $this->db->table($this->table . ' f')
            ->left_join('users u', 'f.user_id = u.id')
            ->left_join('users r', 'f.responded_by = r.id')
            ->select('f.*, u.first_name, u.last_name, u.email, r.first_name as responder_first_name, r.last_name as responder_last_name, r.email as responder_email');

        if (!empty($filters['sentiment'])) {
            $query = $query->where('f.sentiment', $filters['sentiment']);
        }

        if (!empty($filters['category'])) {
            $query = $query->where('f.category', $filters['category']);
        }

        if (!empty($filters['search'])) {
            $s = '%' . $filters['search'] . '%';
            $query = $query->where_group_start();
            $query = $query->like('f.title', $s);
            $query = $query->or_like('f.message', $s);
            $query = $query->where_group_end();
        }

        return $query->order_by('f.created_at', 'DESC')->get_all();
    }

    public function get_by_user($user_id)
    {
        return $this->db->table($this->table . ' f')
            ->left_join('users u', 'f.user_id = u.id')
            ->left_join('users r', 'f.responded_by = r.id')
            ->select('f.*, u.first_name, u.last_name, u.email, r.first_name as responder_first_name, r.last_name as responder_last_name, r.email as responder_email')
            ->where('f.user_id', $user_id)
            ->order_by('f.created_at', 'DESC')
            ->get_all();
    }

    public function get_recent($days)
    {
        $days = (int) $days;
        if ($days <= 0) {
            $days = 7;
        }

        $window = max(0, $days - 1);
        $start = date('Y-m-d 00:00:00', strtotime("-{$window} days"));

        return $this->db->table($this->table . ' f')
            ->left_join('users u', 'f.user_id = u.id')
            ->left_join('users r', 'f.responded_by = r.id')
            ->select('f.*, u.first_name, u.last_name, u.email, r.first_name as responder_first_name, r.last_name as responder_last_name, r.email as responder_email')
            ->where('f.created_at', '>=', $start)
            ->order_by('f.created_at', 'DESC')
            ->get_all();
    }

    public function create($data)
    {
        $now = app_now();
        $insert = [
            'user_id' => $data['user_id'] ?? null,
            'role' => $data['role'] ?? 'student',
            'category' => $data['category'] ?? 'General',
            'title' => $data['title'] ?? null,
            'message' => $data['message'] ?? '',
            'sentiment' => $data['sentiment'] ?? null,
            'confidence' => $data['confidence'] ?? null,
            'probabilities' => $data['probabilities'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $res = $this->db->table($this->table)->insert($insert);
        if ($res === false) return false;
        if (is_int($res)) return $res;
        return $this->db->insert_id() ?? true;
    }

    public function update_sentiment($id, $data)
    {
        $update = [
            'sentiment' => $data['sentiment'] ?? null,
            'confidence' => $data['confidence'] ?? null,
            'probabilities' => $data['probabilities'] ?? null,
            'updated_at' => app_now(),
        ];

        return $this->db->table($this->table)
            ->where('id', $id)
            ->update($update);
    }

    public function update_response($id, $data)
    {
        $update = [
            'response_text' => $data['response_text'] ?? null,
            'responded_by' => $data['responded_by'] ?? null,
            'responded_at' => $data['responded_at'] ?? null,
            'updated_at' => app_now(),
        ];

        return $this->db->table($this->table)
            ->where('id', $id)
            ->update($update);
    }
}
