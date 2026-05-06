<?php

/**
 * ReportController - Generate PDF reports for students
 * 
 * Handles generation of individual and bulk student grade PDF reports.
 * Uses the pdf_helper for PDF generation and template rendering.
 * Uses StudentModel for fetching student and grade data.
 */
class ReportController extends Controller
{
    public function __construct()
    {
        parent::__construct();
        // Load StudentModel so we can use $this->StudentModel->get_all() etc.
        $this->call->model('StudentModel');
        $this->call->helper('pdf_helper');
    }

    /**
     * Convert percentage grade (0-100) to letter grade (1.00-5.00 scale)
     * 
     * @param float $percentage Grade percentage (0-100)
     * @return string Letter grade (1.00, 1.25, 1.50, ..., 5.00)
     */
    private function transmute($percentage)
    {
        if ($percentage >= 97) return "1.00";
        if ($percentage >= 94) return "1.25";
        if ($percentage >= 91) return "1.50";
        if ($percentage >= 88) return "1.75";
        if ($percentage >= 85) return "2.00";
        if ($percentage >= 82) return "2.25";
        if ($percentage >= 79) return "2.50";
        if ($percentage >= 76) return "2.75";
        if ($percentage >= 75) return "3.00";
        return "5.00";
    }

    /**
     * Get students for PDF generation selector
     * GET /api/reports/students?section_id=X&year_level=Y&status=active
     */
    public function api_get_students()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $filters = [
                'section_id' => isset($_GET['section_id']) ? intval($_GET['section_id']) : null,
                'year_level' => isset($_GET['year_level']) ? trim($_GET['year_level']) : null,
                'status' => isset($_GET['status']) ? trim($_GET['status']) : 'active'
            ];

            // remove null filters
            $filters = array_filter($filters, function($v) { return $v !== null; });

            $students = $this->StudentModel->get_all($filters);

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'students' => $students
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching students: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Debug endpoint: See raw grades from database for a student
     * GET /api/reports/debug/student/{student_id}/grades?academic_period_ids=21,20
     */
    public function api_debug_student_grades($student_id)
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            // Parse period IDs
            $periodIds = [];
            if (isset($_GET['academic_period_ids'])) {
                $csvIds = trim($_GET['academic_period_ids']);
                $periodIds = array_map('intval', array_filter(explode(',', $csvIds)));
            }

            // Fetch ALL raw grades with all columns
            $query = $this->db->table('final_grades')
                ->select('final_grades.*, subjects.course_code, subjects.course_name, academic_periods.period_type, academic_periods.school_year, academic_periods.semester')
                ->join('subjects', 'subjects.id = final_grades.subject_id')
                ->join('academic_periods', 'academic_periods.id = final_grades.academic_period_id')
                ->where('final_grades.student_id', $student_id)
                ->order_by('academic_periods.id', 'ASC')
                ->order_by('subjects.course_code', 'ASC');

            // Apply period filter if provided
            if (!empty($periodIds)) {
                $query->in('final_grades.academic_period_id', $periodIds);
            }

            $allGrades = $query->get_all() ?? [];

