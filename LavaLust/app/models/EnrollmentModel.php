<?php

/**
 * EnrollmentModel - Manage enrollment records
 * Handles CRUD operations for enrollment data
 */
class EnrollmentModel extends Model
{
    protected $table = 'enrollments';
    protected $primaryKey = 'id';
    protected $allowedColumns = [
        'id', 'academic_period_id', 'enrollment_type', 'grade_level', 'status', 'rejection_reason', 'rejection_note',
        'submitted_date', 'first_reviewed_date', 'approved_date', 'rejected_date',
        'approved_by', 'last_reviewed_by', 'last_review_date', 'created_user_id',
        'created_student_id', 'created_at', 'updated_at', 'enrollment_period_id'
    ];

    /**
     * Create a new enrollment with all related data
     * @param array $data Enrollment data including nested address, learner, flags, contacts, documents
     * @return int|false Enrollment ID on success, false on failure
     */
    public function create_enrollment($data)
    {
        try {
            $guardianName = trim((string)($data['guardian_name'] ?? ''));
            $guardianContact = trim((string)($data['guardian_contact'] ?? ''));
            $guardianEmail = trim((string)($data['guardian_email'] ?? ''));

            if (($guardianName === '' || $guardianContact === '' || $guardianEmail === '') && isset($data['contacts']) && is_array($data['contacts'])) {
                foreach ($data['contacts'] as $contact) {
                    $contactType = strtolower((string)($contact['contact_type'] ?? $contact['type'] ?? ''));
                    if ($contactType === 'guardian') {
                        if ($guardianName === '') {
                            $guardianName = trim((string)($contact['name'] ?? ''));
                        }
                        if ($guardianContact === '') {
                            $guardianContact = trim((string)($contact['phone'] ?? ''));
                        }
                        if ($guardianEmail === '') {
                            $guardianEmail = trim((string)($contact['email'] ?? ''));
                        }
                        break;
                    }
                }
            }

            // Host schema stores guardian details in enrollment_parent_contacts, not enrollments.
            // If guardian fields are provided directly, ensure they are represented as a contact record.
            if ($guardianName !== '' && (!isset($data['contacts']) || !is_array($data['contacts']))) {
                $data['contacts'] = [];
            }
            if ($guardianName !== '' && is_array($data['contacts'])) {
                $hasGuardianContact = false;
                foreach ($data['contacts'] as $contact) {
                    $contactType = strtolower((string)($contact['contact_type'] ?? $contact['type'] ?? ''));
                    if ($contactType === 'guardian') {
                        $hasGuardianContact = true;
                        break;
                    }
                }

                if (!$hasGuardianContact) {
                    $data['contacts'][] = [
                        'type' => 'Guardian',
                        'name' => $guardianName,
                        'phone' => $guardianContact,
                        'email' => $guardianEmail,
                        'is_primary' => 0,
                    ];
                }
            }

            // Get active academic period if not provided
            $academicPeriodId = $data['academic_period_id'] ?? null;
            if (!$academicPeriodId) {
                // Get active academic period
                $activePeriodQuery = "SELECT id FROM academic_periods WHERE status = 'active' LIMIT 1";
                $stmt = $this->db->raw($activePeriodQuery);
                $activePeriod = $stmt->fetch();
                if ($activePeriod) {
                    $academicPeriodId = $activePeriod['id'];
                }
            }

            $submittedAt = app_now();
            if (empty($submittedAt) || strtotime((string)$submittedAt) === false) {
                $submittedAt = date('Y-m-d H:i:s');
            }

            // Insert main enrollment record
            $enrollment = [
                'academic_period_id' => $academicPeriodId,
                'enrollment_type' => $data['enrollment_type'] ?? 'New Student',
                'grade_level' => $data['grade_level'] ?? '',
                'enrollment_period_id' => $data['enrollment_period_id'] ?? null,
                'status' => $data['status'] ?? 'Pending',
                'submitted_date' => $submittedAt,
                'created_user_id' => $data['created_user_id'] ?? $data['user_id'] ?? null,
                'created_student_id' => $data['created_student_id'] ?? null,
                'created_at' => app_now(),
                'updated_at' => app_now()
            ];

            // Insert enrollment
            $insertResult = $this->db->table('enrollments')->insert($enrollment);

            // Prefer direct insert return value when available
            $enrollmentId = null;
            if (is_numeric($insertResult) && (int)$insertResult > 0) {
                $enrollmentId = (int)$insertResult;
            }

            // Use DB helper methods only if available in this driver instance
            if (empty($enrollmentId) && method_exists($this->db, 'insert_id')) {
                $enrollmentId = $this->db->insert_id();
            }
            if (empty($enrollmentId) && method_exists($this->db, 'last_id')) {
                $enrollmentId = $this->db->last_id();
            }

            // Fallback lookup if insert id is unavailable in current DB driver
            if (empty($enrollmentId)) {
                if (isset($data['user_id']) && $data['user_id'] !== null) {
                    $enrollmentQuery = "SELECT `id` FROM `enrollments` WHERE `created_user_id` = ? AND `grade_level` = ? ORDER BY `id` DESC LIMIT 1";
                    $stmt = $this->db->raw($enrollmentQuery, [$data['user_id'], $data['grade_level']]);
                } else {
                    $enrollmentQuery = "SELECT `id` FROM `enrollments` WHERE `created_user_id` IS NULL AND `grade_level` = ? ORDER BY `id` DESC LIMIT 1";
                    $stmt = $this->db->raw($enrollmentQuery, [$data['grade_level']]);
                }

                $result = $stmt->fetch();
                if ($result && isset($result['id'])) {
                    $enrollmentId = $result['id'];
                }
            }

            if (empty($enrollmentId)) {
                throw new Exception('Failed to create enrollment record');
            }

            // Insert enrollment learner info
            if (isset($data['learner']) && !empty($data['learner'])) {
                $learner = [
                    'enrollment_id' => $enrollmentId,
                    'first_name' => $data['learner']['first_name'] ?? '',
                    'middle_name' => $data['learner']['middle_name'] ?? '',
                    'last_name' => $data['learner']['last_name'] ?? '',
                    'birth_date' => $data['learner']['birth_date'] ?? null,
                    'gender' => $data['learner']['gender'] ?? '',
                    'guardian_phone' => $data['learner']['guardian_phone'] ?? null,
                    'created_at' => app_now()
                ];
                $this->db->table('enrollment_learners')->insert($learner);
            }

            // Insert addresses (current and permanent)
            if (isset($data['addresses']) && is_array($data['addresses'])) {
                foreach ($data['addresses'] as $addressType => $address) {
                    if (!empty($address) && !empty($address['street'])) {
                        $addressRecord = [
                            'enrollment_id' => $enrollmentId,
                            'address_type' => ucfirst($addressType),
                            'address' => $address['street'] ?? '',
                            'barangay' => $address['barangay'] ?? '',
                            'municipality' => $address['municipality'] ?? '',
                            'province' => $address['province'] ?? '',
                            'zip_code' => $address['zip_code'] ?? '',
                            'phone' => $address['phone'] ?? '',
                            'created_at' => app_now()
                        ];
                        $this->db->table('enrollment_addresses')->insert($addressRecord);
                    }
                }
            }

            // Insert enrollment flags (special information)
            if (isset($data['flags']) && !empty($data['flags'])) {
                $flags = [
                    'enrollment_id' => $enrollmentId,
                    'is_returning_student' => 0, // Deprecated, now using enrollment_type on main table
                    'is_indigenous_ip' => $data['flags']['is_indigenous_ip'] ? 1 : 0,
                    'is_4ps_beneficiary' => $data['flags']['is_4ps_beneficiary'] ? 1 : 0,
                    'has_disability' => $data['flags']['has_disability'] ? 1 : 0,
                    'disability_type' => $data['flags']['disability_type'] ?? null,
                    'special_language' => $data['flags']['special_language'] ?? null,
                    'created_at' => app_now()
                ];
                $this->db->table('enrollment_flags')->insert($flags);
            }

            // Insert parent/guardian contacts
            if (isset($data['contacts']) && is_array($data['contacts'])) {
                foreach ($data['contacts'] as $contact) {
                    if (!empty($contact['name'])) {
                        $contactRecord = [
                            'enrollment_id' => $enrollmentId,
                            'contact_type' => $contact['type'] ?? 'Guardian',
                            'name' => $contact['name'] ?? '',
                            'phone' => $contact['phone'] ?? '',
                            'email' => $contact['email'] ?? '',
                            'is_primary' => $contact['is_primary'] ?? 0,
                            'created_at' => app_now()
                        ];
                        $this->db->table('enrollment_parent_contacts')->insert($contactRecord);
                    }
                }
            }

            // Insert documents (file metadata only, files are stored separately)
            if (isset($data['documents']) && is_array($data['documents'])) {
                foreach ($data['documents'] as $document) {
                    if (!empty($document)) {
                        $docRecord = [
                            'enrollment_id' => $enrollmentId,
                            'file_name' => $document['file_name'] ?? '',
                            'file_path' => $document['file_path'] ?? '',
                            'file_type' => $document['file_type'] ?? '',
                            'file_size' => $document['file_size'] ?? 0,
                            'document_type' => $document['document_type'] ?? '',
                            'upload_date' => app_now(),
                            'verification_status' => 'Pending',
                            'created_at' => app_now(),
                            'updated_at' => app_now()
                        ];
                        $this->db->table('enrollment_documents')->insert($docRecord);
                    }
                }
            }

            return $enrollmentId;
        } catch (Exception $e) {
            throw $e;
        }
    }

