<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class RFIDSessionModel extends Model
{
    protected $table = 'rfid_sessions';

    public function get_for_date($date)
    {
        $start = $date . ' 00:00:00';
        $end = $date . ' 23:59:59';

        return $this->db->table($this->table)
                        ->where('scheduled_start', '>=', $start)
                        ->where('scheduled_start', '<=', $end)
                        ->order_by('scheduled_start', 'ASC')
                        ->get_all();
    }

    public function get_active($sessionType = null)
    {
        $query = $this->db->table($this->table)
                          ->where('status', 'active')
                          ->order_by('actual_start', 'DESC');

        if (!empty($sessionType)) {
            $query = $query->where('session_type', $sessionType);
        }

        return $query->get();
    }

    public function get_latest_for_type($sessionType, $date)
    {
        $start = $date . ' 00:00:00';
        $end = $date . ' 23:59:59';

        return $this->db->table($this->table)
                        ->where('session_type', $sessionType)
                        ->where('scheduled_start', '>=', $start)
                        ->where('scheduled_start', '<=', $end)
                        ->order_by('scheduled_start', 'DESC')
                        ->get();
    }

    public function find_current_for_time($dateTime, $sessionType = null)
    {
        $query = $this->db->table($this->table)
                          ->where('scheduled_start', '<=', $dateTime)
                          ->where('scheduled_end', '>=', $dateTime)
                          ->order_by('scheduled_start', 'DESC');

        if (!empty($sessionType)) {
            $query = $query->where('session_type', $sessionType);
        }

        return $query->get();
    }

    public function create_session($data)
    {
        $payload = [
            'label' => $data['label'],
            'session_type' => $data['session_type'],
            'scheduled_start' => $data['scheduled_start'],
            'scheduled_end' => $data['scheduled_end'],
            'status' => $data['status'] ?? 'scheduled',
            'created_by' => $data['created_by'] ?? null,
            'created_at' => app_now(),
            'updated_at' => app_now()
        ];

        return $this->db->table($this->table)->insert($payload);
    }

    public function start_session($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update([
                            'actual_start' => app_now(),
                            'status' => 'active',
                            'updated_at' => app_now()
                        ]);
    }

    public function end_session($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update([
                            'actual_end' => app_now(),
                            'status' => 'closed',
                            'updated_at' => app_now()
                        ]);
    }
}