            http_response_code(200);
            echo json_encode([
                'success' => true,
                'student_id' => $student_id,
                'period_ids_requested' => $periodIds,
                'total_grades_found' => count($allGrades),
                'raw_grades' => $allGrades
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error fetching grades: ' . $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    /**
     * Generate individual student grade report PDF
     * GET /api/reports/student/{student_id}/pdf?academic_period_ids=ID1,ID2&academic_period_id=ID1&template=standard
     * Accepts both academic_period_ids (CSV) and academic_period_id (single, for backward compat)
     */
    public function api_generate_student_report($student_id)
    {
        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            // Parse academic period IDs: prefer academic_period_ids (CSV), fall back to academic_period_id
            $periodIds = [];
            if (isset($_GET['academic_period_ids'])) {
                $csvIds = trim($_GET['academic_period_ids']);
                $periodIds = array_map('intval', array_filter(explode(',', $csvIds)));
            } elseif (isset($_GET['academic_period_id'])) {
                $periodIds = [intval($_GET['academic_period_id'])];
            }

            $template = isset($_GET['template']) ? trim($_GET['template']) : 'standard';

            // Get student data
            $student = $this->StudentModel->get_student($student_id);
            if (!$student) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Student not found']);
                return;
            }

            // Get academic period info (use first period for display)
            $period = [];
            if (!empty($periodIds)) {
                $period = $this->db->table('academic_periods')->where('id', $periodIds[0])->get() ?? [];
            }

            // Get student's final grades from all specified periods, merged by subject
            $grades = [];
            if (!empty($periodIds)) {
                $allGrades = $this->db->table('final_grades')
                    ->select('final_grades.*, subjects.course_code, subjects.course_name, subjects.credits, academic_periods.period_type')
                    ->join('subjects', 'subjects.id = final_grades.subject_id')
                    ->join('academic_periods', 'academic_periods.id = final_grades.academic_period_id')
                    ->where('final_grades.student_id', $student_id)
                    ->in('final_grades.academic_period_id', $periodIds)
                    ->order_by('subjects.course_code', 'ASC')
                    ->get_all() ?? [];

                // Merge grades by subject: group midterm and final, then average
                $gradesMap = [];
                foreach ($allGrades as $g) {
                    $subjCode = $g['course_code'];
                    if (!isset($gradesMap[$subjCode])) {
                        $gradesMap[$subjCode] = [
                            'course_code' => $g['course_code'],
                            'course_name' => $g['course_name'],
                            'credits' => $g['credits'],
                            'midterm_grade' => '-',
                            'final_grade' => '-',
                            'final_grade_num' => 0,
                            'remarks' => 'INC',
                            'midterm_num' => null,
                            'final_num' => null
                        ];
                    }

                    // Populate midterm/final based on period_type (use final_grade_num which is numeric 0-100)
                    if (stripos($g['period_type'], 'Midterm') !== false) {
                        $gradesMap[$subjCode]['midterm_grade'] = $g['final_grade'] ?? '-';
                        $gradesMap[$subjCode]['midterm_num'] = floatval($g['final_grade_num'] ?? 0);
                    } elseif (stripos($g['period_type'], 'Final') !== false) {
                        $gradesMap[$subjCode]['final_grade'] = $g['final_grade'] ?? '-';
                        $gradesMap[$subjCode]['final_num'] = floatval($g['final_grade_num'] ?? 0);
                    }
                }

                // Calculate averaged final grades (numeric 0-100 scale, then convert using transmute)
                foreach ($gradesMap as &$g) {
                    $midNum = $g['midterm_num'] ?? 0;
                    $finalNum = $g['final_num'] ?? 0;
                    
                    // Average the numeric grades (0-100 scale)
                    if ($midNum > 0 && $finalNum > 0) {
                        $averagedPercent = ($midNum + $finalNum) / 2;
                    } elseif ($midNum > 0) {
                        $averagedPercent = $midNum;
                    } elseif ($finalNum > 0) {
                        $averagedPercent = $finalNum;
                    } else {
                        $averagedPercent = 0;
                    }
                    
                    // Store averaged numeric grade and convert to letter grade using transmute
                    $g['final_grade_num'] = round($averagedPercent, 2);
                    $letterGrade = ($averagedPercent > 0) ? $this->transmute($averagedPercent) : '5.00';
                    $g['final_grade'] = $letterGrade; // Store the letter grade (1.00-5.00) for display
                    
                    // Determine remarks based on numeric grade (typically 75+ passes)
                    if ($averagedPercent >= 75) {
                        $g['remarks'] = 'PASSED';
                    } elseif ($averagedPercent > 0) {
                        $g['remarks'] = 'FAILED';
                    }
                }
                $grades = array_values($gradesMap);
            }

            // Generate PDF using helper
            $pdf = generate_student_pdf($student, $grades, $period, $template);

            // Output PDF to browser (inline display, not download)
            $filename = 'Grade_Report_' . ($student['student_id'] ?? $student_id);
            output_pdf_to_browser($pdf, $filename, false);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error generating report: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Generate bulk PDF reports for selected students
     * POST /api/reports/bulk/pdf
     * Body: { "student_ids": [1,2,3], "academic_period_ids": [10, 11], "academic_period_id": 10, "template": "standard" }
     * Accepts both academic_period_ids (array) and academic_period_id (single, for backward compat)
     */
    public function api_generate_bulk_reports()
    {
        api_set_json_headers();

        if (!$this->session->userdata('logged_in')) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $student_ids = $input['student_ids'] ?? [];
            
            // Parse period IDs: prefer academic_period_ids (array), fall back to academic_period_id
            $periodIds = [];
            if (!empty($input['academic_period_ids']) && is_array($input['academic_period_ids'])) {
                $periodIds = array_map('intval', $input['academic_period_ids']);
            } elseif (isset($input['academic_period_id'])) {
                $periodIds = [intval($input['academic_period_id'])];
            }

            $template = $input['template'] ?? 'standard';

            if (empty($student_ids) || !is_array($student_ids)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No students selected or invalid format']);
                return;
            }

            // Fetch all students with grades merged from multiple periods
            $students = [];
            $gradesMap = [];

            foreach ($student_ids as $sid) {
                $student = $this->StudentModel->get_student($sid);
                if (!$student) continue;

                $students[] = $student;

                // Fetch grades for this student from all specified periods
                $studentGrades = [];
                if (!empty($periodIds)) {
                    $allGrades = $this->db->table('final_grades')
                        ->select('final_grades.*, subjects.course_code, subjects.course_name, subjects.credits, academic_periods.period_type')
                        ->join('subjects', 'subjects.id = final_grades.subject_id')
                        ->join('academic_periods', 'academic_periods.id = final_grades.academic_period_id')
                        ->where('final_grades.student_id', $sid)
                        ->in('final_grades.academic_period_id', $periodIds)
                        ->order_by('subjects.course_code', 'ASC')
                        ->get_all() ?? [];

                    // Merge grades by subject: group midterm and final, then average
                    $gradesBySubj = [];
                    foreach ($allGrades as $g) {
                        $subjCode = $g['course_code'];
                        if (!isset($gradesBySubj[$subjCode])) {
                            $gradesBySubj[$subjCode] = [
                                'course_code' => $g['course_code'],
                                'course_name' => $g['course_name'],
                                'credits' => $g['credits'],
                                'midterm_grade' => '-',
                                'final_grade' => '-',
                                'final_grade_num' => 0,
                                'remarks' => 'INC',
                                'midterm_num' => null,
                                'final_num' => null
                            ];
                        }

                        // Populate midterm/final based on period_type (use final_grade_num which is numeric 0-100)
                        if (stripos($g['period_type'], 'Midterm') !== false) {
                            $gradesBySubj[$subjCode]['midterm_grade'] = $g['final_grade'] ?? '-';
                            $gradesBySubj[$subjCode]['midterm_num'] = floatval($g['final_grade_num'] ?? 0);
                        } elseif (stripos($g['period_type'], 'Final') !== false) {
                            $gradesBySubj[$subjCode]['final_grade'] = $g['final_grade'] ?? '-';
                            $gradesBySubj[$subjCode]['final_num'] = floatval($g['final_grade_num'] ?? 0);
                        }
                    }

                    // Calculate averaged final grades (numeric 0-100 scale, then convert using transmute)
                    foreach ($gradesBySubj as &$g) {
                        $midNum = $g['midterm_num'] ?? 0;
                        $finalNum = $g['final_num'] ?? 0;
                        
                        // Average the numeric grades (0-100 scale)
                        if ($midNum > 0 && $finalNum > 0) {
                            $averagedPercent = ($midNum + $finalNum) / 2;
                        } elseif ($midNum > 0) {
                            $averagedPercent = $midNum;
                        } elseif ($finalNum > 0) {
                            $averagedPercent = $finalNum;
                        } else {
                            $averagedPercent = 0;
                        }
                        
                        // Store averaged numeric grade and convert to letter grade using transmute
                        $g['final_grade_num'] = round($averagedPercent, 2);
                        $letterGrade = ($averagedPercent > 0) ? $this->transmute($averagedPercent) : '5.00';
                        $g['final_grade'] = $letterGrade; // Store the letter grade (1.00-5.00) for display
                        
                        // Determine remarks based on numeric grade (typically 75+ passes)
                        if ($averagedPercent >= 75) {
                            $g['remarks'] = 'PASSED';
                        } elseif ($averagedPercent > 0) {
                            $g['remarks'] = 'FAILED';
                        }
                    }
                    $studentGrades = array_values($gradesBySubj);
                }

                $gradesMap[$sid] = $studentGrades;
            }

            if (empty($students)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No valid students found']);
                return;
            }

            // Fetch academic period info (use first period for display)
            $period = [];
            if (!empty($periodIds)) {
                $period = $this->db->table('academic_periods')->where('id', $periodIds[0])->get() ?? [];
            }

            // Generate ZIP archive of PDFs using helper
            $zipContent = generate_bulk_pdf_zip($students, $gradesMap, $period, $template);

            // Output ZIP as attachment
            $filename = 'Grade_Reports_' . date('Y-m-d_H-i-s') . '.zip';
            header('Content-Type: application/zip');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . strlen($zipContent));
            echo $zipContent;

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error generating bulk reports: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Export admin reports as a formal PDF.
     * POST /api/reports/export-pdf
     */
    public function api_export_admin_report_pdf()
    {
        if (!$this->session->userdata('logged_in')) {
            api_set_json_headers();
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized']);
            return;
        }

        $role = (string)($this->session->userdata('role') ?? '');
        if ($role !== 'admin') {
            api_set_json_headers();
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Forbidden']);
            return;
        }

        try {
            $input = json_decode(file_get_contents('php://input'), true);
            if (!is_array($input)) $input = [];

            $reportType = trim((string)($input['reportType'] ?? ''));
            $reportTypeLabel = trim((string)($input['reportTypeLabel'] ?? ''));
            $rows = is_array($input['rows'] ?? null) ? $input['rows'] : [];
            $summaryCards = is_array($input['summary'] ?? null) ? $input['summary'] : [];

            $reportTitleMap = [
                'enrollment' => 'Enrollment Report',
                'payment' => 'Payment Report',
                'paymentPlan' => 'Payment Plan Report',
                'uniformOrder' => 'Uniform Order Report',
                'studentStatus' => 'Student Status Report',
                'studentGrade' => 'Student Grade Report',
            ];

            $reportTitle = $reportTitleMap[$reportType] ?? ($reportTypeLabel ?: 'Report');
            $reportTypeLabel = $reportTypeLabel ?: $reportTitle;

            $generatedBy = trim((string)($input['generatedBy'] ?? $this->session->userdata('email') ?? $this->session->userdata('username') ?? 'Admin'));
            $generatedAtRaw = app_now();
            $generatedAt = date('F d, Y h:i A', strtotime($generatedAtRaw));

            $recordCount = count($rows);

            $summaryItems = [];
            $summaryKeys = [];
            $summaryItems[] = ['label' => 'Total Records', 'value' => $recordCount];
            $summaryItems[] = ['label' => 'Report Type', 'value' => $reportTypeLabel];
            $summaryItems[] = ['label' => 'Generated Date', 'value' => $generatedAt];
            $summaryKeys['total records'] = true;
            $summaryKeys['report type'] = true;
            $summaryKeys['generated date'] = true;

            foreach ($summaryCards as $item) {
                if (!is_array($item)) continue;
                $label = trim((string)($item['label'] ?? ''));
                if ($label === '') continue;
                $key = strtolower($label);
                if (isset($summaryKeys[$key])) continue;
                $summaryKeys[$key] = true;
                $summaryItems[] = [
                    'label' => $label,
                    'value' => $item['value'] ?? '',
                ];
            }

            $columns = [];
            if (!empty($rows) && is_array($rows[0])) {
                $keys = array_keys($rows[0]);
                foreach ($keys as $key) {
                    $label = format_report_label($key);
                    $columns[] = ['key' => $key, 'label' => $label ?: (string)$key];
                }
            }

            $logoDataUri = get_image_data_uri('public/logo.png');
            if ($logoDataUri === '') {
                $logoDataUri = get_image_data_uri('public/EduTrack_Logo.png');
            }

            if ($reportType === 'studentGrade' && strtolower((string)($input['studentGradeScope'] ?? '')) === 'individual') {
                $studentInfo = is_array($input['studentGradeStudent'] ?? null) ? $input['studentGradeStudent'] : [];
                $period = $this->db->table('academic_periods')->where('status', 'active')->get();
                if (!$period) {
                    $period = $this->db->table('academic_periods')->order_by('id', 'DESC')->get();
                }

                $html = $this->build_individual_student_grade_report_card_html([
                    'student' => $studentInfo,
                    'rows' => $rows,
                    'schoolYear' => $period['school_year'] ?? '',
                    'logoDataUri' => $logoDataUri,
                ]);

                $studentId = preg_replace('/[^A-Za-z0-9_-]+/', '_', (string)($studentInfo['studentId'] ?? 'Student'));
                $filename = 'MCA_Student_Grade_Report_' . ($studentId ?: 'Student') . '_' . date('Y-m-d');
                $pdf = generate_pdf_from_html($html, $filename, [
                    'format' => 'Legal',
                    'margin_left' => 12,
                    'margin_right' => 12,
                    'margin_top' => 12,
                    'margin_bottom' => 12,
                ]);

                output_pdf_to_browser($pdf, $filename, true);
                return;
            }

            $html = build_admin_report_html([
                'reportTitle' => $reportTitle,
                'reportTypeLabel' => $reportTypeLabel,
                'generatedBy' => $generatedBy,
                'generatedAt' => $generatedAt,
                'recordCount' => $recordCount,
                'summary' => $summaryItems,
                'columns' => $columns,
                'rows' => $rows,
                'logoDataUri' => $logoDataUri,
                'footerText' => 'MCA Portal Administrative Reports',
            ]);

            $safeType = preg_replace('/[^A-Za-z0-9]+/', '_', $reportType ?: 'Report');
            $filename = 'MCA_' . strtoupper($safeType) . '_Report_' . date('Y-m-d');

            $pdf = generate_pdf_from_html($html, $filename, [
                'format' => 'Legal',
                'margin_left' => 15,
                'margin_right' => 15,
                'margin_top' => 15,
                'margin_bottom' => 15,
            ]);

            output_pdf_to_browser($pdf, $filename, true);

        } catch (Exception $e) {
            api_set_json_headers();
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Error generating admin report PDF: ' . $e->getMessage()
            ]);
        }
    }