    /**
     * Get enrollment by ID with all related data
     * @param int $enrollmentId
     * @return array|false
     */
    public function get_enrollment_with_details($enrollmentId)
    {
        // Get main enrollment record with school year from academic_periods
        $sql = "SELECT e.*, 
                   COALESCE(e.submitted_date, e.created_at) AS submitted_date,
                       ap.school_year, 
                       ap.quarter,
                       ep.enrollment_name,
                       ep.start_date as enrollment_start_date,
                       ep.end_date as enrollment_end_date,
                       s.student_id,
                       u.first_name as user_first_name,
                       u.last_name as user_last_name
                FROM enrollments e
                LEFT JOIN academic_periods ap ON e.academic_period_id = ap.id
                LEFT JOIN enrollment_periods ep ON e.enrollment_period_id = ep.id
                LEFT JOIN students s ON e.created_student_id = s.id
                LEFT JOIN users u ON e.created_user_id = u.id
                WHERE e.id = ?";
        
        $stmt = $this->db->raw($sql, [$enrollmentId]);
        $enrollmentResults = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Check if enrollment exists
        if (empty($enrollmentResults)) {
            error_log("No enrollment found for ID: " . $enrollmentId);
            return false;
        }

        $enrollment = $enrollmentResults[0];
        error_log("Found enrollment with school_year: " . ($enrollment['school_year'] ?? 'NULL'));

        // Get learner info
        $learnerResults = $this->db->table('enrollment_learners')
            ->where('enrollment_id', $enrollmentId)
            ->get_all();
        $enrollment['learner'] = isset($learnerResults[0]) ? $learnerResults[0] : null;

        // Get addresses
        $enrollment['addresses'] = $this->db->table('enrollment_addresses')
            ->where('enrollment_id', $enrollmentId)
            ->get_all();

        // Get flags
        $flagResults = $this->db->table('enrollment_flags')
            ->where('enrollment_id', $enrollmentId)
            ->get_all();
        $enrollment['flags'] = isset($flagResults[0]) ? $flagResults[0] : null;

        // Get contacts
        $enrollment['contacts'] = $this->db->table('enrollment_parent_contacts')
            ->where('enrollment_id', $enrollmentId)
            ->get_all();

        // Get documents
        $enrollment['documents'] = $this->db->table('enrollment_documents')
            ->where('enrollment_id', $enrollmentId)
            ->get_all();

        return $enrollment;
    }

