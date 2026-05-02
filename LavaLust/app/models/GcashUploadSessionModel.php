<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class GcashUploadSessionModel extends Model
{
    public function create($data)
    {
        $this->db->table('payment_proof_sessions')->insert($data);
        return $this->db->last_id();
    }

    /**
     * Get session by token and attach the student's full name from the users table.
     * Two queries to avoid comma-splitting issues in the framework's select() method.
     */
    public function get_by_token($token)
    {
        $session = $this->db->table('payment_proof_sessions')
            ->where('token', $token)
            ->get();

        if ($session) {
            $user = $this->db->table('users')
                ->where('id', $session['user_id'])
                ->get();

            if ($user) {
                $mn = (!empty($user['middle_name'])) ? ' ' . $user['middle_name'] : '';
                $session['student_name'] = $user['first_name'] . $mn . ' ' . $user['last_name'];
            } else {
                $session['student_name'] = 'Student';
            }
        }

        return $session;
    }

    public function update_status($token, $status)
    {
        $this->db->table('payment_proof_sessions')
            ->where('token', $token)
            ->update(['status' => $status]);
    }

    public function record_upload($token, $data)
    {
        $this->db->table('payment_proof_sessions')
            ->where('token', $token)
            ->update($data);
    }
}