    private function build_individual_student_grade_report_card_html($payload)
    {
        $student = is_array($payload['student'] ?? null) ? $payload['student'] : [];
        $rows = is_array($payload['rows'] ?? null) ? $payload['rows'] : [];
        $schoolYear = (string)($payload['schoolYear'] ?? '');
        $logoDataUri = (string)($payload['logoDataUri'] ?? '');
        $esc = function ($value) {
            return htmlspecialchars((string)($value ?? ''), ENT_QUOTES, 'UTF-8');
        };
        $gradeDisplay = function ($value) {
            if ($value === null || $value === '' || $value === '-') return '-';
            return is_numeric($value) ? rtrim(rtrim(number_format((float)$value, 2, '.', ''), '0'), '.') : (string)$value;
        };

        $subjectRows = [];
        $finalGrades = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $available = [];
            foreach (['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'] as $quarterKey) {
                if (isset($row[$quarterKey]) && $row[$quarterKey] !== '-' && is_numeric($row[$quarterKey])) {
                    $available[] = (float)$row[$quarterKey];
                }
            }
            $final = is_numeric($row['Final Grade'] ?? null)
                ? (float)$row['Final Grade']
                : (!empty($available) ? array_sum($available) / count($available) : null);
            if ($final !== null) $finalGrades[] = $final;
            $subjectRows[] = [
                'subject' => $row['Subject'] ?? $row['Subject Code'] ?? '-',
                'q1' => $row['1st Quarter'] ?? '-',
                'q2' => $row['2nd Quarter'] ?? '-',
                'q3' => $row['3rd Quarter'] ?? '-',
                'q4' => $row['4th Quarter'] ?? '-',
                'final' => $final,
                'remarks' => $final !== null ? ($final >= 75 ? 'PASSED' : 'FAILED') : '-',
            ];
        }

