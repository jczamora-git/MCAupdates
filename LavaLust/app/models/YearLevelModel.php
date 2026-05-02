<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Year Level Model
 * Handles year_levels table operations
 */
class YearLevelModel extends Model
{
    protected $table = 'year_levels';

    /**
     * Get all year levels ordered by order field
     */
    public function get_all()
    {
        return $this->db->table($this->table)
                        ->select('id, name, `order`')
                        ->order_by('`order`', 'ASC')
                        ->get_all();
    }

    /**
     * Get a single year level by id
     */
    public function find_by_id($id)
    {
        return $this->db->table($this->table)
                        ->select('id, name, `order`')
                        ->where('id', $id)
                        ->get();
    }

    /**
     * Get a year level by name
     */
    public function find_by_name($name)
    {
        return $this->db->table($this->table)
                        ->select('id, name, `order`')
                        ->where('name', $name)
                        ->get();
    }

    /**
     * Insert a new year level
     */
    public function insert($data)
    {
        try {
            // Validate input
            if (!isset($data['name']) || empty(trim($data['name']))) {
                error_log("Insert error: Year level name is required");
                return false;
            }

            $name = trim($data['name']);
            $hasOrder = array_key_exists('order', $data) && $data['order'] !== null && $data['order'] !== '';

            // Use raw() to safely handle reserved keyword `order` when provided.
            if ($hasOrder) {
                $sql = "INSERT INTO `year_levels` (`name`, `order`) VALUES (?, ?)";
                $this->db->raw($sql, [$name, (int)$data['order']]);
            } else {
                $sql = "INSERT INTO `year_levels` (`name`) VALUES (?)";
                $this->db->raw($sql, [$name]);
            }
            
            // Small delay to ensure database write completes
            usleep(100);

            // Retrieve newly created ID by unique-ish name fallback.
            $getIdSql = "SELECT `id` FROM `year_levels` WHERE `name` = ? ORDER BY `id` DESC LIMIT 1";
            $idStmt = $this->db->raw($getIdSql, [$name]);
            $idResult = $idStmt->fetch();

            error_log("Insert: Raw query result: " . json_encode($idResult));

            if ($idResult && isset($idResult['id'])) {
                error_log("Insert success (raw): Year level ID " . $idResult['id']);
                return (int)$idResult['id'];
            }
            
            error_log("Insert error: Could not retrieve inserted ID");
            return false;
        } catch (Exception $e) {
            error_log("Insert error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            return false;
        }
    }

    /**
     * Update a year level
     */
    public function update($id, $data)
    {
        try {
            $updates = [];
            $params = [];
            
            if (isset($data['name'])) {
                $updates[] = "`name` = ?";
                $params[] = $data['name'];
            }
            if (isset($data['order'])) {
                $updates[] = "`order` = ?";
                $params[] = $data['order'];
            }
            
            if (empty($updates)) {
                return false;
            }
            
            $params[] = $id;
            $sql = "UPDATE `year_levels` SET " . implode(", ", $updates) . " WHERE `id` = ?";
            
            $stmt = $this->db->raw($sql, $params);
            return true;
        } catch (Exception $e) {
            error_log("Update error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Delete a year level
     */
    public function delete($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->delete();
    }
}