    /**
     * Get all enrollments with pagination
     * @param int $page
     * @param int $limit
     * @param string $status Filter by status (optional)
     * @return array
     */
    public function get_enrollments($page = 1, $limit = 20, $status = null)
    {
        $query = $this->db->table('enrollments');

        if ($status) {
            $query = $query->where('status', $status);
        }

        $total = $query->count();
        $offset = ($page - 1) * $limit;

        $enrollments = $query->offset($offset)
            ->limit($limit)
            ->order_by('id', 'DESC')
            ->get()
            ->fetch_all();

        if (is_array($enrollments)) {
            foreach ($enrollments as &$enrollment) {
                if (empty($enrollment['submitted_date']) && !empty($enrollment['created_at'])) {
                    $enrollment['submitted_date'] = $enrollment['created_at'];
                }
            }
            unset($enrollment);
        }

        return [
            'data' => $enrollments,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => ceil($total / $limit)
        ];
    }

    /**
     * Get all enrollments with filters
     * @param array $filters
     * @return array
     */
    public function get_all($filters = [])
    {
        $query = $this->db->table($this->table);

        if (!empty($filters['created_user_id'])) {
            $query = $query->where('created_user_id', $filters['created_user_id']);
        }

        if (!empty($filters['created_student_id'])) {
            $query = $query->where('created_student_id', $filters['created_student_id']);
        }

        if (!empty($filters['status'])) {
            $query = $query->where('status', $filters['status']);
        }

        if (!empty($filters['enrollment_period_id'])) {
            $query = $query->where('enrollment_period_id', $filters['enrollment_period_id']);
        }

        if (!empty($filters['enrollment_type'])) {
            $query = $query->where('enrollment_type', $filters['enrollment_type']);
        }

        return $query->order_by('id', 'DESC')->get_all();
    }