        $generalAverage = !empty($finalGrades) ? array_sum($finalGrades) / count($finalGrades) : null;
        $generalRemarks = $generalAverage !== null ? ($generalAverage >= 75 ? 'PASSED' : 'FAILED') : '-';

        ob_start();
        ?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: "Times New Roman", serif; color: #000; font-size: 11px; }
        .header { border-bottom: 2px solid #1f2a44; padding-bottom: 10px; margin-bottom: 10px; }
        .header-table { width: 100%; border-collapse: collapse; }
        .logo-cell { width: 20%; vertical-align: middle; }
        .logo { max-height: 60px; width: auto; display: inline-block; }
        .school-name { text-align: center; font-size: 14px; font-weight: bold; letter-spacing: 0.5px; }
        .school-sub { text-align: center; font-size: 11px; color: #444; }
        h1 { text-align: center; font-size: 18px; font-weight: bold; margin: 14px 0 6px; letter-spacing: .5px; }
        .divider { border-top: 1px solid #1f2a44; margin: 10px 0; }
        .info { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .info td { padding: 4px 6px; vertical-align: bottom; }
        .line { border-bottom: 1px solid #000; min-height: 14px; display: inline-block; width: 100%; }
        .section-title { text-align: center; font-weight: bold; margin: 10px 0 5px; font-size: 12px; }
        table.grades, table.scale { width: 100%; border-collapse: collapse; }
        table.grades th, table.grades td, table.scale th, table.scale td { border: 1px solid #000; padding: 5px 6px; }
        table.grades th, table.scale th { font-weight: bold; text-align: center; }
        table.grades td { text-align: center; }
        table.grades td.area { text-align: left; }
        .average-row td { font-weight: bold; }
        .no-grades { border: 1px solid #000; padding: 12px; text-align: center; margin-bottom: 12px; }
        .scale { margin-top: 8px; font-size: 10px; }
        .footer { margin-top: 16px; border-top: 1px solid #000; padding-top: 6px; text-align: center; font-size: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <table class="header-table">
            <tr>
                <td class="logo-cell">
                    <?php if ($logoDataUri !== ''): ?>
                        <img src="<?= $esc($logoDataUri) ?>" alt="MCA Logo" class="logo" />
                    <?php else: ?>
                        <div style="font-weight:bold; font-size:12px;">MCA</div>
                    <?php endif; ?>
                </td>
                <td>
                    <div class="school-name">Maranatha Christian Academy Foundation</div>
                    <div class="school-sub">Calapan City, Inc.</div>
                    <div class="school-sub">Official Administrative Report</div>
                </td>
                <td class="logo-cell"></td>
            </tr>
        </table>
    </div>

    <h1>STUDENT GRADE REPORT</h1>
    <div class="divider"></div>

    <table class="info">
        <tr><td style="width: 12%;">Name:</td><td colspan="5"><span class="line"><?= $esc($student['name'] ?? '') ?></span></td></tr>
        <tr>
            <td>Age:</td><td style="width: 18%;"><span class="line">&nbsp;</span></td>
            <td style="width: 10%;">Sex:</td><td style="width: 18%;"><span class="line"><?= $esc($student['gender'] ?? '') ?></span></td>
            <td style="width: 10%;">LRN:</td><td><span class="line">&nbsp;</span></td>
        </tr>
        <tr>
            <td>Grade:</td><td><span class="line"><?= $esc($student['yearLevel'] ?? '') ?></span></td>
            <td>Section:</td><td colspan="3"><span class="line"><?= $esc($student['sectionName'] ?? '') ?></span></td>
        </tr>
        <tr><td>School Year:</td><td colspan="5"><span class="line"><?= $esc($schoolYear) ?></span></td></tr>
    </table>

    <div class="section-title">LEARNING PROGRESS AND ACHIEVEMENT</div>
    <?php if (empty($subjectRows)): ?>
        <div class="no-grades">No submitted grades available for this student.</div>
    <?php else: ?>
        <table class="grades">
            <thead>
                <tr>
                    <th style="width: 34%;">Learning Areas</th>
                    <th>Quarter 1</th>
                    <th>Quarter 2</th>
                    <th>Quarter 3</th>
                    <th>Quarter 4</th>
                    <th>Final Grade</th>
                    <th>Remarks</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($subjectRows as $row): ?>
                    <tr>
                        <td class="area"><?= $esc($row['subject']) ?></td>
                        <td><?= $esc($gradeDisplay($row['q1'])) ?></td>
                        <td><?= $esc($gradeDisplay($row['q2'])) ?></td>
                        <td><?= $esc($gradeDisplay($row['q3'])) ?></td>
                        <td><?= $esc($gradeDisplay($row['q4'])) ?></td>
                        <td><?= $esc($gradeDisplay($row['final'])) ?></td>
                        <td><?= $esc($row['remarks']) ?></td>
                    </tr>
                <?php endforeach; ?>
                <tr class="average-row">
                    <td class="area">General Average</td>
                    <td></td><td></td><td></td><td></td>
                    <td><?= $esc($gradeDisplay($generalAverage)) ?></td>
                    <td><?= $esc($generalRemarks) ?></td>
                </tr>
            </tbody>
        </table>
    <?php endif; ?>

    <div class="section-title">GRADING SCALE</div>
    <table class="scale">
        <thead><tr><th>Description</th><th>Grading Scale</th><th>Remarks</th></tr></thead>
        <tbody>
            <tr><td>Outstanding</td><td style="text-align:center;">90-100</td><td style="text-align:center;">Passed</td></tr>
            <tr><td>Very Satisfactory</td><td style="text-align:center;">85-89</td><td style="text-align:center;">Passed</td></tr>
            <tr><td>Satisfactory</td><td style="text-align:center;">80-84</td><td style="text-align:center;">Passed</td></tr>
            <tr><td>Fairly Satisfactory</td><td style="text-align:center;">75-79</td><td style="text-align:center;">Passed</td></tr>
            <tr><td>Did Not Meet Expectations</td><td style="text-align:center;">Below 75</td><td style="text-align:center;">Failed</td></tr>
        </tbody>
    </table>

    <div class="footer">MCA Portal Student Grade Report<br>Generated through MCA Campus Companion</div>
</body>
</html>
        <?php
        return ob_get_clean();
    }

    /**
     * Note: PDF generation is now delegated to the pdf_helper.php
     * See generate_student_pdf() and generate_bulk_pdf_zip() functions
     */
}
