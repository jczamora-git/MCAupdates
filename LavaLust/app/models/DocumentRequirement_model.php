<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class DocumentRequirement_model extends Model {

    private $catalogTable = 'document_catalog';
    private $rulesTable = 'document_requirements';
    private function ensure_rules_table() {
        return;
    }

    private function sync_legacy_row($gradeLevel, $enrollmentType, $documentName, $isRequired, $displayOrder, $description, $isActive) {
        return;
    }

    private function delete_legacy_row($gradeLevel, $enrollmentType, $documentName) {
        return;
    }

    private function map_requirement_row($row) {
        return [
            'id' => (int) $row['id'],
            'grade_level' => $row['grade_level'],
            'enrollment_type' => $row['enrollment_type'],
            'document_name' => $row['document_name'],
            'is_required' => (int) $row['is_required'],
            'display_order' => (int) $row['display_order'],
            'description' => $row['description'],
            'is_active' => (int) $row['is_active'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at']
        ];
    }

    private function normalize_enrollment_type($enrollmentType) {
        if ($enrollmentType === '' || $enrollmentType === 'All Types') {
            return null;
        }

        return $enrollmentType;
    }

    private function resolve_document_id($documentName, $description = null) {
        $existing = $this->db->raw(
            "SELECT id FROM {$this->catalogTable} WHERE name = ? LIMIT 1",
            [$documentName]
        )->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $documentId = (int) $existing['id'];
            if ($description !== null) {
                $this->db->raw(
                    "UPDATE {$this->catalogTable} SET description = ?, updated_at = ? WHERE id = ?",
                    [$description, app_now(), $documentId]
                );
            }
            return $documentId;
        }

        $baseCode = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '_', $documentName), '_'));
        if ($baseCode === '') {
            $baseCode = 'document';
        }

        $candidateCode = $baseCode;
        $suffix = 1;
        while (true) {
            $codeExists = $this->db->raw(
                "SELECT id FROM {$this->catalogTable} WHERE code = ? LIMIT 1",
                [$candidateCode]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$codeExists) {
                break;
            }

            $suffix++;
            $candidateCode = $baseCode . '_' . $suffix;
        }

        $this->db->raw(
            "INSERT INTO {$this->catalogTable} (code, name, description, is_active, created_at, updated_at)
             VALUES (?, ?, ?, 1, ?, ?)",
            [$candidateCode, $documentName, $description, app_now(), app_now()]
        );

        $inserted = $this->db->raw(
            "SELECT id FROM {$this->catalogTable} WHERE code = ? LIMIT 1",
            [$candidateCode]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$inserted) {
            throw new Exception('Failed to resolve newly created catalog document ID');
        }

        return (int) $inserted['id'];
    }

    private function get_rule_by_unique_keys($documentId, $gradeLevel, $enrollmentType) {
        if ($enrollmentType === null) {
            $sql = "SELECT * FROM {$this->rulesTable}
                    WHERE document_id = ? AND grade_level = ? AND enrollment_type IS NULL
                    LIMIT 1";
            return $this->db->raw($sql, [$documentId, $gradeLevel])->fetch(PDO::FETCH_ASSOC);
        }

        $sql = "SELECT * FROM {$this->rulesTable}
                WHERE document_id = ? AND grade_level = ? AND enrollment_type = ?
                LIMIT 1";

        return $this->db->raw($sql, [$documentId, $gradeLevel, $enrollmentType])->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Get all document requirements
     */
    public function get_all_requirements() {
        $this->ensure_rules_table();

        $sql = "SELECT
                    r.id,
                    r.grade_level,
                    r.enrollment_type,
                    c.name AS document_name,
                    r.is_required,
                    r.display_order,
                    c.description,
                    r.is_active,
                    r.created_at,
                    r.updated_at
                FROM {$this->rulesTable} r
                INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
                ORDER BY r.grade_level ASC,
                         CASE WHEN r.enrollment_type IS NULL THEN 0 ELSE 1 END ASC,
                         r.enrollment_type ASC,
                         r.display_order ASC,
                         c.name ASC";

        $rows = $this->db->raw($sql)->fetchAll(PDO::FETCH_ASSOC);
        return array_map([$this, 'map_requirement_row'], $rows);
    }

    /**
     * Get all active document requirements (for display)
     */
    public function get_active_requirements() {
        $this->ensure_rules_table();

        $sql = "SELECT
                    r.id,
                    r.grade_level,
                    r.enrollment_type,
                    c.name AS document_name,
                    r.is_required,
                    r.display_order,
                    c.description,
                    r.is_active,
                    r.created_at,
                    r.updated_at
                FROM {$this->rulesTable} r
                INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
                WHERE r.is_active = 1 AND c.is_active = 1
                ORDER BY r.grade_level ASC,
                         CASE WHEN r.enrollment_type IS NULL THEN 0 ELSE 1 END ASC,
                         r.enrollment_type ASC,
                         r.display_order ASC,
                         c.name ASC";

        $rows = $this->db->raw($sql)->fetchAll(PDO::FETCH_ASSOC);
        return array_map([$this, 'map_requirement_row'], $rows);
    }

    /**
     * Get requirements by grade level and enrollment type
     */
    public function get_requirements_by_criteria($gradeLevel, $enrollmentType = null) {
        $this->ensure_rules_table();

        $normalizedEnrollmentType = $this->normalize_enrollment_type($enrollmentType);
        $normalizedEnrollmentTypeShort = $normalizedEnrollmentType !== null
            ? strtolower(trim(explode(' ', $normalizedEnrollmentType)[0]))
            : null;
        $normalizedGradeLevel = strtolower(trim((string) $gradeLevel));

        if ($normalizedEnrollmentType !== null) {
            $sql = "SELECT
                        r.id,
                        r.document_id,
                        r.grade_level,
                        r.enrollment_type,
                        c.name AS document_name,
                        r.is_required,
                        r.display_order,
                        c.description,
                        r.is_active,
                        r.created_at,
                        r.updated_at
                    FROM {$this->rulesTable} r
                    INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
                                        WHERE COALESCE(r.is_active, 1) = 1
                                            AND COALESCE(c.is_active, 1) = 1
                                            AND (
                                                        LOWER(TRIM(r.grade_level)) = LOWER(TRIM(?))
                                                        OR r.grade_level IS NULL
                                                        OR TRIM(r.grade_level) = ''
                                                        OR UPPER(TRIM(r.grade_level)) = 'ALL'
                                                    )
                                            AND (
                                                        r.enrollment_type IS NULL
                                                        OR TRIM(r.enrollment_type) = ''
                                                        OR UPPER(TRIM(r.enrollment_type)) = 'ALL TYPES'
                                                        OR LOWER(TRIM(r.enrollment_type)) = LOWER(TRIM(?))
                                                        OR LOWER(TRIM(r.enrollment_type)) = ?
                                                    )";

                        $rows = $this->db->raw($sql, [$gradeLevel, $normalizedEnrollmentType, $normalizedEnrollmentTypeShort])->fetchAll(PDO::FETCH_ASSOC);

            $bestByDocument = [];
            foreach ($rows as $row) {
                $docKey = (string) $row['document_id'];

                                $rowGrade = strtolower(trim((string) ($row['grade_level'] ?? '')));
                                $rowType = strtolower(trim((string) ($row['enrollment_type'] ?? '')));
                                $isGeneralType = ($rowType === '' || $rowType === 'all types');
                                $isSpecificType = ($rowType === strtolower(trim($normalizedEnrollmentType)) || $rowType === $normalizedEnrollmentTypeShort);

                                $gradeScore = ($rowGrade === $normalizedGradeLevel) ? 2 : 1;
                                $typeScore = $isSpecificType ? 2 : ($isGeneralType ? 1 : 0);
                $score = ($gradeScore * 10) + $typeScore;

                if (!isset($bestByDocument[$docKey])) {
                    $row['_score'] = $score;
                    $bestByDocument[$docKey] = $row;
                    continue;
                }

                $current = $bestByDocument[$docKey];
                if ($score > $current['_score']) {
                    $row['_score'] = $score;
                    $bestByDocument[$docKey] = $row;
                } elseif ($score === $current['_score']) {
                    if ((int) $row['display_order'] < (int) $current['display_order']) {
                        $row['_score'] = $score;
                        $bestByDocument[$docKey] = $row;
                    }
                }
            }

            $result = array_values($bestByDocument);
            usort($result, function ($a, $b) {
                $orderCmp = ((int) $a['display_order']) <=> ((int) $b['display_order']);
                if ($orderCmp !== 0) {
                    return $orderCmp;
                }
                return strcmp($a['document_name'], $b['document_name']);
            });

            foreach ($result as &$row) {
                unset($row['_score']);
            }

            return array_map([$this, 'map_requirement_row'], $result);
        }

        $sql = "SELECT
                    r.id,
                    r.document_id,
                    r.grade_level,
                    r.enrollment_type,
                    c.name AS document_name,
                    r.is_required,
                    r.display_order,
                    c.description,
                    r.is_active,
                    r.created_at,
                    r.updated_at
                FROM {$this->rulesTable} r
                INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
                                WHERE COALESCE(r.is_active, 1) = 1
                                    AND COALESCE(c.is_active, 1) = 1
                                    AND (
                                                LOWER(TRIM(r.grade_level)) = LOWER(TRIM(?))
                                                OR r.grade_level IS NULL
                                                OR TRIM(r.grade_level) = ''
                                                OR UPPER(TRIM(r.grade_level)) = 'ALL'
                                            )
                                    AND (
                                                r.enrollment_type IS NULL
                                                OR TRIM(r.enrollment_type) = ''
                                                OR UPPER(TRIM(r.enrollment_type)) = 'ALL TYPES'
                                            )
                ORDER BY r.display_order ASC, c.name ASC";

        $rows = $this->db->raw($sql, [$gradeLevel])->fetchAll(PDO::FETCH_ASSOC);
        return array_map([$this, 'map_requirement_row'], $rows);
    }

    /**
     * Get single requirement by ID
     */
    public function get_requirement_by_id($id) {
        $this->ensure_rules_table();

        $sql = "SELECT
                    r.id,
                    r.document_id,
                    r.grade_level,
                    r.enrollment_type,
                    c.name AS document_name,
                    r.is_required,
                    r.display_order,
                    c.description,
                    r.is_active,
                    r.created_at,
                    r.updated_at
                FROM {$this->rulesTable} r
                INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
                WHERE r.id = ?
                LIMIT 1";

        $row = $this->db->raw($sql, [$id])->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        return $this->map_requirement_row($row);
    }

    /**
     * Create or reuse a document catalog entry
     */
    public function create_catalog_document($data) {
        $documentName = isset($data['document_name']) ? trim($data['document_name']) : '';
        if ($documentName === '') {
            throw new Exception('Document name is required');
        }

        $description = array_key_exists('description', $data) ? $data['description'] : null;
        $documentId = $this->resolve_document_id($documentName, $description);

        if (array_key_exists('is_active', $data)) {
            $isActive = $data['is_active'] ? 1 : 0;
            $this->db->raw(
                "UPDATE {$this->catalogTable} SET is_active = ?, updated_at = ? WHERE id = ?",
                [$isActive, app_now(), $documentId]
            );
        }

        return $documentId;
    }

    /**
     * Get reusable documents from catalog
     */
    public function get_catalog_documents($activeOnly = false) {
        $sql = "SELECT id, code, name, description, is_active, created_at, updated_at
                FROM {$this->catalogTable}";

        $params = [];
        if ($activeOnly) {
            $sql .= " WHERE is_active = 1";
        }

        $sql .= " ORDER BY name ASC";

        $rows = $this->db->raw($sql, $params)->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function ($row) {
            return [
                'id' => (int) $row['id'],
                'code' => $row['code'],
                'name' => $row['name'],
                'description' => $row['description'],
                'is_active' => (int) $row['is_active'],
                'created_at' => $row['created_at'],
                'updated_at' => $row['updated_at']
            ];
        }, $rows);
    }

    /**
     * Update reusable document in catalog
     */
    public function update_catalog_document($id, $data) {
        $existing = $this->db->raw(
            "SELECT id, code, name, description, is_active FROM {$this->catalogTable} WHERE id = ? LIMIT 1",
            [$id]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            return false;
        }

        $name = isset($data['name']) ? trim($data['name']) : $existing['name'];
        if ($name === '') {
            throw new Exception('Document name is required');
        }

        $description = array_key_exists('description', $data) ? $data['description'] : $existing['description'];
        $isActive = array_key_exists('is_active', $data) ? ($data['is_active'] ? 1 : 0) : (int) $existing['is_active'];

        // Keep code stable unless name changed significantly and code was empty
        $code = $existing['code'];
        if (!$code) {
            $baseCode = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '_', $name), '_'));
            $code = $baseCode !== '' ? $baseCode : 'document';
        }

        $this->db->raw(
            "UPDATE {$this->catalogTable}
             SET code = ?, name = ?, description = ?, is_active = ?, updated_at = ?
             WHERE id = ?",
            [$code, $name, $description, $isActive, app_now(), $id]
        );

        return true;
    }

    /**
     * Toggle active status of reusable catalog document
     */
    public function toggle_catalog_document($id) {
        $existing = $this->db->raw(
            "SELECT id, is_active FROM {$this->catalogTable} WHERE id = ? LIMIT 1",
            [$id]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            return false;
        }

        $newStatus = $existing['is_active'] ? 0 : 1;
        $this->db->raw(
            "UPDATE {$this->catalogTable} SET is_active = ?, updated_at = ? WHERE id = ?",
            [$newStatus, app_now(), $id]
        );

        return true;
    }

    /**
     * Create new requirement
     */
    public function create_requirement($data) {
        $this->ensure_rules_table();

        $gradeLevel = $data['grade_level'];
        $enrollmentType = $this->normalize_enrollment_type($data['enrollment_type'] ?? null);
        $documentName = $data['document_name'];
        $description = array_key_exists('description', $data) ? $data['description'] : null;

        $documentId = $this->resolve_document_id($documentName, $description);
        $existingRule = $this->get_rule_by_unique_keys($documentId, $gradeLevel, $enrollmentType);

        $isRequired = isset($data['is_required']) && $data['is_required'] ? 1 : 0;
        $displayOrder = isset($data['display_order']) ? (int) $data['display_order'] : 0;
        $isActive = isset($data['is_active']) && $data['is_active'] ? 1 : 0;

        if ($existingRule) {
            $ruleId = (int) $existingRule['id'];
            $this->db->raw(
                "UPDATE {$this->rulesTable}
                 SET is_required = ?, display_order = ?, is_active = ?, updated_at = ?
                 WHERE id = ?",
                [$isRequired, $displayOrder, $isActive, app_now(), $ruleId]
            );

            $this->sync_legacy_row(
                $gradeLevel,
                $enrollmentType,
                $documentName,
                $isRequired,
                $displayOrder,
                $description,
                $isActive
            );

            return $ruleId;
        }

        if ($enrollmentType === null) {
            $this->db->raw(
                "INSERT INTO {$this->rulesTable}
                 (document_id, grade_level, enrollment_type, is_required, display_order, is_active, created_at, updated_at)
                 VALUES (?, ?, NULL, ?, ?, ?, ?, ?)",
                [$documentId, $gradeLevel, $isRequired, $displayOrder, $isActive, app_now(), app_now()]
            );
        } else {
            $this->db->raw(
                "INSERT INTO {$this->rulesTable}
                 (document_id, grade_level, enrollment_type, is_required, display_order, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [$documentId, $gradeLevel, $enrollmentType, $isRequired, $displayOrder, $isActive, app_now(), app_now()]
            );
        }

        $this->sync_legacy_row(
            $gradeLevel,
            $enrollmentType,
            $documentName,
            $isRequired,
            $displayOrder,
            $description,
            $isActive
        );

        $createdRule = $this->get_rule_by_unique_keys($documentId, $gradeLevel, $enrollmentType);
        if (!$createdRule) {
            throw new Exception('Failed to resolve newly created document requirement ID');
        }

        return (int) $createdRule['id'];
    }

    /**
     * Update requirement
     */
    public function update_requirement($id, $data) {
        $this->ensure_rules_table();

        $existingSql = "SELECT r.*, c.name AS document_name, c.description
                FROM {$this->rulesTable} r
                INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
                WHERE r.id = ?
                LIMIT 1";
        $existing = $this->db->raw($existingSql, [$id])->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            return false;
        }

        $oldGradeLevel = $existing['grade_level'];
        $oldEnrollmentType = $existing['enrollment_type'];
        $oldDocumentName = $existing['document_name'];

        $documentId = (int) $existing['document_id'];
        if (isset($data['document_name'])) {
            $description = array_key_exists('description', $data) ? $data['description'] : null;
            $documentId = $this->resolve_document_id($data['document_name'], $description);
        } elseif (array_key_exists('description', $data)) {
            $this->db->raw(
                "UPDATE {$this->catalogTable} SET description = ?, updated_at = ? WHERE id = ?",
                [$data['description'], app_now(), $documentId]
            );
        }

        $gradeLevel = $data['grade_level'] ?? $existing['grade_level'];
        $enrollmentType = array_key_exists('enrollment_type', $data)
            ? $this->normalize_enrollment_type($data['enrollment_type'])
            : $existing['enrollment_type'];

        $isRequired = array_key_exists('is_required', $data)
            ? ($data['is_required'] ? 1 : 0)
            : (int) $existing['is_required'];
        $displayOrder = array_key_exists('display_order', $data)
            ? (int) $data['display_order']
            : (int) $existing['display_order'];
        $isActive = array_key_exists('is_active', $data)
            ? ($data['is_active'] ? 1 : 0)
            : (int) $existing['is_active'];
        $documentName = $data['document_name'] ?? $existing['document_name'];
        $description = array_key_exists('description', $data)
            ? $data['description']
            : $existing['description'];

        if ($enrollmentType === null) {
            $sql = "UPDATE {$this->rulesTable}
                    SET document_id = ?,
                        grade_level = ?,
                        enrollment_type = NULL,
                        is_required = ?,
                        display_order = ?,
                        is_active = ?,
                        updated_at = ?
                    WHERE id = ?";
            $this->db->raw($sql, [$documentId, $gradeLevel, $isRequired, $displayOrder, $isActive, app_now(), $id]);
        } else {
            $sql = "UPDATE {$this->rulesTable}
                    SET document_id = ?,
                        grade_level = ?,
                        enrollment_type = ?,
                        is_required = ?,
                        display_order = ?,
                        is_active = ?,
                        updated_at = ?
                    WHERE id = ?";
            $this->db->raw($sql, [$documentId, $gradeLevel, $enrollmentType, $isRequired, $displayOrder, $isActive, app_now(), $id]);
        }

        if (
            $oldGradeLevel !== $gradeLevel ||
            $oldDocumentName !== $documentName ||
            (($oldEnrollmentType === null && $enrollmentType !== null) || ($oldEnrollmentType !== null && $enrollmentType === null) || ($oldEnrollmentType !== $enrollmentType))
        ) {
            $this->delete_legacy_row($oldGradeLevel, $oldEnrollmentType, $oldDocumentName);
        }

        $this->sync_legacy_row(
            $gradeLevel,
            $enrollmentType,
            $documentName,
            $isRequired,
            $displayOrder,
            $description,
            $isActive
        );

        return true;
    }

    /**
     * Delete requirement
     */
    public function delete_requirement($id) {
        $this->ensure_rules_table();

        $rule = $this->db->raw(
            "SELECT r.grade_level, r.enrollment_type, c.name AS document_name
             FROM {$this->rulesTable} r
             INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
             WHERE r.id = ?
             LIMIT 1",
            [$id]
        )->fetch(PDO::FETCH_ASSOC);

        $deleted = $this->db->table($this->rulesTable)
            ->where('id', $id)
            ->delete();

        if ($deleted && $rule) {
            $this->delete_legacy_row($rule['grade_level'], $rule['enrollment_type'], $rule['document_name']);
        }

        return $deleted;
    }

    /**
     * Toggle active status
     */
    public function toggle_active($id) {
        $this->ensure_rules_table();

        $requirementSql = "SELECT r.id, r.is_active, r.grade_level, r.enrollment_type,
                                  r.is_required, r.display_order, c.name AS document_name, c.description
                           FROM {$this->rulesTable} r
                           INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
                           WHERE r.id = ?
                           LIMIT 1";
        $requirement = $this->db->raw($requirementSql, [$id])->fetch(PDO::FETCH_ASSOC);
        if (!$requirement) {
            return false;
        }

        $newStatus = $requirement['is_active'] ? 0 : 1;
        $updated = $this->db->table($this->rulesTable)
            ->where('id', $id)
            ->update([
                'is_active' => $newStatus,
                'updated_at' => app_now()
            ]);

        if ($updated) {
            $this->sync_legacy_row(
                $requirement['grade_level'],
                $requirement['enrollment_type'],
                $requirement['document_name'],
                (int) $requirement['is_required'],
                (int) $requirement['display_order'],
                $requirement['description'],
                $newStatus
            );
        }

        return $updated;
    }

    /**
     * Get unique grade levels
     */
    public function get_grade_levels() {
        $this->ensure_rules_table();

        return $this->db->table($this->rulesTable)
            ->select('DISTINCT grade_level')
            ->order_by('grade_level', 'ASC')
            ->get_all();
    }

    /**
     * Get requirements for enrollment step:
     * - include all-type requirements (NULL/empty/All Types)
     * - include specific enrollment type requirements
     * - prefer specific type over all-type for same document
     */
    public function get_requirements_for_enrollment($gradeLevel, $enrollmentType = null) {
        $this->ensure_rules_table();

        $normalizedType = $this->normalize_enrollment_type($enrollmentType);
        $normalizedTypeShort = $normalizedType !== null
            ? strtolower(trim(explode(' ', $normalizedType)[0]))
            : null;

        $sql = "SELECT
                    r.id,
                    r.document_id,
                    r.grade_level,
                    r.enrollment_type,
                    c.name AS document_name,
                    r.is_required,
                    r.display_order,
                    c.description,
                    r.is_active,
                    r.created_at,
                    r.updated_at
                FROM {$this->rulesTable} r
                INNER JOIN {$this->catalogTable} c ON c.id = r.document_id
                                WHERE COALESCE(r.is_active, 1) = 1
                  AND LOWER(TRIM(r.grade_level)) = LOWER(TRIM(?))";

        $params = [$gradeLevel];

        if ($normalizedType !== null) {
            $sql .= " AND (
                        r.enrollment_type IS NULL
                        OR TRIM(r.enrollment_type) = ''
                        OR UPPER(TRIM(r.enrollment_type)) = 'ALL TYPES'
                        OR LOWER(TRIM(r.enrollment_type)) = LOWER(TRIM(?))
                        OR LOWER(TRIM(r.enrollment_type)) = ?
                      )";
            $params[] = $normalizedType;
            $params[] = $normalizedTypeShort;
        } else {
            $sql .= " AND (
                        r.enrollment_type IS NULL
                        OR TRIM(r.enrollment_type) = ''
                        OR UPPER(TRIM(r.enrollment_type)) = 'ALL TYPES'
                      )";
        }

        $sql .= " ORDER BY r.display_order ASC, c.name ASC";

        $rows = $this->db->raw($sql, $params)->fetchAll(PDO::FETCH_ASSOC);

        $bestByDocument = [];
        foreach ($rows as $row) {
            $docKey = (string) $row['document_id'];
            $rowType = strtolower(trim((string) ($row['enrollment_type'] ?? '')));
            $rowTypeShort = $rowType !== '' ? strtolower(trim(explode(' ', $rowType)[0])) : '';
            $isSpecificType = $normalizedType !== null && ($rowType === strtolower(trim($normalizedType)) || $rowTypeShort === $normalizedTypeShort);
            $score = $isSpecificType ? 2 : 1;

            if (!isset($bestByDocument[$docKey])) {
                $row['_score'] = $score;
                $bestByDocument[$docKey] = $row;
                continue;
            }

            $current = $bestByDocument[$docKey];
            if ($score > $current['_score']) {
                $row['_score'] = $score;
                $bestByDocument[$docKey] = $row;
            } elseif ($score === $current['_score']) {
                if ((int) $row['display_order'] < (int) $current['display_order']) {
                    $row['_score'] = $score;
                    $bestByDocument[$docKey] = $row;
                }
            }
        }

        $result = array_values($bestByDocument);
        usort($result, function ($a, $b) {
            $orderCmp = ((int) $a['display_order']) <=> ((int) $b['display_order']);
            if ($orderCmp !== 0) {
                return $orderCmp;
            }
            return strcmp($a['document_name'], $b['document_name']);
        });

        foreach ($result as &$row) {
            unset($row['_score']);
        }

        return array_map([$this, 'map_requirement_row'], $result);
    }
}
?>
