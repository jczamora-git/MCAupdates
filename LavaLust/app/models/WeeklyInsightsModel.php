<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class WeeklyInsightsModel extends Model
{
    protected $table = 'weekly_insights';

    public function get_by_window($windowStart, $windowEnd)
    {
        return $this->db->table($this->table)
            ->where('window_start', $windowStart)
            ->where('window_end', $windowEnd)
            ->limit(1)
            ->get();
    }

    public function save_window_insights($windowStart, $windowEnd, $insights, $totalFeedback, $modelName = null)
    {
        $payload = [
            'window_start' => $windowStart,
            'window_end' => $windowEnd,
            'insights_json' => json_encode($insights),
            'total_feedback' => $totalFeedback,
            'model' => $modelName,
            'updated_at' => app_now(),
        ];

        $existing = $this->get_by_window($windowStart, $windowEnd);
        if (!empty($existing) && isset($existing['id'])) {
            return $this->db->table($this->table)
                ->where('id', $existing['id'])
                ->update($payload);
        }

        $payload['created_at'] = app_now();

        return $this->db->table($this->table)
            ->insert($payload);
    }
}