    /**
     * Get enrollments by user ID
     * @param int $userId
     * @return array
     */
    public function get_enrollments_by_user($userId)
    {
        $sql = "SELECT e.*, COALESCE(e.submitted_date, e.created_at) AS submitted_date, ap.school_year 
                FROM enrollments e
                LEFT JOIN academic_periods ap ON e.academic_period_id = ap.id
                WHERE e.created_user_id = ? 
                ORDER BY e.id DESC";
        
        $stmt = $this->db->raw($sql, [$userId]);
        $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Ensure result is always an array
        return is_array($result) ? $result : [];
    }

    /**
     * Update enrollment status
     * @param int $enrollmentId
     * @param string $status
     * @param int|null $userId
     * @return bool
     */
    public function update_status($enrollmentId, $status, $userId = null)
    {
        $updateData = [
            'status' => $status,
            'updated_at' => app_now()
        ];

        if ($status === 'Approved' && !empty($userId)) {
            $updateData['approved_by'] = $userId;
            $updateData['approved_date'] = app_now();
            
            // AUTOMATICALLY UPDATE THE STUDENT RECORD UPON APPROVAL
            // 1. Get the enrollment details to find the student
            $enrollment = $this->db->table('enrollments')->where('id', $enrollmentId)->get();
            
            if ($enrollment) {
                // Determine which student to update
                $studentId = $enrollment['created_student_id'];
                
                // If no student ID linked yet, try to find one via user_id
                if (!$studentId && !empty($enrollment['created_user_id'])) {
                    $existingStudent = $this->db->table('students')
                        ->where('user_id', $enrollment['created_user_id'])
                        ->get();
                    if ($existingStudent) {
                        $studentId = $existingStudent['id'];
                    }
                }

                // Update the student record if found
                if ($studentId) {
                    $studentUpdateData = [
                        'enrollment_id' => $enrollmentId,
                        'enrollment_date' => date('Y-m-d'),
                        'year_level' => $enrollment['grade_level'],
                        'status' => 'active',
                        'updated_at' => app_now()
                    ];
                    
                    $this->db->table('students')
                        ->where('id', $studentId)
                        ->update($studentUpdateData);
                    
                    error_log("Student ID {$studentId} updated for Enrollment ID {$enrollmentId}");
                } else {
                     // Optionally: Create a student record if one doesn't exist? 
                     // For now, we assume the student record should exist or will be created by another process.
                     error_log("No student record found to update for Enrollment ID {$enrollmentId}");
                }
            }

        } elseif ($status === 'Rejected' && !empty($userId)) {
            $updateData['rejected_date'] = app_now();
        }

        if (!empty($userId)) {
            $updateData['last_reviewed_by'] = $userId;
            $updateData['last_review_date'] = app_now();
        }

        return $this->db->table('enrollments')
            ->where('id', $enrollmentId)
            ->update($updateData);
    }

