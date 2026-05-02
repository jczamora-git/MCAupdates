<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * TuitionPackagesController - Manage tuition fee packages
 */
class TuitionPackagesController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('TuitionPackagesModel');
        $this->call->model('SchoolFeesModel');
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

    private function get_package_total($package_id)
    {
        $stmt = $this->db->raw(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM tuition_package_items WHERE package_id = ?",
            [$package_id]
        );
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? floatval($row['total']) : 0;
    }

    private function get_latest_active_package_for_level($year_level)
    {
        $stmt = $this->db->raw(
            "SELECT tp.id
             FROM tuition_packages tp
             INNER JOIN tuition_package_levels tpl ON tpl.package_id = tp.id
             WHERE tp.is_active = 1 AND tpl.year_level = ?
             ORDER BY tp.effective_from DESC, tp.id DESC
             LIMIT 1",
            [$year_level]
        );
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function sync_school_fee_summary_for_level($year_level)
    {
        $active_package = $this->get_latest_active_package_for_level($year_level);

        $existing_fee_stmt = $this->db->raw(
            "SELECT id FROM school_fees WHERE year_level = ? AND fee_type = ? LIMIT 1",
            [$year_level, 'Tuition']
        );
        $existing_fee = $existing_fee_stmt->fetch(PDO::FETCH_ASSOC);

        if ($active_package && isset($active_package['id'])) {
            // Fetch the package name so fee_name matches the tuition_packages.name
            $pkg_stmt = $this->db->raw(
                "SELECT name FROM tuition_packages WHERE id = ? LIMIT 1",
                [$active_package['id']]
            );
            $pkg_row = $pkg_stmt->fetch(PDO::FETCH_ASSOC);
            $fee_name = ($pkg_row && !empty($pkg_row['name'])) ? $pkg_row['name'] : 'Tuition Package Total';

            $total = $this->get_package_total($active_package['id']);
            $payload = [
                'year_level' => $year_level,
                'fee_type' => 'Tuition',
                'fee_name' => $fee_name,
                'amount' => $total,
                'is_required' => 1,
                'is_active' => 1,
                'due_date' => null,
                'description' => 'Tuition package total from tuition_packages'
            ];

            if ($existing_fee && isset($existing_fee['id'])) {
                $this->SchoolFeesModel->update($existing_fee['id'], $payload);
            } else {
                $this->SchoolFeesModel->create($payload);
            }
            return;
        }

        if ($existing_fee && isset($existing_fee['id'])) {
            $this->SchoolFeesModel->update($existing_fee['id'], [
                'is_active' => 0
            ]);
        }
    }

    /**
     * Get all tuition packages with levels and items
     * GET /api/tuition-packages
     */
    public function api_get_packages()
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $sql = "SELECT tp.*, GROUP_CONCAT(tpl.year_level ORDER BY tpl.year_level SEPARATOR '||') AS levels
                    FROM tuition_packages tp
                    LEFT JOIN tuition_package_levels tpl ON tpl.package_id = tp.id
                    GROUP BY tp.id
                    ORDER BY tp.effective_from DESC, tp.id DESC";

            $stmt = $this->db->raw($sql);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $packages = [];
            foreach ($rows as $row) {
                $levels = [];
                if (!empty($row['levels'])) {
                    $levels = explode('||', $row['levels']);
                }

                $items_stmt = $this->db->raw(
                    "SELECT id, item_name, amount, is_required, sort_order
                     FROM tuition_package_items
                     WHERE package_id = ?
                     ORDER BY sort_order, id",
                    [$row['id']]
                );
                $items = $items_stmt->fetchAll(PDO::FETCH_ASSOC);

                $total = 0;
                foreach ($items as $item) {
                    $total += floatval($item['amount']);
                }

                $packages[] = [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'effective_from' => $row['effective_from'],
                    'effective_to' => $row['effective_to'],
                    'is_active' => (int)$row['is_active'] === 1,
                    'levels' => $levels,
                    'items' => $items,
                    'total' => $total
                ];
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => $packages,
                'count' => count($packages)
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
     * Get active package for a year level
     * GET /api/tuition-packages/active?year_level=Grade%201
     */
    public function api_get_active()
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        $year_level = isset($_GET['year_level']) ? trim($_GET['year_level']) : '';
        if ($year_level === '') {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'year_level is required'
            ]);
            return;
        }

        try {
            $today = app_today();
            $sql = "SELECT tp.*
                    FROM tuition_packages tp
                    INNER JOIN tuition_package_levels tpl ON tpl.package_id = tp.id
                    WHERE tpl.year_level = ?
                      AND tp.is_active = 1
                      AND tp.effective_from <= ?
                      AND (tp.effective_to IS NULL OR tp.effective_to >= ?)
                    ORDER BY tp.effective_from DESC, tp.id DESC
                    LIMIT 1";

            $stmt = $this->db->raw($sql, [$year_level, $today, $today]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                http_response_code(200);
                echo json_encode([
                    'success' => true,
                    'data' => null
                ]);
                return;
            }

            $levels_stmt = $this->db->raw(
                "SELECT year_level FROM tuition_package_levels WHERE package_id = ?",
                [$row['id']]
            );
            $levels = array_map(function ($lvl) {
                return $lvl['year_level'];
            }, $levels_stmt->fetchAll(PDO::FETCH_ASSOC));

            $items_stmt = $this->db->raw(
                "SELECT id, item_name, amount, is_required, sort_order
                 FROM tuition_package_items
                 WHERE package_id = ?
                 ORDER BY sort_order, id",
                [$row['id']]
            );
            $items = $items_stmt->fetchAll(PDO::FETCH_ASSOC);

            $total = 0;
            foreach ($items as $item) {
                $total += floatval($item['amount']);
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'data' => [
                    'id' => $row['id'],
                    'name' => $row['name'],
                    'effective_from' => $row['effective_from'],
                    'effective_to' => $row['effective_to'],
                    'is_active' => (int)$row['is_active'] === 1,
                    'levels' => $levels,
                    'items' => $items,
                    'total' => $total
                ]
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
     * Create a new tuition package version and update school_fees summary
     * POST /api/tuition-packages
     */
    public function api_create_package()
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $year_levels = isset($input['year_levels']) ? $input['year_levels'] : [];
            $items = isset($input['items']) ? $input['items'] : [];

            if (!is_array($year_levels) || count($year_levels) === 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'year_levels is required'
                ]);
                return;
            }

            if (!is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'items is required'
                ]);
                return;
            }

            $today = app_today();
            $package_name = isset($input['name']) && trim($input['name']) !== ''
                ? trim($input['name'])
                : 'Tuition Package - ' . implode(', ', $year_levels);

            $effective_from = isset($input['effective_from']) && trim($input['effective_from']) !== ''
                ? trim($input['effective_from'])
                : $today;

            // Deactivate existing active packages for any of the selected levels
            $placeholders = implode(',', array_fill(0, count($year_levels), '?'));
            $existing_stmt = $this->db->raw(
                "SELECT DISTINCT tp.id
                 FROM tuition_packages tp
                 INNER JOIN tuition_package_levels tpl ON tpl.package_id = tp.id
                 WHERE tp.is_active = 1
                   AND tpl.year_level IN ($placeholders)",
                $year_levels
            );
            $existing_ids = array_map(function ($row) {
                return $row['id'];
            }, $existing_stmt->fetchAll(PDO::FETCH_ASSOC));

            if (!empty($existing_ids)) {
                $id_placeholders = implode(',', array_fill(0, count($existing_ids), '?'));
                $params = array_merge([$today], $existing_ids);
                $this->db->raw(
                    "UPDATE tuition_packages SET is_active = 0, effective_to = ? WHERE id IN ($id_placeholders)",
                    $params
                );
            }

            $package_id = $this->TuitionPackagesModel->create([
                'name' => $package_name,
                'effective_from' => $effective_from,
                'effective_to' => null,
                'is_active' => 1
            ]);

            if (!$package_id) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to create tuition package'
                ]);
                return;
            }

            foreach ($year_levels as $level) {
                $this->db->table('tuition_package_levels')->insert([
                    'package_id' => $package_id,
                    'year_level' => $level
                ]);
            }

            $insert_items = [];
            $total = 0;
            foreach ($items as $index => $item) {
                $item_name = isset($item['item_name']) ? trim($item['item_name']) : '';
                $amount = isset($item['amount']) ? floatval($item['amount']) : null;
                if ($item_name === '' || $amount === null) {
                    continue;
                }

                $total += $amount;
                $insert_items[] = [
                    'package_id' => $package_id,
                    'item_name' => $item_name,
                    'amount' => $amount,
                    'is_required' => isset($item['is_required']) ? (int)$item['is_required'] : 1,
                    'sort_order' => isset($item['sort_order']) ? (int)$item['sort_order'] : ($index + 1)
                ];
            }

            if (empty($insert_items)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No valid items provided'
                ]);
                return;
            }

            foreach ($insert_items as $row) {
                $this->db->table('tuition_package_items')->insert($row);
            }

            // Upsert summary row into school_fees (fee_type = Tuition)
            foreach ($year_levels as $level) {
                $this->sync_school_fee_summary_for_level($level);
            }

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Tuition package created successfully',
                'data' => [
                    'id' => $package_id,
                    'name' => $package_name,
                    'effective_from' => $effective_from,
                    'effective_to' => null,
                    'is_active' => true,
                    'levels' => $year_levels,
                    'items' => $insert_items,
                    'total' => $total
                ]
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
     * Update existing tuition package and sync school_fees summary
     * PUT /api/tuition-packages/{id}
     */
    public function api_update_package($id)
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $package_stmt = $this->db->raw("SELECT * FROM tuition_packages WHERE id = ? LIMIT 1", [$id]);
            $existing_package = $package_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing_package) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Tuition package not found'
                ]);
                return;
            }

            $old_levels_stmt = $this->db->raw("SELECT year_level FROM tuition_package_levels WHERE package_id = ?", [$id]);
            $old_levels_rows = $old_levels_stmt->fetchAll(PDO::FETCH_ASSOC);
            $old_levels = array_map(function ($row) {
                return $row['year_level'];
            }, $old_levels_rows);

            $input = json_decode(file_get_contents('php://input'), true);
            $year_levels = isset($input['year_levels']) ? $input['year_levels'] : [];
            $items = isset($input['items']) ? $input['items'] : [];

            if (!is_array($year_levels) || count($year_levels) === 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'year_levels is required'
                ]);
                return;
            }

            if (!is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'items is required'
                ]);
                return;
            }

            $package_name = isset($input['name']) && trim($input['name']) !== ''
                ? trim($input['name'])
                : 'Tuition Package - ' . implode(', ', $year_levels);

            $effective_from = isset($input['effective_from']) && trim($input['effective_from']) !== ''
                ? trim($input['effective_from'])
                : $existing_package['effective_from'];

            $this->TuitionPackagesModel->update($id, [
                'name' => $package_name,
                'effective_from' => $effective_from,
                'is_active' => 1
            ]);

            $this->db->raw("DELETE FROM tuition_package_levels WHERE package_id = ?", [$id]);
            foreach ($year_levels as $level) {
                $this->db->table('tuition_package_levels')->insert([
                    'package_id' => $id,
                    'year_level' => $level
                ]);
            }

            $this->db->raw("DELETE FROM tuition_package_items WHERE package_id = ?", [$id]);

            $insert_items = [];
            foreach ($items as $index => $item) {
                $item_name = isset($item['item_name']) ? trim($item['item_name']) : '';
                $amount = isset($item['amount']) ? floatval($item['amount']) : null;
                if ($item_name === '' || $amount === null) {
                    continue;
                }

                $insert_items[] = [
                    'package_id' => $id,
                    'item_name' => $item_name,
                    'amount' => $amount,
                    'is_required' => isset($item['is_required']) ? (int)$item['is_required'] : 1,
                    'sort_order' => isset($item['sort_order']) ? (int)$item['sort_order'] : ($index + 1)
                ];
            }

            if (empty($insert_items)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No valid items provided'
                ]);
                return;
            }

            foreach ($insert_items as $row) {
                $this->db->table('tuition_package_items')->insert($row);
            }

            $levels_to_sync = array_unique(array_merge($old_levels, $year_levels));
            foreach ($levels_to_sync as $level) {
                $this->sync_school_fee_summary_for_level($level);
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Tuition package updated successfully'
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
     * Delete tuition package and sync school_fees summary
     * DELETE /api/tuition-packages/{id}
     */
    public function api_delete_package($id)
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $package_stmt = $this->db->raw("SELECT * FROM tuition_packages WHERE id = ? LIMIT 1", [$id]);
            $existing_package = $package_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing_package) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Tuition package not found'
                ]);
                return;
            }

            $levels_stmt = $this->db->raw("SELECT year_level FROM tuition_package_levels WHERE package_id = ?", [$id]);
            $level_rows = $levels_stmt->fetchAll(PDO::FETCH_ASSOC);
            $levels = array_map(function ($row) {
                return $row['year_level'];
            }, $level_rows);

            $this->db->table('tuition_packages')->where('id', $id)->delete();

            foreach ($levels as $level) {
                $this->sync_school_fee_summary_for_level($level);
            }

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'Tuition package deleted successfully'
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Server error: ' . $e->getMessage()
            ]);
        }
    }
}
