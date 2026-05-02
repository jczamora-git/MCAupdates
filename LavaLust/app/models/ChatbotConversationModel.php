<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class ChatbotConversationModel extends Model
{
    protected $table = 'chatbot_conversations';

    public function find_cached_reply($normalizedMessage, $role = null, $allowedSources = null)
    {
        if (empty($normalizedMessage)) {
            return null;
        }

        $query = $this->db->table($this->table)
            ->where('normalized_message', $normalizedMessage)
            ->order_by('created_at', 'DESC');

        if (!empty($role)) {
            $query->where('role', $role);
        }

        if (!empty($allowedSources) && is_array($allowedSources)) {
            $query = $query->grouped(function ($db) use ($allowedSources) {
                foreach ($allowedSources as $index => $source) {
                    if ($index === 0) {
                        $db->where('source', $source);
                    } else {
                        $db->or_where('source', $source);
                    }
                }
            });
        }

        return $query->get();
    }

    public function create_entry($data)
    {
        $payload = [
            'user_id' => $data['user_id'] ?? null,
            'role' => $data['role'] ?? null,
            'message' => $data['message'] ?? '',
            'normalized_message' => $data['normalized_message'] ?? '',
            'reply' => $data['reply'] ?? '',
            'source' => $data['source'] ?? 'unknown',
            'created_at' => app_now(),
        ];

        return $this->db->table($this->table)->insert($payload);
    }
}