    /**
     * Get enrollment count by status
     * @return array
     */
    public function get_enrollment_stats()
    {
        $result = $this->db->table('enrollments')
            ->select('status, COUNT(*) as count')
            ->group_by('status')
            ->get_all();
            
        return $result;
    }

    /**
     * Get payments for a specific enrollment
     * @param int $enrollmentId
     * @return array
     */
    public function get_enrollment_payments($enrollmentId)
    {
        // Get payments
        $payments = $this->db->table('payments')
            ->where('enrollment_id', $enrollmentId)
            ->order_by('created_at', 'DESC')
            ->get_all();
            
        // Get enrollment to determine fees
        $enrollment = $this->db->table('enrollments')->where('id', $enrollmentId)->get();
        
        $requiredFees = 0;
        
        if ($enrollment) {
             // Try to fetch configured fees
             try {
                 $gradeLevel = $enrollment['grade_level'] ?? '';
                 
                 // Sum all required active fees for the student's grade level
                 // Match grade level if year_level is set, otherwise apply to all grades
                 $query = "SELECT SUM(amount) as total FROM school_fees WHERE is_required = 1 AND is_active = 1 AND (year_level IS NULL OR year_level = ?)";
                 $stmt = $this->db->raw($query, [$gradeLevel]);
                 $feeResult = $stmt->fetch();
                 
                 if ($feeResult && isset($feeResult['total'])) {
                     $requiredFees = floatval($feeResult['total']);
                 } 
                 
                 // If 0, fallback to default tuition fee
                 if ($requiredFees == 0) {
                     $requiredFees = 5000.00; // Default tuition fee fallback
                 }
             } catch (Exception $e) {
                 $requiredFees = 5000.00; // Default on error
             }
        }
        
        return [
            'payments' => $payments ? $payments : [],
            'required_fees' => $requiredFees
        ];
    }

