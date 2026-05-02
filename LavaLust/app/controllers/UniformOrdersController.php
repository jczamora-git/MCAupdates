<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class UniformOrdersController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        $this->call->model('PaymentModel');
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

    private function get_active_academic_period_id()
    {
        $stmt = $this->db->raw(
            "SELECT id FROM academic_periods WHERE status = 'active' ORDER BY id DESC LIMIT 1"
        );

        $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
        return !empty($row['id']) ? intval($row['id']) : null;
    }

    private function get_uniform_price($uniformItemId, $size)
    {
        $stmt = $this->db->raw(
            "SELECT id, price, half_price, is_active
             FROM uniform_prices
                         WHERE uniform_item_id = ?
                             AND TRIM(size) = TRIM(?)
                             AND is_active = 1
                         ORDER BY id DESC
                         LIMIT 1",
            [$uniformItemId, $size]
        );

        return $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
    }

    private function get_uniform_item($uniformItemId)
    {
        $stmt = $this->db->raw(
            "SELECT id, item_name, item_group, is_pair, allow_half_price, is_active
             FROM uniform_items
             WHERE id = ?
             LIMIT 1",
            [$uniformItemId]
        );

        return $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
    }

    private function get_order($orderId)
    {
        $stmt = $this->db->raw(
            "SELECT
                suo.*,
                u.first_name,
                u.last_name,
                s.student_id AS student_number,
                ui.item_name,
                ui.item_group,
                p.receipt_number,
                p.status AS payment_status,
                p.payment_method,
                p.payment_date
             FROM student_uniform_orders suo
             INNER JOIN users u ON u.id = suo.student_id
             LEFT JOIN students s ON s.user_id = u.id
             INNER JOIN uniform_items ui ON ui.id = suo.uniform_item_id
             LEFT JOIN payments p ON p.id = suo.payment_id
             WHERE suo.id = ?
             LIMIT 1",
            [$orderId]
        );

        return $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
    }

    public function api_get_orders()
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $stmt = $this->db->raw(
                "SELECT
                    suo.*,
                    u.first_name,
                    u.last_name,
                    s.student_id AS student_number,
                    ui.item_name,
                    ui.item_group,
                    p.receipt_number,
                    p.status AS payment_status,
                    p.payment_method,
                    p.payment_date
                 FROM student_uniform_orders suo
                 INNER JOIN users u ON u.id = suo.student_id
                 LEFT JOIN students s ON s.user_id = u.id
                 INNER JOIN uniform_items ui ON ui.id = suo.uniform_item_id
                 LEFT JOIN payments p ON p.id = suo.payment_id
                 ORDER BY suo.created_at DESC, suo.id DESC"
            );

            $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];

            echo json_encode([
                'success' => true,
                'data' => $rows,
                'count' => count($rows)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to fetch uniform orders: ' . $e->getMessage()
            ]);
        }
    }

    public function api_create_order()
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);

            $studentId = intval($input['student_id'] ?? 0);
            $enrollmentId = !empty($input['enrollment_id']) ? intval($input['enrollment_id']) : null;
            $uniformItemId = intval($input['uniform_item_id'] ?? 0);
            $size = trim($input['size'] ?? '');
            $quantity = intval($input['quantity'] ?? 1);
            $isHalfPiece = !empty($input['is_half_piece']) ? 1 : 0;
            $pieceType = !empty($input['piece_type']) ? trim($input['piece_type']) : null;
            $paymentMethod = trim($input['payment_method'] ?? 'Cash');
            $paymentDate = !empty($input['payment_date']) ? $input['payment_date'] : app_today();
            $referenceNumber = trim($input['reference_number'] ?? '');

            if ($studentId <= 0 || $uniformItemId <= 0 || $size === '' || $quantity <= 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'student_id, uniform_item_id, size, and quantity are required'
                ]);
                return;
            }

            $item = $this->get_uniform_item($uniformItemId);
            if (!$item || intval($item['is_active']) !== 1) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid or inactive uniform item'
                ]);
                return;
            }

            $priceRow = $this->get_uniform_price($uniformItemId, $size);
            if (!$priceRow || intval($priceRow['is_active']) !== 1) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid or inactive size pricing for this uniform item'
                ]);
                return;
            }

            if ($isHalfPiece === 1) {
                if (intval($item['allow_half_price']) !== 1) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'This uniform item does not allow half-piece pricing'
                    ]);
                    return;
                }

                if (empty($priceRow['half_price'])) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'Half-piece price is not configured for selected size'
                    ]);
                    return;
                }

                if (!in_array($pieceType, ['Shirt', 'Pants'], true)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => 'piece_type must be Shirt or Pants when half-piece is selected'
                    ]);
                    return;
                }
            } else {
                $pieceType = null;
            }

            $unitPrice = $isHalfPiece === 1
                ? floatval($priceRow['half_price'])
                : floatval($priceRow['price']);
            $totalAmount = $unitPrice * $quantity;

            $academicPeriodId = $this->get_active_academic_period_id();
            if (empty($academicPeriodId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No active academic period found. Please set an active academic period first.'
                ]);
                return;
            }

            $usedTx = null;
            if (method_exists($this->db, 'transaction')) {
                $this->db->transaction();
                $usedTx = 'transaction';
            } elseif (method_exists($this->db, 'beginTransaction')) {
                $this->db->beginTransaction();
                $usedTx = 'beginTransaction';
            }

            $isPEUniform = strtolower(trim($item['item_group'] ?? '')) === 'pe';
            $peSuffix = '';
            if ($isPEUniform) {
                if ($isHalfPiece === 1 && !empty($pieceType)) {
                    $peSuffix = ' (' . $pieceType . ')';
                } else {
                    $peSuffix = ' (Pair)';
                }
            }

            $paymentFor = trim($item['item_name'] . $peSuffix . ' (' . $size . ') x' . $quantity);

            $paymentData = [
                'student_id' => $studentId,
                'enrollment_id' => $enrollmentId,
                'academic_period_id' => $academicPeriodId,
                'payment_type' => 'Uniform',
                'payment_for' => $paymentFor,
                'amount' => $totalAmount,
                'total_discount' => 0,
                'payment_method' => $paymentMethod,
                'payment_date' => $paymentDate,
                'reference_number' => $referenceNumber !== '' ? $referenceNumber : null,
                'status' => $paymentMethod === 'Cash' ? 'Approved' : 'Pending',
                'remarks' => 'Uniform order',
                'received_by' => $this->session->userdata('id') ?: null
            ];

            $paymentId = $this->PaymentModel->create($paymentData);
            if (!$paymentId) {
                throw new Exception('Failed to create payment record for uniform order');
            }

            $orderData = [
                'student_id' => $studentId,
                'enrollment_id' => $enrollmentId,
                'uniform_item_id' => $uniformItemId,
                'size' => $size,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'is_half_piece' => $isHalfPiece,
                'piece_type' => $pieceType,
                'total_amount' => $totalAmount,
                'payment_id' => $paymentId
            ];

            $orderId = $this->db->table('student_uniform_orders')->insert($orderData);
            if (!$orderId) {
                throw new Exception('Failed to create uniform order');
            }

            if (($usedTx === 'transaction' || $usedTx === 'beginTransaction') && method_exists($this->db, 'commit')) {
                $this->db->commit();
            }

            $createdOrder = $this->get_order($orderId);

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Uniform order created successfully',
                'data' => $createdOrder
            ]);
        } catch (Exception $e) {
            if (method_exists($this->db, 'roll_back')) {
                $this->db->roll_back();
            } elseif (method_exists($this->db, 'rollback')) {
                $this->db->rollback();
            } elseif (method_exists($this->db, 'rollBack')) {
                $this->db->rollBack();
            }

            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to create uniform order: ' . $e->getMessage()
            ]);
        }
    }

    public function api_create_order_batch()
    {
        api_set_json_headers();

        if (!$this->require_admin()) {
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);

            $studentId = intval($input['student_id'] ?? 0);
            $enrollmentId = !empty($input['enrollment_id']) ? intval($input['enrollment_id']) : null;
            $paymentMethod = trim($input['payment_method'] ?? 'Cash');
            $paymentDate = !empty($input['payment_date']) ? $input['payment_date'] : app_today();
            $referenceNumber = trim($input['reference_number'] ?? '');
            $items = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];

            if ($studentId <= 0 || empty($items)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'student_id and at least one item are required'
                ]);
                return;
            }

            $academicPeriodId = $this->get_active_academic_period_id();
            if (empty($academicPeriodId)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'No active academic period found. Please set an active academic period first.'
                ]);
                return;
            }

            $orderRows = [];
            $paymentForParts = [];
            $grandTotal = 0;

            foreach ($items as $index => $row) {
                $uniformItemId = intval($row['uniform_item_id'] ?? 0);
                $size = trim($row['size'] ?? '');
                $quantity = intval($row['quantity'] ?? 1);
                $isHalfPiece = !empty($row['is_half_piece']) ? 1 : 0;
                $pieceType = !empty($row['piece_type']) ? trim($row['piece_type']) : null;

                if ($uniformItemId <= 0 || $size === '' || $quantity <= 0) {
                    throw new InvalidArgumentException('Item #' . ($index + 1) . ' has invalid uniform_item_id, size, or quantity');
                }

                $item = $this->get_uniform_item($uniformItemId);
                if (!$item || intval($item['is_active']) !== 1) {
                    throw new InvalidArgumentException('Item #' . ($index + 1) . ' is invalid or inactive');
                }

                $priceRow = $this->get_uniform_price($uniformItemId, $size);
                if (!$priceRow || intval($priceRow['is_active']) !== 1) {
                    throw new InvalidArgumentException('Item #' . ($index + 1) . ' has invalid or inactive size pricing');
                }

                if ($isHalfPiece === 1) {
                    if (intval($item['allow_half_price']) !== 1) {
                        throw new InvalidArgumentException('Item #' . ($index + 1) . ' does not allow half-piece pricing');
                    }

                    if (empty($priceRow['half_price'])) {
                        throw new InvalidArgumentException('Item #' . ($index + 1) . ' has no half-piece price configured for selected size');
                    }

                    if (!in_array($pieceType, ['Shirt', 'Pants'], true)) {
                        throw new InvalidArgumentException('Item #' . ($index + 1) . ' piece_type must be Shirt or Pants');
                    }
                } else {
                    $pieceType = null;
                }

                $unitPrice = $isHalfPiece === 1
                    ? floatval($priceRow['half_price'])
                    : floatval($priceRow['price']);
                $lineTotal = $unitPrice * $quantity;

                $isPEUniform = strtolower(trim($item['item_group'] ?? '')) === 'pe';
                $peSuffix = '';
                if ($isPEUniform) {
                    if ($isHalfPiece === 1 && !empty($pieceType)) {
                        $peSuffix = ' (' . $pieceType . ')';
                    } else {
                        $peSuffix = ' (Pair)';
                    }
                }

                $paymentForParts[] = trim($item['item_name'] . $peSuffix . ' (' . $size . ') x' . $quantity);

                $orderRows[] = [
                    'student_id' => $studentId,
                    'enrollment_id' => $enrollmentId,
                    'uniform_item_id' => $uniformItemId,
                    'size' => $size,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'is_half_piece' => $isHalfPiece,
                    'piece_type' => $pieceType,
                    'total_amount' => $lineTotal,
                ];

                $grandTotal += $lineTotal;
            }

            $usedTx = null;
            if (method_exists($this->db, 'transaction')) {
                $this->db->transaction();
                $usedTx = 'transaction';
            } elseif (method_exists($this->db, 'beginTransaction')) {
                $this->db->beginTransaction();
                $usedTx = 'beginTransaction';
            }

            $paymentFor = count($paymentForParts) === 1
                ? $paymentForParts[0]
                : 'Uniform order (' . count($paymentForParts) . ' items)';

            $paymentData = [
                'student_id' => $studentId,
                'enrollment_id' => $enrollmentId,
                'academic_period_id' => $academicPeriodId,
                'payment_type' => 'Uniform',
                'payment_for' => $paymentFor,
                'amount' => $grandTotal,
                'total_discount' => 0,
                'payment_method' => $paymentMethod,
                'payment_date' => $paymentDate,
                'reference_number' => $referenceNumber !== '' ? $referenceNumber : null,
                'status' => $paymentMethod === 'Cash' ? 'Approved' : 'Pending',
                'remarks' => 'Uniform order (' . count($paymentForParts) . ' items)',
                'received_by' => $this->session->userdata('id') ?: null
            ];

            $paymentId = $this->PaymentModel->create($paymentData);
            if (!$paymentId) {
                throw new Exception('Failed to create payment record for uniform order transaction');
            }

            $createdOrderIds = [];
            foreach ($orderRows as $orderRow) {
                $orderRow['payment_id'] = $paymentId;
                $orderId = $this->db->table('student_uniform_orders')->insert($orderRow);
                if (!$orderId) {
                    throw new Exception('Failed to create uniform order item');
                }
                $createdOrderIds[] = intval($orderId);
            }

            if (($usedTx === 'transaction' || $usedTx === 'beginTransaction') && method_exists($this->db, 'commit')) {
                $this->db->commit();
            }

            $createdOrders = [];
            foreach ($createdOrderIds as $createdOrderId) {
                $order = $this->get_order($createdOrderId);
                if ($order) {
                    $createdOrders[] = $order;
                }
            }

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => 'Uniform order transaction created successfully',
                'data' => [
                    'payment_id' => $paymentId,
                    'total_amount' => $grandTotal,
                    'items_count' => count($createdOrders),
                    'orders' => $createdOrders
                ]
            ]);
        } catch (InvalidArgumentException $e) {
            if (method_exists($this->db, 'roll_back')) {
                $this->db->roll_back();
            } elseif (method_exists($this->db, 'rollback')) {
                $this->db->rollback();
            } elseif (method_exists($this->db, 'rollBack')) {
                $this->db->rollBack();
            }

            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        } catch (Exception $e) {
            if (method_exists($this->db, 'roll_back')) {
                $this->db->roll_back();
            } elseif (method_exists($this->db, 'rollback')) {
                $this->db->rollback();
            } elseif (method_exists($this->db, 'rollBack')) {
                $this->db->rollBack();
            }

            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to create uniform order transaction: ' . $e->getMessage()
            ]);
        }
    }
}
