<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

function export_hybrid_class_record_excel($courseInfo, $students, $components, $weights, $filename)
{
    $filename = preg_replace('/[^A-Za-z0-9_. -]/', '', $filename);
    if (!preg_match('/\.xlsx$/i', $filename)) {
        $filename .= '.xlsx';
    }

    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Class Record');

    $courseName = $courseInfo['course_name'] ?? 'N/A';
    $courseCode = $courseInfo['course_code'] ?? '';
    $teacherName = $courseInfo['teacher_name'] ?? 'N/A';
    $sectionName = $courseInfo['section_name'] ?? 'N/A';
    $courseLevel = $courseInfo['course_level'] ?? '';
    $periodInfo = $courseInfo['period_info'] ?? '';

    $currentRow = 1;
    $sheet->setCellValue("A{$currentRow}", trim($courseCode . ' - ' . $courseName, ' -'));
    $sheet->mergeCells("A{$currentRow}:H{$currentRow}");
    $sheet->getStyle("A{$currentRow}")->applyFromArray([
        'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1F4788']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
    ]);
    $currentRow++;

    $levelText = $courseLevel ? " | Grade Level: {$courseLevel}" : '';
    $sheet->setCellValue("A{$currentRow}", "Teacher: {$teacherName} | Section: {$sectionName}{$levelText}");
    $sheet->mergeCells("A{$currentRow}:H{$currentRow}");
    $sheet->getStyle("A{$currentRow}")->applyFromArray([
        'font' => ['bold' => true, 'size' => 12],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
    ]);
    $currentRow++;

    if ($periodInfo) {
        $sheet->setCellValue("A{$currentRow}", $periodInfo);
        $sheet->mergeCells("A{$currentRow}:H{$currentRow}");
        $sheet->getStyle("A{$currentRow}")->applyFromArray([
            'font' => ['italic' => true, 'size' => 11],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        $currentRow++;
    }

    $sheet->setCellValue("A{$currentRow}", 'Total Students: ' . count($students));
    $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true);
    $currentRow++;
    $sheet->setCellValue("A{$currentRow}", 'Legend: HPS = Highest Possible Score, PS = Percentage Score, WS = Weighted Score');
    $sheet->getStyle("A{$currentRow}")->getFont()->setItalic(true)->setSize(9);
    $currentRow += 2;

    $componentDefs = [
        ['key' => 'written', 'title' => 'Written Works', 'weight_key' => 'ww', 'color' => 'D9EAF7'],
        ['key' => 'performance', 'title' => 'Performance Tasks', 'weight_key' => 'pt', 'color' => 'E2F0D9'],
        ['key' => 'quarterly', 'title' => 'Quarterly Assessment', 'weight_key' => 'qa', 'color' => 'FFF2CC'],
    ];

    $groupRow = $currentRow;
    $headerRow = $currentRow + 1;
    $col = 1;
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'No');
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Student ID');
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, "Learner's Name");
    $sheet->mergeCells("A{$groupRow}:C{$groupRow}");
    $sheet->setCellValue("A{$groupRow}", 'Student Info');

    $componentMeta = [];
    foreach ($componentDefs as $def) {
        $items = $components[$def['key']] ?? [];
        $startCol = $col;
        foreach ($items as $item) {
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, $item['title']);
        }
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Total');
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'PS');
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'WS');
        $endCol = $col - 1;
        $startLetter = Coordinate::stringFromColumnIndex($startCol);
        $endLetter = Coordinate::stringFromColumnIndex($endCol);
        $sheet->mergeCells("{$startLetter}{$groupRow}:{$endLetter}{$groupRow}");
        $sheet->setCellValue("{$startLetter}{$groupRow}", $def['title'] . ' (' . ($weights[$def['weight_key']] ?? 0) . '%)');
        $sheet->getStyle("{$startLetter}{$groupRow}:{$endLetter}{$headerRow}")->getFill()
            ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB($def['color']);
        $componentMeta[$def['key']] = ['items' => $items, 'start' => $startCol, 'end' => $endCol, 'weight_key' => $def['weight_key']];
    }

    $initialCol = $col;
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Initial');
    $finalCol = $col;
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Final');
    $lastCol = $col - 1;
    $lastColLetter = Coordinate::stringFromColumnIndex($lastCol);
    $initialLetter = Coordinate::stringFromColumnIndex($initialCol);
    $finalLetter = Coordinate::stringFromColumnIndex($finalCol);
    $sheet->mergeCells("{$initialLetter}{$groupRow}:{$finalLetter}{$groupRow}");
    $sheet->setCellValue("{$initialLetter}{$groupRow}", 'Quarter Grade');

    $sheet->getStyle("A{$groupRow}:{$lastColLetter}{$headerRow}")->applyFromArray([
        'font' => ['bold' => true],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
    ]);

    $currentRow = $headerRow + 1;
    $hpsRow = $currentRow;
    $sheet->setCellValue("B{$hpsRow}", 'HPS ->');
    foreach ($componentMeta as $key => $meta) {
        $items = $meta['items'];
        $hps = array_sum(array_map(fn($i) => (float)($i['max_score'] ?? 0), $items));
        $col = $meta['start'];
        foreach ($items as $item) {
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $hpsRow, (float)($item['max_score'] ?? 0));
        }
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $hpsRow, round($hps, 2));
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $hpsRow, $hps > 0 ? 100 : 0);
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $hpsRow, (float)($weights[$meta['weight_key']] ?? 0));
    }
    $totalWeight = (float)($weights['ww'] ?? 0) + (float)($weights['pt'] ?? 0) + (float)($weights['qa'] ?? 0);
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($initialCol) . $hpsRow, round($totalWeight, 2));
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($finalCol) . $hpsRow, round($totalWeight));

    $sheet->getStyle("A{$hpsRow}:{$lastColLetter}{$hpsRow}")->applyFromArray([
        'font' => ['bold' => true, 'italic' => true],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E7E6E6']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
    ]);

    $currentRow++;
    $dataStartRow = $currentRow;
    $studentNo = 1;
    $previousGenderGroup = null;
    $genderGroupRows = [];
    foreach ($students as $student) {
        $genderGroup = $student['gender_group'] ?? 'UNSPECIFIED';
        if ($genderGroup !== $previousGenderGroup) {
            $genderGroupRows[] = $currentRow;
            $sheet->setCellValue("C{$currentRow}", $genderGroup);
            $sheet->mergeCells("C{$currentRow}:{$lastColLetter}{$currentRow}");
            $sheet->getStyle("A{$currentRow}:{$lastColLetter}{$currentRow}")->applyFromArray([
                'font' => ['bold' => true],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F2F2F2']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
            ]);
            $previousGenderGroup = $genderGroup;
            $currentRow++;
        }

        $col = 1;
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $studentNo++);
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $student['student_id'] ?? '');
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $student['display_name'] ?? '');

        foreach ($componentMeta as $key => $meta) {
            foreach ($meta['items'] as $item) {
                $score = $student['scores'][(int)$item['id']] ?? 0;
                $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $score);
            }
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $student['metrics'][$key . '_total'] ?? 0);
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $student['metrics'][$key . '_ps'] ?? 0);
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $student['metrics'][$key . '_ws'] ?? 0);
        }
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $student['metrics']['initial'] ?? 0);
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $student['metrics']['final'] ?? 0);
        $currentRow++;
    }

    $dataEndRow = max($dataStartRow, $currentRow - 1);
    $sheet->getStyle("A{$dataStartRow}:{$lastColLetter}{$dataEndRow}")->applyFromArray([
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
    ]);

    for ($row = $dataStartRow; $row <= $dataEndRow; $row++) {
        if (in_array($row, $genderGroupRows, true)) {
            continue;
        }
        $sheet->getStyle("C{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
        for ($col = 4; $col <= $lastCol; $col++) {
            $sheet->getStyle(Coordinate::stringFromColumnIndex($col) . $row)->getNumberFormat()->setFormatCode('0.00');
        }
    }

    $sheet->getColumnDimension('A')->setWidth(6);
    $sheet->getColumnDimension('B')->setWidth(18);
    $sheet->getColumnDimension('C')->setWidth(35);
    for ($col = 4; $col <= $lastCol; $col++) {
        $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setWidth(12);
    }
    $sheet->freezePane('D' . $dataStartRow);

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;
}