    /**
     * Create enrollment for continuing student from past enrollment
     * Copies data from a previous enrollment and increments grade level
     * 
     * @param int $pastEnrollmentId The enrollment ID to copy from
     * @param int $enrollmentPeriodId The new enrollment period ID
     * @param string $newGradeLevel The incremented grade level
     * @param int|null $userId User ID for created_user_id (null for admin-created)
     * @return int|false New enrollment ID on success, false on failure
     */
    public function create_continuing_from_past($pastEnrollmentId, $enrollmentPeriodId, $newGradeLevel, $userId = null)
    {
        try {
            // Get the past enrollment with all details
            $pastEnrollment = $this->get_enrollment_with_details($pastEnrollmentId);
            if (!$pastEnrollment) {
                throw new Exception('Past enrollment not found');
            }

            // Get the correct academic period from the selected enrollment period
            $epQuery = "SELECT academic_period_id FROM enrollment_periods WHERE id = ? LIMIT 1";
            $stmt = $this->db->raw($epQuery, [$enrollmentPeriodId]);
            $ep = $stmt->fetch();
            
            $academicPeriodId = $ep ? $ep['academic_period_id'] : $pastEnrollment['academic_period_id'];

            $submittedAt = app_now();
            if (empty($submittedAt) || strtotime((string)$submittedAt) === false) {
                $submittedAt = date('Y-m-d H:i:s');
            }

            // Create new enrollment with incremented grade level
            $newEnrollment = [
                'academic_period_id' => $academicPeriodId,
                'enrollment_type' => 'Continuing Student',
                'grade_level' => $newGradeLevel,
                'enrollment_period_id' => $enrollmentPeriodId,
                'status' => 'Pending',
                'submitted_date' => $submittedAt,
                'created_user_id' => $userId,
                'created_student_id' => $pastEnrollment['created_student_id'] ?? null,
                'created_at' => app_now(),
                'updated_at' => app_now()
            ];

            $this->db->table('enrollments')->insert($newEnrollment);

            // Get newly created enrollment ID
            $enrollmentQuery = "SELECT `id` FROM `enrollments` WHERE `grade_level` = ? AND `enrollment_type` = 'Continuing Student' AND `created_user_id` = ? ORDER BY `created_at` DESC LIMIT 1";
            $stmt = $this->db->raw($enrollmentQuery, [$newGradeLevel, $userId]);
            $result = $stmt->fetch();

            if (!$result || !isset($result['id'])) {
                throw new Exception('Failed to create new enrollment record');
            }

            $newEnrollmentId = $result['id'];

            // Copy learner info from past enrollment
            if (isset($pastEnrollment['learner']) && $pastEnrollment['learner']) {
                $learner = [
                    'enrollment_id' => $newEnrollmentId,
                    'first_name' => $pastEnrollment['learner']['first_name'] ?? '',
                    'middle_name' => $pastEnrollment['learner']['middle_name'] ?? '',
                    'last_name' => $pastEnrollment['learner']['last_name'] ?? '',
                    'birth_date' => $pastEnrollment['learner']['birth_date'] ?? null,
                    'gender' => $pastEnrollment['learner']['gender'] ?? '',
                    'guardian_phone' => $pastEnrollment['learner']['guardian_phone'] ?? null,
                    'created_at' => app_now()
                ];
                $this->db->table('enrollment_learners')->insert($learner);
            }

            // Copy addresses from past enrollment
            if (isset($pastEnrollment['addresses']) && is_array($pastEnrollment['addresses'])) {
                foreach ($pastEnrollment['addresses'] as $address) {
                    $addressRecord = [
                        'enrollment_id' => $newEnrollmentId,
                        'address_type' => $address['address_type'] ?? '',
                        'address' => $address['address'] ?? '',
                        'barangay' => $address['barangay'] ?? '',
                        'municipality' => $address['municipality'] ?? '',
                        'province' => $address['province'] ?? '',
                        'zip_code' => $address['zip_code'] ?? '',
                        'phone' => $address['phone'] ?? '',
                        'created_at' => app_now()
                    ];
                    $this->db->table('enrollment_addresses')->insert($addressRecord);
                }
            }

            // Copy flags from past enrollment
            if (isset($pastEnrollment['flags']) && $pastEnrollment['flags']) {
                $flags = [
                    'enrollment_id' => $newEnrollmentId,
                    'is_returning_student' => 0,
                    'is_indigenous_ip' => $pastEnrollment['flags']['is_indigenous_ip'] ?? 0,
                    'is_4ps_beneficiary' => $pastEnrollment['flags']['is_4ps_beneficiary'] ?? 0,
                    'has_disability' => $pastEnrollment['flags']['has_disability'] ?? 0,
                    'disability_type' => $pastEnrollment['flags']['disability_type'] ?? null,
                    'special_language' => $pastEnrollment['flags']['special_language'] ?? null,
                    'created_at' => app_now()
                ];
                $this->db->table('enrollment_flags')->insert($flags);
            }

            // Copy parent/guardian contacts from past enrollment
            if (isset($pastEnrollment['contacts']) && is_array($pastEnrollment['contacts'])) {
                foreach ($pastEnrollment['contacts'] as $contact) {
                    if (!empty($contact['name'])) {
                        $contactRecord = [
                            'enrollment_id' => $newEnrollmentId,
                            'contact_type' => $contact['contact_type'] ?? $contact['type'] ?? 'Guardian',
                            'name' => $contact['name'] ?? '',
                            'phone' => $contact['phone'] ?? '',
                            'email' => $contact['email'] ?? '',
                            'is_primary' => $contact['is_primary'] ?? 0,
                            'created_at' => app_now()
                        ];
                        $this->db->table('enrollment_parent_contacts')->insert($contactRecord);
                    }
                }
            }

            return $newEnrollmentId;
        } catch (Exception $e) {
            throw $e;
        }
    }
}
