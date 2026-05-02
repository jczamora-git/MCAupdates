<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * UniformItemsController - Manage uniform items and their size-based prices
 */
class UniformItemsController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('UniformItemsModel');
    }

    private function require_admin()
    {
        if (!$this->session->userdata('logged_in') || $this->session->userdata('role') !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'message' => 'Admin access required'
            ]);
            return false;
        }

        return true;
    }

    private function get_prices_for_item($item_id)
    {
        $stmt = $this->db->raw(
            "SELECT id, size, price, half_price, is_active
             FROM uniform_prices
             WHERE uniform_item_id = ?
             ORDER BY size",
            [$item_id]
        );
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function format_item($row)
    {
        $levels = [];
        if (!empty($row['applicable_levels'])) {
            $decoded = json_decode($row['applicable_levels'], true);
            if (is_array($decoded)) {
                $levels = $decoded;
            }
        }

        $prices = $this->get_prices_for_item($row['id']);

        return [
            'id'               => $row['id'],
            'item_name'        => $row['item_name'],
            'item_group'       => $row['item_group'],
            'applicable_levels'=> $levels,
            'applicable_gender'=> $row['applicable_gender'],
            'is_pair'          => (int)$row['is_pair'] === 1,
            'allow_half_price' => (int)$row['allow_half_price'] === 1,
            'is_active'        => (int)$row['is_active'] === 1,
            'prices'           => $prices,
        ];
    }

    /**
     * GET /api/uniform-items
     * Returns all uniform items with their prices
     */
    public function api_get_items()
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $stmt = $this->db->raw(
                "SELECT * FROM uniform_items ORDER BY item_group, item_name"
            );
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $items = array_map([$this, 'format_item'], $rows);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data'    => $items,
                'count'   => count($items)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * GET /api/uniform-items/{id}
     * Returns a single uniform item with prices
     */
    public function api_get_item($id)
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $stmt = $this->db->raw(
                "SELECT * FROM uniform_items WHERE id = ? LIMIT 1",
                [$id]
            );
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Uniform item not found'
                ]);
                return;
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data'    => $this->format_item($row)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * POST /api/uniform-items
     * Creates a new uniform item with optional prices
     */
    public function api_create_item()
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);

            $item_name = isset($input['item_name']) ? trim($input['item_name']) : '';
            $item_group = isset($input['item_group']) ? trim($input['item_group']) : '';

            if ($item_name === '') {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'item_name is required'
                ]);
                return;
            }

            $valid_groups = ['Dress', 'Blouse', 'Skirt', 'Polo', 'PE', 'Others'];
            if (!in_array($item_group, $valid_groups)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'item_group must be one of: ' . implode(', ', $valid_groups)
                ]);
                return;
            }

            $applicable_gender = isset($input['applicable_gender']) ? trim($input['applicable_gender']) : 'All';
            $valid_genders = ['Male', 'Female', 'All'];
            if (!in_array($applicable_gender, $valid_genders)) {
                $applicable_gender = 'All';
            }

            $applicable_levels = isset($input['applicable_levels']) && is_array($input['applicable_levels'])
                ? $input['applicable_levels']
                : [];

            $item_id = $this->UniformItemsModel->create([
                'item_name'         => $item_name,
                'item_group'        => $item_group,
                'applicable_levels' => json_encode($applicable_levels),
                'applicable_gender' => $applicable_gender,
                'is_pair'           => isset($input['is_pair']) ? (int)(bool)$input['is_pair'] : 0,
                'allow_half_price'  => isset($input['allow_half_price']) ? (int)(bool)$input['allow_half_price'] : 0,
                'is_active'         => 1,
            ]);

            if (!$item_id) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create uniform item'
                ]);
                return;
            }

            // Insert prices
            $prices = isset($input['prices']) && is_array($input['prices']) ? $input['prices'] : [];
            $this->insert_prices($item_id, $prices);

            $stmt = $this->db->raw("SELECT * FROM uniform_items WHERE id = ? LIMIT 1", [$item_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Uniform item created successfully',
                'data'    => $this->format_item($row)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * PUT /api/uniform-items/{id}
     * Updates an existing uniform item and replaces its prices
     */
    public function api_update_item($id)
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $existing_stmt = $this->db->raw("SELECT * FROM uniform_items WHERE id = ? LIMIT 1", [$id]);
            $existing = $existing_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Uniform item not found'
                ]);
                return;
            }

            $input = json_decode(file_get_contents('php://input'), true);

            $item_name = isset($input['item_name']) ? trim($input['item_name']) : $existing['item_name'];
            if ($item_name === '') {
                $item_name = $existing['item_name'];
            }

            $item_group = isset($input['item_group']) ? trim($input['item_group']) : $existing['item_group'];
            $valid_groups = ['Dress', 'Blouse', 'Skirt', 'Polo', 'PE', 'Others'];
            if (!in_array($item_group, $valid_groups)) {
                $item_group = $existing['item_group'];
            }

            $applicable_gender = isset($input['applicable_gender']) ? trim($input['applicable_gender']) : $existing['applicable_gender'];
            $valid_genders = ['Male', 'Female', 'All'];
            if (!in_array($applicable_gender, $valid_genders)) {
                $applicable_gender = $existing['applicable_gender'];
            }

            $applicable_levels = isset($input['applicable_levels']) && is_array($input['applicable_levels'])
                ? json_encode($input['applicable_levels'])
                : $existing['applicable_levels'];

            $update_payload = [
                'item_name'         => $item_name,
                'item_group'        => $item_group,
                'applicable_levels' => $applicable_levels,
                'applicable_gender' => $applicable_gender,
                'is_pair'           => isset($input['is_pair']) ? (int)(bool)$input['is_pair'] : (int)$existing['is_pair'],
                'allow_half_price'  => isset($input['allow_half_price']) ? (int)(bool)$input['allow_half_price'] : (int)$existing['allow_half_price'],
                'is_active'         => isset($input['is_active']) ? (int)(bool)$input['is_active'] : (int)$existing['is_active'],
            ];

            $this->UniformItemsModel->update($id, $update_payload);

            // Replace prices
            if (isset($input['prices']) && is_array($input['prices'])) {
                $this->db->raw("DELETE FROM uniform_prices WHERE uniform_item_id = ?", [$id]);
                $this->insert_prices($id, $input['prices']);
            }

            $stmt = $this->db->raw("SELECT * FROM uniform_items WHERE id = ? LIMIT 1", [$id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Uniform item updated successfully',
                'data'    => $this->format_item($row)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * DELETE /api/uniform-items/{id}
     */
    public function api_delete_item($id)
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $stmt = $this->db->raw("SELECT * FROM uniform_items WHERE id = ? LIMIT 1", [$id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Uniform item not found'
                ]);
                return;
            }

            // Delete prices first (no FK cascade defined, do it manually)
            $this->db->raw("DELETE FROM uniform_prices WHERE uniform_item_id = ?", [$id]);
            $this->db->table('uniform_items')->where('id', $id)->delete();

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Uniform item deleted successfully'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * PUT /api/uniform-items/{id}/toggle
     * Toggle is_active status
     */
    public function api_toggle_item($id)
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $stmt = $this->db->raw("SELECT * FROM uniform_items WHERE id = ? LIMIT 1", [$id]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Uniform item not found'
                ]);
                return;
            }

            $new_status = (int)$existing['is_active'] === 1 ? 0 : 1;
            $this->UniformItemsModel->update($id, ['is_active' => $new_status]);

            http_response_code(200);
            echo json_encode([
                'success'   => true,
                'message'   => 'Uniform item status updated',
                'is_active' => $new_status === 1
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function insert_prices($item_id, array $prices)
    {
        // Get item group to determine if size is required
        $itemStmt = $this->db->raw("SELECT item_group FROM uniform_items WHERE id = ? LIMIT 1", [$item_id]);
        $item = $itemStmt->fetch(PDO::FETCH_ASSOC);
        $isOthersCategory = $item && $item['item_group'] === 'Others';

        foreach ($prices as $price_row) {
            $size = isset($price_row['size']) ? trim($price_row['size']) : '';
            $price = isset($price_row['price']) ? floatval($price_row['price']) : null;

            // For "Others" category, size can be empty/null; for other categories, size is required
            if (!$isOthersCategory && $size === '') {
                continue;
            }

            if ($price === null || $price < 0) {
                continue;
            }

            $half_price = null;
            if (isset($price_row['half_price']) && $price_row['half_price'] !== '' && $price_row['half_price'] !== null) {
                $hp = floatval($price_row['half_price']);
                if ($hp >= 0) {
                    $half_price = $hp;
                }
            }

            $this->db->table('uniform_prices')->insert([
                'uniform_item_id' => $item_id,
                'size'            => $size !== '' ? $size : null,
                'price'           => $price,
                'half_price'      => $half_price,
                'is_active'       => 1,
            ]);
        }
    }
}
