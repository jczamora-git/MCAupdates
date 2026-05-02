<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class ConcernModel extends Model
{
    protected $ticketsTable = 'concern_tickets';
    protected $messagesTable = 'concern_messages';

    public function get_all_tickets($filters = [])
    {
        $query = $this->db->table($this->ticketsTable . ' t')
            ->left_join('users u', 't.user_id = u.id')
            ->select('t.*, u.first_name, u.last_name, u.email');

        if (!empty($filters['status'])) {
            $query = $query->where('t.status', $filters['status']);
        }

        if (!empty($filters['category'])) {
            $query = $query->where('t.category', $filters['category']);
        }

        // Apply limit and offset for pagination (before search filter for better performance)
        $limit = isset($filters['limit']) ? (int)$filters['limit'] : null;
        $offset = isset($filters['offset']) ? (int)$filters['offset'] : 0;

        $tickets = $query
            ->order_by('t.last_message_at', 'DESC')
            ->order_by('t.created_at', 'DESC');
        
        // Only apply limit if specified (for pagination)
        if ($limit !== null && $limit > 0) {
            $tickets = $tickets->limit($offset, $limit);
        }
        
        $tickets = $tickets->get_all();

        $rows = is_array($tickets) ? $tickets : [];

        if (!empty($filters['search'])) {
            $needle = strtolower(trim((string)$filters['search']));
            if ($needle !== '') {
                $rows = array_values(array_filter($rows, function ($ticket) use ($needle) {
                    $firstName = strtolower((string)($ticket['first_name'] ?? ''));
                    $lastName = strtolower((string)($ticket['last_name'] ?? ''));
                    $fullName = trim($firstName . ' ' . $lastName);

                    $haystacks = [
                        strtolower((string)($ticket['ticket_no'] ?? '')),
                        strtolower((string)($ticket['subject'] ?? '')),
                        strtolower((string)($ticket['email'] ?? '')),
                        $firstName,
                        $lastName,
                        $fullName,
                    ];

                    foreach ($haystacks as $haystack) {
                        if ($haystack !== '' && strpos($haystack, $needle) !== false) {
                            return true;
                        }
                    }

                    return false;
                }));
            }
        }

        return $rows;
    }

    public function get_tickets_by_user($user_id)
    {
        $tickets = $this->db->table($this->ticketsTable . ' t')
            ->left_join('users u', 't.user_id = u.id')
            ->select('t.*, u.first_name, u.last_name, u.email')
            ->where('t.user_id', $user_id)
            ->order_by('t.last_message_at', 'DESC')
            ->order_by('t.created_at', 'DESC')
            ->get_all();

        return is_array($tickets) ? $tickets : [];
    }

    public function get_ticket_by_id($ticket_id)
    {
        return $this->db->table($this->ticketsTable . ' t')
            ->left_join('users u', 't.user_id = u.id')
            ->select('t.*, u.first_name, u.last_name, u.email')
            ->where('t.id', $ticket_id)
            ->get();
    }

    public function create_ticket($data)
    {
        $now = app_now();

        $insert = [
            'ticket_no' => $data['ticket_no'],
            'user_id' => $data['user_id'] ?? null,
            'category' => $data['category'] ?? 'General',
            'subject' => $data['subject'],
            'status' => $data['status'] ?? 'Open',
            'overall_sentiment' => $data['overall_sentiment'] ?? null,
            'overall_confidence' => $data['overall_confidence'] ?? null,
            'sentiment_updated_at' => $data['sentiment_updated_at'] ?? null,
            'last_message_at' => $data['last_message_at'] ?? $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $res = $this->db->table($this->ticketsTable)->insert($insert);
        if ($res === false) return false;
        if (is_int($res)) return $res;

        return $this->db->insert_id() ?? true;
    }

    public function add_message($data)
    {
        $now = app_now();

        $insert = [
            'ticket_id' => $data['ticket_id'],
            'sender_user_id' => $data['sender_user_id'] ?? null,
            'message' => $data['message'],
            'sentiment' => $data['sentiment'] ?? null,
            'confidence' => $data['confidence'] ?? null,
            'probabilities' => $data['probabilities'] ?? null,
            'analyzed_at' => $data['analyzed_at'] ?? null,
            'created_at' => $now,
        ];

        $res = $this->db->table($this->messagesTable)->insert($insert);
        if ($res === false) return false;
        if (is_int($res)) return $res;

        return $this->db->insert_id() ?? true;
    }

    public function get_messages_by_ticket($ticket_id, $limit = null, $offset = 0)
    {
        $query = $this->db->table($this->messagesTable . ' m')
            ->left_join('users u', 'm.sender_user_id = u.id')
            ->select('m.*, u.role as sender_role, u.first_name as sender_first_name, u.last_name as sender_last_name, u.email as sender_email')
            ->where('m.ticket_id', $ticket_id)
            ->order_by('m.created_at', 'DESC'); // DESC to get most recent first
        
        // Apply pagination if limit is provided
        if ($limit !== null && $limit > 0) {
            $query = $query->limit($offset, $limit);
        }
        
        $messages = $query->get_all();

        return is_array($messages) ? array_reverse($messages) : []; // Reverse to maintain chronological order in display
    }

    public function update_ticket_status($ticket_id, $status)
    {
        return $this->db->table($this->ticketsTable)
            ->where('id', $ticket_id)
            ->update([
                'status' => $status,
                'updated_at' => app_now(),
            ]);
    }

    public function update_ticket_meta($ticket_id, $data)
    {
        $data['updated_at'] = app_now();
        return $this->db->table($this->ticketsTable)
            ->where('id', $ticket_id)
            ->update($data);
    }

    public function get_sentiment_summary($ticket_id)
    {
        $messages = $this->get_messages_by_ticket($ticket_id);

        $counts = [
            'positive' => 0,
            'neutral' => 0,
            'negative' => 0,
        ];

        $confidenceTotals = [
            'positive' => 0.0,
            'neutral' => 0.0,
            'negative' => 0.0,
        ];

        foreach ($messages as $message) {
            $sentiment = isset($message['sentiment']) ? strtolower((string)$message['sentiment']) : '';
            if (!isset($counts[$sentiment])) {
                continue;
            }

            $counts[$sentiment] += 1;
            $confidenceTotals[$sentiment] += (float)($message['confidence'] ?? 0);
        }

        $dominant = null;
        $maxCount = 0;
        foreach ($counts as $label => $count) {
            if ($count > $maxCount) {
                $maxCount = $count;
                $dominant = $label;
            }
        }

        if ($maxCount === 0 || !$dominant) {
            return [
                'overall_sentiment' => null,
                'overall_confidence' => null,
                'sentiment_updated_at' => null,
            ];
        }

        $confidence = $confidenceTotals[$dominant] / $maxCount;

        return [
            'overall_sentiment' => $dominant,
            'overall_confidence' => round($confidence, 5),
            'sentiment_updated_at' => app_now(),
        ];
    }
}
