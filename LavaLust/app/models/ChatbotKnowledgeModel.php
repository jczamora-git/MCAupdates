<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class ChatbotKnowledgeModel extends Model
{
    protected $table = 'chatbot_knowledge';

    public function get_all($search = null)
    {
        $query = $this->db->table($this->table)
            ->order_by('updated_at', 'DESC');

        if (!empty($search)) {
            $s = '%' . $search . '%';
            $query = $query->grouped(function ($db) use ($s) {
                $db->like('title', $s)
                   ->or_like('content', $s)
                   ->or_like('tags', $s)
                   ->or_like('route', $s);
            });
        }

        return $query->get_all();
    }

    public function get_active_for_query($queryText, $limit = 5)
    {
        $query = $this->db->table($this->table)
            ->where('is_active', 1)
            ->order_by('updated_at', 'DESC');

        if (!empty($queryText)) {
            $raw = preg_split('/\s+/', mb_strtolower($queryText));
            $terms = [];
            foreach ($raw as $term) {
                $term = trim($term);
                if ($term !== '' && mb_strlen($term) >= 3) {
                    $terms[] = $term;
                }
                if (count($terms) >= 5) {
                    break;
                }
            }

            if (!empty($terms)) {
                $query = $query->grouped(function ($db) use ($terms) {
                    foreach ($terms as $term) {
                        $s = '%' . $term . '%';
                        $db->or_like('title', $s)
                           ->or_like('content', $s)
                           ->or_like('tags', $s)
                           ->or_like('route', $s);
                    }
                });
            }
        }

        return $query->limit($limit)->get_all();
    }

    public function create_entry($data)
    {
        $payload = [
            'title' => $data['title'] ?? '',
            'content' => $data['content'] ?? '',
            'tags' => $data['tags'] ?? null,
            'route' => $data['route'] ?? null,
            'is_active' => $data['is_active'] ?? 1,
            'created_by' => $data['created_by'] ?? null,
            'updated_by' => $data['updated_by'] ?? null,
            'created_at' => app_now(),
            'updated_at' => app_now(),
        ];

        return $this->db->table($this->table)->insert($payload);
    }

    public function update_entry($id, $data)
    {
        $payload = [
            'title' => $data['title'] ?? '',
            'content' => $data['content'] ?? '',
            'tags' => $data['tags'] ?? null,
            'route' => $data['route'] ?? null,
            'is_active' => $data['is_active'] ?? 1,
            'updated_by' => $data['updated_by'] ?? null,
            'updated_at' => app_now(),
        ];

        return $this->db->table($this->table)
            ->where('id', $id)
            ->update($payload);
    }

    public function delete_entry($id)
    {
        return $this->db->table($this->table)
            ->where('id', $id)
            ->delete();
    }

    public function toggle_active($id, $isActive, $updatedBy = null)
    {
        return $this->db->table($this->table)
            ->where('id', $id)
            ->update([
                'is_active' => $isActive ? 1 : 0,
                'updated_by' => $updatedBy,
                'updated_at' => app_now(),
            ]);
    }
}