/**
 * Export class record to Excel file with styling and formulas
 * 
 * @param array $courseInfo Course information
 * @param array $students Array of students (raw data without calculated grades)
 * @param array $activities Array of activities categorized by type
 * @param array $grades Array of grades [student_id_activity_id => grade]
 * @param string $filename Output filename
 * @return void Outputs Excel file directly to browser
 */
function export_class_record_excel($courseInfo, $students, $activities, $grades, $filename)
{
    // Sanitize filename
    $filename = preg_replace('/[^A-Za-z0-9_. -]/', '', $filename);
    if (!preg_match('/\.xlsx$/i', $filename)) {
        $filename .= '.xlsx';
    }
    
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Class Record');
    
    // Course information header
    $courseName = $courseInfo['course_name'] ?? 'N/A';
    $courseCode = $courseInfo['course_code'] ?? '';
    $teacherName = $courseInfo['teacher_name'] ?? 'N/A';
    $sectionName = $courseInfo['section_name'] ?? 'N/A';
    $courseLevel = $courseInfo['course_level'] ?? '';
    $periodInfo = $courseInfo['period_info'] ?? '';
    
    $currentRow = 1;
    
    // Title row
    $sheet->setCellValue("A{$currentRow}", $courseCode . ' - ' . $courseName);
    $sheet->mergeCells("A{$currentRow}:F{$currentRow}");
    $sheet->getStyle("A{$currentRow}")->applyFromArray([
        'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1F4788']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
    ]);
    $currentRow++;
    
    // Teacher and Section
    $levelText = $courseLevel ? " | Level: {$courseLevel}" : '';
    $sheet->setCellValue("A{$currentRow}", "Teacher: {$teacherName} | Section: {$sectionName}{$levelText}");
    $sheet->mergeCells("A{$currentRow}:F{$currentRow}");
    $sheet->getStyle("A{$currentRow}")->applyFromArray([
        'font' => ['bold' => true, 'size' => 12],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
    ]);
    $currentRow++;
    
    // Period info
    if ($periodInfo) {
        $sheet->setCellValue("A{$currentRow}", $periodInfo);
        $sheet->mergeCells("A{$currentRow}:F{$currentRow}");
        $sheet->getStyle("A{$currentRow}")->applyFromArray([
            'font' => ['italic' => true, 'size' => 11],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        $currentRow++;
    }
    
    // Total students
    $sheet->setCellValue("A{$currentRow}", 'Total Students: ' . count($students));
    $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true);
    $currentRow++;
    
    // Legend
    $sheet->setCellValue("A{$currentRow}", 'Legend: HPS = Highest Possible Score, PS = Percentage Score, WS = Weighted Score');
    $sheet->getStyle("A{$currentRow}")->getFont()->setItalic(true)->setSize(9);
    $currentRow++;
    
    // Empty row
    $currentRow++;
    
    // Build column headers
    $written = $activities['written'] ?? [];
    $performance = $activities['performance'] ?? [];
    $exam = $activities['exam'] ?? [];
    
    $headerRow = $currentRow;
    $col = 1;
    
    // Basic columns
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'No');
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Student ID');
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Name');
    
    // Written Works
    $writtenStartCol = $col;
    foreach ($written as $idx => $act) {
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'W' . ($idx + 1));
    }
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Total');
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'PS');
    $writtenWSCol = $col;
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'WS');
    
    // Performance Tasks
    $performanceStartCol = $col;
    foreach ($performance as $idx => $act) {
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'P' . ($idx + 1));
    }
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Total');
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'PS');
    $performanceWSCol = $col;
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'WS');
    
    // Exam
    $examStartCol = $col;
    $examWSCol = 0;
    if (!empty($exam)) {
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Exam');
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'PS');
        $examWSCol = $col;
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'WS');
    }
    
    // Final grades
    $initialGradeCol = $col;
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Initial');
    $finalGradeCol = $col;
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $headerRow, 'Final');
    
    // Style header row
    $lastCol = $col - 1;
    $lastColLetter = Coordinate::stringFromColumnIndex($lastCol);
    $sheet->getStyle("A{$headerRow}:{$lastColLetter}{$headerRow}")->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '4472C4']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
    ]);
    
    // Calculate max scores
    $writtenMax = array_sum(array_column($written, 'max_score'));
    $performanceMax = array_sum(array_column($performance, 'max_score'));
    $examMax = array_sum(array_column($exam, 'max_score'));
    
    // Add max score row
    $currentRow++;
    $maxScoreRow = $currentRow;
    $sheet->setCellValue("A{$maxScoreRow}", '');
    $sheet->setCellValue("B{$maxScoreRow}", 'HPS →');
    $sheet->setCellValue("C{$maxScoreRow}", '');
    
    $col = $writtenStartCol;
    foreach ($written as $act) {
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $maxScoreRow, $act['max_score']);
    }
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $maxScoreRow, $writtenMax); // Total
    $col += 2; // Skip PS and WS
    
    foreach ($performance as $act) {
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $maxScoreRow, $act['max_score']);
    }
    $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $maxScoreRow, $performanceMax); // Total
    $col += 2; // Skip PS and WS
    
    if (!empty($exam)) {
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $maxScoreRow, $examMax);
    }
    
    // Style max score row
    $sheet->getStyle("A{$maxScoreRow}:{$lastColLetter}{$maxScoreRow}")->applyFromArray([
        'font' => ['bold' => true, 'italic' => true],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E7E6E6']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
    ]);
    
    // Student data rows
    $currentRow++;
    $dataStartRow = $currentRow;
    
    foreach ($students as $idx => $student) {
        $col = 1;
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $idx + 1);
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $student['student_id']);
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')));
        
        // Written Works with formulas
        $writtenTotalCol = $col + count($written);
        $writtenPSCol = $writtenTotalCol + 1;
        
        foreach ($written as $act) {
            $key = $student['id'] . '_' . $act['id'];
            $grade = $grades[$key] ?? 0;
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $grade);
        }
        
        // Written Total (SUM formula)
        $startCell = Coordinate::stringFromColumnIndex($writtenStartCol) . $currentRow;
        $endCell = Coordinate::stringFromColumnIndex($writtenStartCol + count($written) - 1) . $currentRow;
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "=SUM({$startCell}:{$endCell})");
        
        // Written PS (Percentage)
        $totalCell = Coordinate::stringFromColumnIndex($writtenTotalCol) . $currentRow;
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "=IF({$writtenMax}>0, ({$totalCell}/{$writtenMax})*100, 0)");
        
        // Written WS (Weighted Score - 30%)
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "=IF({$writtenMax}>0, ({$totalCell}/{$writtenMax})*30, 0)");
        
        // Performance Tasks with formulas
        $performanceTotalCol = $col + count($performance);
        $performancePSCol = $performanceTotalCol + 1;
        
        foreach ($performance as $act) {
            $key = $student['id'] . '_' . $act['id'];
            $grade = $grades[$key] ?? 0;
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $grade);
        }
        
        // Performance Total
        $startCell = Coordinate::stringFromColumnIndex($performanceStartCol) . $currentRow;
        $endCell = Coordinate::stringFromColumnIndex($performanceStartCol + count($performance) - 1) . $currentRow;
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "=SUM({$startCell}:{$endCell})");
        
        // Performance PS
        $totalCell = Coordinate::stringFromColumnIndex($performanceTotalCol) . $currentRow;
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "=IF({$performanceMax}>0, ({$totalCell}/{$performanceMax})*100, 0)");
        
        // Performance WS (40%)
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "=IF({$performanceMax}>0, ({$totalCell}/{$performanceMax})*40, 0)");
        
        // Exam
        if (!empty($exam)) {
            $examCol = $col;
            $examPSCol = $col + 1;
            
            $examTotal = 0;
            foreach ($exam as $act) {
                $key = $student['id'] . '_' . $act['id'];
                $examTotal += $grades[$key] ?? 0;
            }
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $examTotal);
            
            // Exam PS
            $examCell = Coordinate::stringFromColumnIndex($examCol) . $currentRow;
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "=IF({$examMax}>0, ({$examCell}/{$examMax})*100, 0)");
            
            // Exam WS (30%)
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "=IF({$examMax}>0, ({$examCell}/{$examMax})*30, 0)");
        }
        
        // Initial Grade (Sum of weighted scores)
        $writtenWSCell = Coordinate::stringFromColumnIndex($writtenWSCol) . $currentRow;
        $performanceWSCell = Coordinate::stringFromColumnIndex($performanceWSCol) . $currentRow;
        
        if (!empty($exam)) {
            $examWSCell = Coordinate::stringFromColumnIndex($examWSCol) . $currentRow;
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "={$writtenWSCell}+{$performanceWSCell}+{$examWSCell}");
        } else {
            $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, "={$writtenWSCell}+{$performanceWSCell}");
        }
        
        // Final Grade (Transmuted) using nested IF
        $initialCell = Coordinate::stringFromColumnIndex($initialGradeCol) . $currentRow;
        $transmuteFormula = "=IF({$initialCell}>=97, \"1.00\", " .
                           "IF({$initialCell}>=94, \"1.25\", " .
                           "IF({$initialCell}>=91, \"1.50\", " .
                           "IF({$initialCell}>=88, \"1.75\", " .
                           "IF({$initialCell}>=85, \"2.00\", " .
                           "IF({$initialCell}>=82, \"2.25\", " .
                           "IF({$initialCell}>=79, \"2.50\", " .
                           "IF({$initialCell}>=76, \"2.75\", " .
                           "IF({$initialCell}>=75, \"3.00\", \"5.00\")))))))))";
        $sheet->setCellValue(Coordinate::stringFromColumnIndex($col++) . $currentRow, $transmuteFormula);
        
        $currentRow++;
    }
    
    $dataEndRow = $currentRow - 1;
    
    // Style data rows
    $sheet->getStyle("A{$dataStartRow}:{$lastColLetter}{$dataEndRow}")->applyFromArray([
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
    ]);
    
    // Zebra striping for data rows
    for ($row = $dataStartRow; $row <= $dataEndRow; $row++) {
        if (($row - $dataStartRow) % 2 == 1) {
            $sheet->getStyle("A{$row}:{$lastColLetter}{$row}")->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setRGB('F2F2F2');
        }
    }
    
    // Number formatting for calculated columns
    for ($row = $dataStartRow; $row <= $dataEndRow; $row++) {
        // PS columns (percentage with 2 decimals)
        $sheet->getStyle(Coordinate::stringFromColumnIndex($writtenPSCol) . $row)->getNumberFormat()->setFormatCode('0.00');
        $sheet->getStyle(Coordinate::stringFromColumnIndex($performancePSCol) . $row)->getNumberFormat()->setFormatCode('0.00');
        
        // WS columns (2 decimals)
        $sheet->getStyle(Coordinate::stringFromColumnIndex($writtenWSCol) . $row)->getNumberFormat()->setFormatCode('0.00');
        $sheet->getStyle(Coordinate::stringFromColumnIndex($performanceWSCol) . $row)->getNumberFormat()->setFormatCode('0.00');
        
        // Initial Grade (2 decimals)
        $sheet->getStyle(Coordinate::stringFromColumnIndex($initialGradeCol) . $row)->getNumberFormat()->setFormatCode('0.00');
        
        if (!empty($exam) && $examWSCol > 0) {
            $sheet->getStyle(Coordinate::stringFromColumnIndex($examWSCol - 1) . $row)->getNumberFormat()->setFormatCode('0.00'); // Exam PS
            $sheet->getStyle(Coordinate::stringFromColumnIndex($examWSCol) . $row)->getNumberFormat()->setFormatCode('0.00'); // Exam WS
        }
    }
    
    // Auto-size columns
    for ($col = 1; $col <= $lastCol; $col++) {
        $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setAutoSize(true);
    }
    
    // Set minimum widths for readability
    $sheet->getColumnDimension('A')->setWidth(5);
    $sheet->getColumnDimension('B')->setWidth(15);
    $sheet->getColumnDimension('C')->setWidth(25);
    
    // Freeze panes (freeze header and name columns)
    $sheet->freezePane('D' . $dataStartRow);
    
    // Create writer and output
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    
    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;
}
