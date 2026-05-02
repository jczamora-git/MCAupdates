import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Award, Save, Upload, Download, FileSpreadsheet, Edit3, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_ENDPOINTS, apiGet, apiPost, apiPut } from "@/lib/api";

const GradeInput = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !["teacher", "admin"].includes(String(user?.role ?? ''))) {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  // selections / state (declared before effects)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);

  const [academicPeriods, setAcademicPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const [courses, setCourses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [gradingItems, setGradingItems] = useState<any[]>([]);
  const [gradingScoreMap, setGradingScoreMap] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState({ periods: false, courses: false, sections: false, students: false, activities: false, submitting: false, importing: false });

  const [courseInfo, setCourseInfo] = useState({ code: "", title: "", teacher: "", section: "" });
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submissionEnabled, setSubmissionEnabled] = useState(true);
  const [submissionControlLoading, setSubmissionControlLoading] = useState(false);
  const [submissionControlSaving, setSubmissionControlSaving] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    inserted?: number;
    updated?: number;
    errors?: string[];
  } | null>(null);

  const extractList = (res: any, keys: string[] = []): any[] => {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== "object") return [];
    for (const key of keys) {
      const value = (res as any)[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  };

  const normalizeLabel = (v: any): string => String(v ?? '').replace(/\s+/g, ' ').trim();

  const formatStudentDisplayName = (student: any): string => {
    const lastName = normalizeLabel(student?.last_name ?? student?.lastname ?? '');
    const firstName = normalizeLabel(student?.first_name ?? student?.firstname ?? '');
    const middleRaw = normalizeLabel(student?.middle_name ?? student?.middlename ?? student?.middle_initial ?? '');
    const middleInitial = middleRaw ? `${middleRaw.charAt(0).toUpperCase()}.` : '';

    if (lastName || firstName) {
      const base = [lastName, firstName].filter(Boolean).join(', ');
      return `${base}${middleInitial ? ` ${middleInitial}` : ''}`.trim();
    }

    return normalizeLabel(student?.name ?? '');
  };

  const getGenderRank = (student: any): number => {
    const gender = normalizeLabel(student?.gender ?? student?.sex ?? '').toLowerCase();
    if (['male', 'm', 'boy', 'man'].includes(gender)) return 0;
    if (['female', 'f', 'girl', 'woman'].includes(gender)) return 1;
    return 2;
  };

  const getGenderGroupLabel = (rank: number): string => {
    if (rank === 0) return 'Male';
    if (rank === 1) return 'Female';
    return 'Unspecified';
  };

  const mapStudentsForDisplay = (list: any[]) => {
    const mapped = (Array.isArray(list) ? list : []).map((st: any) => {
      const lastName = normalizeLabel(st?.last_name ?? st?.lastname ?? '');
      const firstName = normalizeLabel(st?.first_name ?? st?.firstname ?? '');
      const middleRaw = normalizeLabel(st?.middle_name ?? st?.middlename ?? st?.middle_initial ?? '');
      const middleInitial = middleRaw ? middleRaw.charAt(0).toUpperCase() : '';

      return {
        id: st.id ?? st.user_id ?? null,
        student_code: st.student_id ?? null,
        name: formatStudentDisplayName(st),
        email: st.email ?? st.user_email ?? '',
        status: st.status ?? 'active',
        grades: st.grades ?? st.activity_grades ?? [],
        _sort_last_name: lastName,
        _sort_first_name: firstName,
        _sort_middle_initial: middleInitial,
        _gender_rank: getGenderRank(st),
      };
    });

    return mapped.sort((a: any, b: any) => {
      const genderDiff = Number(a._gender_rank ?? 2) - Number(b._gender_rank ?? 2);
      if (genderDiff !== 0) return genderDiff;

      const lastNameDiff = String(a._sort_last_name ?? '').localeCompare(String(b._sort_last_name ?? ''), undefined, { sensitivity: 'base' });
      if (lastNameDiff !== 0) return lastNameDiff;

      const firstNameDiff = String(a._sort_first_name ?? '').localeCompare(String(b._sort_first_name ?? ''), undefined, { sensitivity: 'base' });
      if (firstNameDiff !== 0) return firstNameDiff;

      const middleDiff = String(a._sort_middle_initial ?? '').localeCompare(String(b._sort_middle_initial ?? ''), undefined, { sensitivity: 'base' });
      if (middleDiff !== 0) return middleDiff;

      return String(a.student_code ?? a.id ?? '').localeCompare(String(b.student_code ?? b.id ?? ''), undefined, { sensitivity: 'base' });
    });
  };

  const buildScoreMap = (scoreRows: any[]) => {
    const map: Record<string, Record<string, number>> = {};
    (scoreRows || []).forEach((row: any) => {
      const itemId = String(row.item_id ?? row.grading_input_item_id ?? '');
      const studentId = String(row.student_id ?? '');
      const score = Number(row.score ?? 0);
      if (!itemId || !studentId) return;
      if (!map[itemId]) map[itemId] = {};
      map[itemId][studentId] = Number.isFinite(score) ? score : 0;
    });
    return map;
  };

  const debugLabelMeta = (value: any) => {
    const raw = String(value ?? '');
    const normalized = normalizeLabel(raw);
    const leading = (raw.match(/^\s+/)?.[0].length ?? 0);
    const trailing = (raw.match(/\s+$/)?.[0].length ?? 0);
    return {
      raw,
      normalized,
      leadingSpaces: leading,
      trailingSpaces: trailing,
      rawLength: raw.length,
      codePoints: Array.from(raw).map((ch) => ch.codePointAt(0)),
    };
  };

  const logSelectChange = (kind: 'course' | 'section', value: string) => {
    if (kind === 'course') {
      const matched = courses.find((c: any) => String(c.id) === String(value));
      console.groupCollapsed('[GradeInput] onChange Course Select');
      console.log('selected value:', value);
      console.log('matched option:', matched ?? null);
      console.log('code meta:', debugLabelMeta(matched?.code));
      console.log('title meta:', debugLabelMeta(matched?.title));
      console.log('render label:', `${normalizeLabel(matched?.code)} - ${normalizeLabel(matched?.title)}`);
      console.groupEnd();
      return;
    }

    const matchedSection = sections.find((s: any) => String(s.id) === String(value));
    console.groupCollapsed('[GradeInput] onChange Section Select');
    console.log('selected value:', value);
    console.log('matched option:', matchedSection ?? null);
    console.log('name meta:', debugLabelMeta(matchedSection?.name));
    console.log('render label:', normalizeLabel(matchedSection?.name));
    console.groupEnd();
  };

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DepEd weight group derived from course_code prefix (no DB column needed)
  const getWeightGroup = (courseCode: string): 'languages' | 'science_math' | 'mapeh_epp' => {
    const prefix = (courseCode || '').split('-')[0].toUpperCase();
    if (['MATH', 'SCI'].includes(prefix)) return 'science_math';
    if (['MAPEH', 'EPP'].includes(prefix)) return 'mapeh_epp';
    return 'languages'; // ENGL, FILI, LANG, READ, GMRC, MAKA, AP, etc.
  };

  // DepEd component weights per group (WW = Written Work, PT = Performance Tasks, QA = Quarterly Assessment)
  const getWeights = (group: 'languages' | 'science_math' | 'mapeh_epp') => {
    if (group === 'science_math') return { ww: 40, pt: 40, qa: 20 };
    if (group === 'mapeh_epp')    return { ww: 20, pt: 60, qa: 20 };
    return { ww: 30, pt: 50, qa: 20 }; // languages (default)
  };

  // Helper to categorize activities by DepEd grading component
  const categorizeActivities = (activities: any[]) => {
    const written: any[] = [];     // quiz, worksheet, assignment, other
    const performance: any[] = []; // project, laboratory, performance, art, storytime, recitation, participation
    const quarterly: any[] = [];   // exam (Quarterly Assessment — 1 per quarter)

    activities.forEach(act => {
      const type = (act.type || '').toLowerCase().trim();
      if (['quiz', 'worksheet', 'assignment', 'other'].includes(type)) {
        written.push(act);
      } else if (['project', 'laboratory', 'performance', 'art', 'storytime', 'recitation', 'participation'].includes(type)) {
        performance.push(act);
      } else if (type === 'exam') {
        quarterly.push(act);
      } else {
        console.warn(`[categorizeActivities] Unrecognized activity type "${act.type}" (id: ${act.id}, title: "${act.title}") → defaulting to Written Work`);
        written.push(act);
      }
    });

    return { written, performance, quarterly };
  };

  const buildComponentItems = (acts: any[], items: any[]) => {
    if (Array.isArray(items) && items.length > 0) {
      const sorted = [...items].sort((a, b) => {
        const ao = Number(a.display_order ?? 0);
        const bo = Number(b.display_order ?? 0);
        if (ao !== bo) return ao - bo;
        return Number(a.id ?? 0) - Number(b.id ?? 0);
      });

      const mergedSourceItemIds = new Set<string>();
      sorted.forEach((item: any) => {
        if (item.source_type === 'merged' && Array.isArray(item.merge_sources)) {
          item.merge_sources.forEach((src: any) => {
            if (src.source_item_id) mergedSourceItemIds.add(String(src.source_item_id));
          });
        }
      });

      const mapped = sorted.map((item: any) => {
        let activityType = null;
        if (item.source_type === 'activity' && item.source_activity_id) {
          const activity = acts.find((a: any) => Number(a.id) === Number(item.source_activity_id));
          activityType = activity ? String(activity.type ?? '').toLowerCase() : null;
        }

        const isHidden = !!item.is_hidden || mergedSourceItemIds.has(String(item.id));
        return {
          id: String(item.id),
          title: String(item.title ?? ''),
          max_score: Number(item.max_score ?? 0),
          component: String(item.component ?? 'written'),
          source_type: String(item.source_type ?? 'manual'),
          source_activity_id: item.source_activity_id ? Number(item.source_activity_id) : null,
          activity_type: activityType,
          is_hidden: isHidden,
        };
      });

      return {
        written: mapped.filter((i: any) => i.component === 'written' && !i.is_hidden),
        performance: mapped.filter((i: any) => i.component === 'performance' && !i.is_hidden),
        quarterly: mapped.filter((i: any) => i.component === 'quarterly' && !i.is_hidden),
      };
    }

    const categorized = categorizeActivities(acts || []);
    return {
      written: categorized.written,
      performance: categorized.performance,
      quarterly: categorized.quarterly,
    };
  };

  // Helper to get student grade for activity/manual/merged item
  const getStudentGrade = (studentId: string, item: any) => {
    const student = students.find(s => String(s.id) === String(studentId));
    if (!student) return null;

    if (item?.source_type === 'activity' && item?.source_activity_id) {
      const studentGrades = student.grades ?? [];
      const gradeRecord = studentGrades.find((g: any) => String(g.activity_id) === String(item.source_activity_id));
      return gradeRecord ? parseFloat(gradeRecord.grade ?? 0) : 0;
    }

    const score = gradingScoreMap[String(item?.id ?? '')]?.[String(studentId)];
    return Number.isFinite(score) ? Number(score) : 0;
  };

  // Helper to calculate weighted scores using DepEd component weights
  const calculateGrades = (studentId: string, categorized: any, weights?: { ww: number; pt: number; qa: number }) => {
    const w = weights ?? { ww: 30, pt: 50, qa: 20 };

    // Written Work
    let writtenTotal = 0, writtenMax = 0;
    categorized.written.forEach((item: any) => {
      writtenTotal += Number(getStudentGrade(studentId, item) ?? 0);
      writtenMax += parseFloat(item.max_score ?? 0);
    });
    const writtenPS = writtenMax > 0 ? (writtenTotal / writtenMax) * 100 : 0;
    const writtenWS = (writtenPS / 100) * w.ww;

    // Performance Tasks
    let performanceTotal = 0, performanceMax = 0;
    categorized.performance.forEach((item: any) => {
      performanceTotal += Number(getStudentGrade(studentId, item) ?? 0);
      performanceMax += parseFloat(item.max_score ?? 0);
    });
    const performancePS = performanceMax > 0 ? (performanceTotal / performanceMax) * 100 : 0;
    const performanceWS = (performancePS / 100) * w.pt;

    // Quarterly Assessment
    let qaTotal = 0, qaMax = 0;
    categorized.quarterly.forEach((item: any) => {
      qaTotal += Number(getStudentGrade(studentId, item) ?? 0);
      qaMax += parseFloat(item.max_score ?? 0);
    });
    const qaPS = qaMax > 0 ? (qaTotal / qaMax) * 100 : 0;
    const qaWS = (qaPS / 100) * w.qa;

    const initialGrade = writtenWS + performanceWS + qaWS;
    const finalGrade = transmute(initialGrade);

    return {
      written:     { total: writtenTotal,  max: writtenMax,  ps: writtenPS,  ws: writtenWS },
      performance: { total: performanceTotal, max: performanceMax, ps: performancePS, ws: performanceWS },
      quarterly:   { total: qaTotal, max: qaMax, ps: qaPS, ws: qaWS },
      initialGrade,
      finalGrade,
    };
  };

  // Build an empty grade row for a student when no grades exist yet
  const makeEmptyGradeRow = (s: any) => ({ id: String(s.id ?? s.student_id ?? s.user_id ?? s.id ?? ''), name: formatStudentDisplayName(s), grades: [] });

  const transmute = (initialGrade: number): number => {
    const clamped = Math.max(0, Math.min(100, Number(initialGrade || 0)));

    if (clamped >= 60) {
      return Math.min(100, 75 + Math.floor((clamped - 60) / 1.6));
    }

    return 60 + Math.floor(clamped / 4);
  };

  const handleDownloadTemplate = () => {
    alert("Download class record template - will generate Excel file with proper format");
  };

  const handleExportClassRecord = async () => {
    if (!selectedCourse || !selectedSection) {
      alert("Please select a course and section first");
      return;
    }

    try {
      // Build query parameters
      let query = `course_id=${encodeURIComponent(String(selectedCourse))}&section_id=${encodeURIComponent(String(selectedSection))}`;
      
      if (selectedPeriodId) {
        query += `&academic_period_id=${encodeURIComponent(String(selectedPeriodId))}`;
      }

      // Download using fetch with credentials
      const url = `${API_ENDPOINTS.EXPORT_CLASS_RECORD}?${query}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // Important for session cookies
      });

      if (!response.ok) {
        // Try to get error message from response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Export failed');
        }
        throw new Error(`Export failed with status ${response.status}`);
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'ClassRecord.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (error: any) {
      console.error('Export failed:', error);
      alert('Failed to export class record: ' + (error.message || 'Unknown error'));
    }
  };

  const handleExportClassRecordExcel = async () => {
    if (!selectedCourse || !selectedSection) {
      alert("Please select a course and section first");
      return;
    }

    try {
      // Build query parameters
      let query = `course_id=${encodeURIComponent(String(selectedCourse))}&section_id=${encodeURIComponent(String(selectedSection))}`;
      
      if (selectedPeriodId) {
        query += `&academic_period_id=${encodeURIComponent(String(selectedPeriodId))}`;
      }

      // Download using fetch with credentials
      const url = `${API_ENDPOINTS.EXPORT_CLASS_RECORD_EXCEL}?${query}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Export failed');
        }
        throw new Error(`Export failed with status ${response.status}`);
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'ClassRecord.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (error: any) {
      console.error('Export Excel failed:', error);
      alert('Failed to export Excel: ' + (error.message || 'Unknown error'));
    }
  };

  // Import class record from Excel file
  const handleImportClick = () => {
    if (!selectedCourse || !selectedSection) {
      alert("Please select a course and section first");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportClassRecord = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      alert('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
      event.target.value = '';
      return;
    }

    const confirmImport = window.confirm(
      `Are you sure you want to import grades from "${file.name}"?\n\nThis will update existing grades and create new ones where needed.`
    );

    if (!confirmImport) {
      event.target.value = '';
      return;
    }

    try {
      setLoading((l) => ({ ...l, importing: true }));

      const formData = new FormData();
      formData.append('file', file);
      formData.append('course_id', String(selectedCourse));
      formData.append('section_id', String(selectedSection));
      if (selectedPeriodId) {
        formData.append('academic_period_id', String(selectedPeriodId));
      }

      const response = await fetch(API_ENDPOINTS.IMPORT_CLASS_RECORD, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        let message = `Import completed successfully!\n\n`;
        message += `• Grades inserted: ${result.inserted}\n`;
        message += `• Grades updated: ${result.updated}\n`;
        message += `• Grades unchanged: ${result.skipped || 0}\n`;
        message += `• Students processed: ${result.processed_students}\n`;
        message += `• Activities mapped: ${result.total_activities || 'N/A'}`;
        
        if (result.errors && result.errors.length > 0) {
          message += `\n\nWarnings:\n${result.errors.slice(0, 5).join('\n')}`;
          if (result.errors.length > 5) {
            message += `\n... and ${result.errors.length - 5} more`;
          }
        }
        
        alert(message);

        // Refresh the data after successful import
        // Trigger a re-fetch of students with grades
        if (selectedSection && selectedCourse) {
          const course = courses.find((c) => String(c.id) === String(selectedCourse));
          const yearLevel = course?.year_level ?? null;
          
          let query = `section_id=${encodeURIComponent(String(selectedSection))}`;
          if (yearLevel) {
            query += `&year_level=${encodeURIComponent(String(yearLevel))}`;
          }
          query += `&include_grades=true`;
          
          const res = await apiGet(`${API_ENDPOINTS.STUDENTS}?${query}`);
          const list = extractList(res, ['data', 'students']);
          if (Array.isArray(list)) {
            const mapped = mapStudentsForDisplay(list);
            setStudents(mapped);
          }
        }
      } else {
        alert(`Import failed: ${result.message}`);
      }
    } catch (error: any) {
      console.error('Import failed:', error);
      alert('Failed to import class record: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading((l) => ({ ...l, importing: false }));
      // Reset file input
      event.target.value = '';
    }
  };

  const handleSaveGrades = () => {
    alert("Grades saved successfully!");
  };

  // Helper to convert transmuted grade to numeric equivalent
  const getNumericFromGrade = (grade: number | string): number => {
    const parsed = Number(grade);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
  };

  const fetchSubmissionControl = async () => {
    try {
      setSubmissionControlLoading(true);
      const res = await apiGet(API_ENDPOINTS.FINAL_GRADES_SUBMISSION_CONTROL);
      const enabled = !!(res?.data?.is_enabled ?? true);
      setSubmissionEnabled(enabled);
    } catch (e) {
      setSubmissionEnabled(true);
    } finally {
      setSubmissionControlLoading(false);
    }
  };

  const handleToggleSubmissionControl = async (enabled: boolean) => {
    if (user?.role !== 'admin') return;
    const previous = submissionEnabled;
    setSubmissionEnabled(enabled);
    try {
      setSubmissionControlSaving(true);
      const res = await apiPut(API_ENDPOINTS.FINAL_GRADES_SUBMISSION_CONTROL, { is_enabled: enabled });
      if (!res?.success) {
        throw new Error(res?.message || 'Failed to update grade submission control');
      }
    } catch (err: any) {
      setSubmissionEnabled(previous);
      alert(err?.message || 'Failed to update grade submission control');
    } finally {
      setSubmissionControlSaving(false);
    }
  };

  const handleSubmitGrades = () => {
    if (!selectedCourse || !selectedSection || !selectedPeriodId) {
      alert("Please select a course, section, and academic period first");
      return;
    }

    if (students.length === 0) {
      alert("No students found for this course/section");
      return;
    }

    if (!submissionEnabled) {
      alert("Grade submission is currently disabled by admin.");
      return;
    }

    setSubmitResult(null);
    setSubmitModalOpen(true);
  };

  const confirmSubmitGrades = async () => {
    if (!selectedCourse || !selectedSection || !selectedPeriodId) return;

    try {
      setLoading((l) => ({ ...l, submitting: true }));

      // Prepare grades payload
      const courseObjForSubmit = courses.find((c) => String(c.id) === String(selectedCourse));
      const submitWeights = getWeights(getWeightGroup(courseObjForSubmit?.code ?? ''));
      const gradesData = students.map((student) => {
        const categorized = buildComponentItems(activities, gradingItems);
        const calculatedGrades = calculateGrades(student.id, categorized, submitWeights);
        const numericScore = getNumericFromGrade(calculatedGrades.finalGrade);
        
        return {
          student_id: student.id,
          final_grade_num: numericScore,
          final_grade: calculatedGrades.finalGrade
        };
      });

      const payload = {
        subject_id: selectedCourse,
        section_id: selectedSection,
        academic_period_id: selectedPeriodId,
        quarter: selectedQuarter ?? undefined,
        grades: gradesData
      };

      const response = await apiPost(API_ENDPOINTS.FINAL_GRADES_SUBMIT, payload);

      if (response.success) {
        setSubmitResult({
          success: true,
          message: response.message ?? 'Grades submitted successfully.',
          inserted: response.inserted,
          updated: response.updated,
          errors: response.errors,
        });
      } else {
        setSubmitResult({
          success: false,
          message: response.message ?? 'Failed to submit grades.',
          errors: response.errors,
        });
      }
    } catch (error: any) {
      console.error('Grade submission error:', error);
      setSubmitResult({
        success: false,
        message: `Error submitting grades: ${error.message}`,
      });
    } finally {
      setLoading((l) => ({ ...l, submitting: false }));
    }
  };

  // Fetch academic periods and teacher assignments (courses) on mount
  useEffect(() => {
    let mounted = true;
    const fetchInitial = async () => {
      if (!isAuthenticated || !['teacher', 'admin'].includes(String(user?.role ?? ''))) return;
      try {
        setLoading((l) => ({ ...l, periods: true, courses: true }));
        await fetchSubmissionControl();
        let resolvedSchoolYear = selectedSchoolYear || '';
        // academic periods
        try {
          const pRes = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS);
          const plist = extractList(pRes, ['data', 'periods']);
          if (mounted && Array.isArray(plist)) {
            setAcademicPeriods(plist);
            const active = plist.find((p: any) => p.status === 'active');
            if (active) {
              resolvedSchoolYear = String(active.school_year ?? '');
              setSelectedSchoolYear(String(active.school_year ?? ''));
              setSelectedQuarter(String(active.quarter ?? ''));
              setSelectedPeriodId(String(active.id));
            }
          }
        } catch (e) {
          // ignore
        }

        // teacher/admin subjects -> courses
        try {
          const isAdminView = user?.role === 'admin';
          const subjectsRes = isAdminView
            ? await apiGet(API_ENDPOINTS.SUBJECTS)
            : await apiGet(API_ENDPOINTS.TEACHER_MY_SUBJECTS);
          const subjects = extractList(subjectsRes, ['subjects', 'data']);

          let teacherBySubjectId = new Map<string, string>();
          let sectionBySubjectId = new Map<string, { id: string | number; name: string }>();
          let sectionByYearLevel = new Map<string, { id: string | number; name: string }>();

          if (isAdminView) {
            try {
              const schoolYearForAssignments = resolvedSchoolYear || selectedSchoolYear || '';

              if (schoolYearForAssignments) {
                const assignmentRes = await apiGet(
                  `${API_ENDPOINTS.TEACHER_ASSIGNMENTS_LIST}?school_year=${encodeURIComponent(String(schoolYearForAssignments))}`
                );
                const assignments = extractList(assignmentRes, ['assignments', 'data']);

                assignments.forEach((a: any) => {
                  const sid = String(a.subject_id ?? '');
                  if (!sid || teacherBySubjectId.has(sid)) return;
                  const fullName = `${String(a.first_name ?? '').trim()} ${String(a.last_name ?? '').trim()}`.trim();
                  teacherBySubjectId.set(sid, fullName || 'Unassigned');

                  const assignmentSectionId = a.section_id;
                  const assignmentSectionName = normalizeLabel(a.section_name ?? '');
                  if (
                    assignmentSectionId !== null &&
                    assignmentSectionId !== undefined &&
                    !String(assignmentSectionId).startsWith('default-')
                  ) {
                    sectionBySubjectId.set(sid, {
                      id: assignmentSectionId,
                      name: assignmentSectionName,
                    });
                  }
                });
              }
            } catch (err) {
              console.warn('Failed to fetch teacher assignments for admin grade input:', err);
            }

            try {
              const ylsRes = await apiGet(API_ENDPOINTS.YEAR_LEVEL_SECTIONS);
              const mappings = extractList(ylsRes, ['mappings', 'data']);
              mappings.forEach((m: any) => {
                const levelName = normalizeLabel(m.year_level_name);
                if (!levelName || sectionByYearLevel.has(levelName)) return;
                sectionByYearLevel.set(levelName, {
                  id: m.section_id,
                  name: normalizeLabel(m.section_name),
                });
              });
            } catch (err) {
              console.warn('Failed to fetch year-level sections for admin grade input:', err);
            }
          }

          if (mounted && Array.isArray(subjects) && subjects.length > 0) {
            const sectionIds = Array.from(new Set(
              subjects
                .map((s: any) => {
                  if (s.section_id !== null && s.section_id !== undefined) return s.section_id;
                  const levelName = normalizeLabel(s.level || s.subject_level || s.year_level || '');
                  return sectionByYearLevel.get(levelName)?.id ?? null;
                })
                .filter((id: any) => id !== null && id !== undefined && !String(id).startsWith('default-'))
            )) as Array<string | number>;

            const studentCountBySection = new Map<string, number>();
            await Promise.all(sectionIds.map(async (sectionId) => {
              try {
                const res = await apiGet(`${API_ENDPOINTS.STUDENTS}?section_id=${encodeURIComponent(String(sectionId))}`);
                const list = extractList(res, ['data', 'students']);
                studentCountBySection.set(String(sectionId), list.length);
              } catch (_) {}
            }));

            const mapped = subjects.map((subject: any, idx: number) => {
              const level = normalizeLabel(subject.level || subject.subject_level || subject.year_level || '');
              const subjectId = String(subject.subject_id ?? subject.id ?? idx);
              const sectionInfoFromAssignment = sectionBySubjectId.get(subjectId);
              const sectionInfoFromLevel = sectionByYearLevel.get(level);
              const sectionId = subject.section_id ?? sectionInfoFromAssignment?.id ?? sectionInfoFromLevel?.id ?? null;
              const sectionName = normalizeLabel(subject.section_name ?? subject.section ?? sectionInfoFromAssignment?.name ?? sectionInfoFromLevel?.name ?? level);
              const sectionsList = sectionId
                ? [{ id: sectionId, name: sectionName, students: studentCountBySection.get(String(sectionId)) }]
                : (Array.isArray(subject.sections)
                  ? subject.sections.map((s: any) => ({ id: s.id, name: normalizeLabel(s.name), students: studentCountBySection.get(String(s.id)) }))
                  : []);

              const assignedTeacherName = teacherBySubjectId.get(subjectId);

              return {
                id: subject.subject_id ?? subject.id ?? idx,
                code: normalizeLabel(subject.course_code || subject.code || ''),
                title: normalizeLabel(subject.name || subject.subject_name || ''),
                semester: subject.semester ?? null,
                year_level: level || null,
                teacher: normalizeLabel(assignedTeacherName ?? subject.teacher_name ?? (isAdminView ? 'Unassigned' : (user?.name ?? ''))),
                sections: sectionsList,
                status: subject.status ?? 'active',
              };
            });

            console.log('Fetched courses:', mapped); // Debug log
            setCourses(mapped);

            if (mapped.length > 0) {
              setSelectedCourse(String(mapped[0].id));
              setCourseInfo({
                code: mapped[0].code ?? '',
                title: mapped[0].title ?? '',
                teacher: mapped[0].teacher ?? (user?.name ?? ''),
                section: mapped[0].sections && mapped[0].sections[0] ? mapped[0].sections[0].name : ''
              });
              setSections(mapped[0].sections ?? []);
              if (mapped[0].sections && mapped[0].sections.length > 0) {
                setSelectedSection(String(mapped[0].sections[0].id));
              } else {
                setSelectedSection(null);
              }
            }
          } else if (mounted) {
            setCourses([]);
            setSections([]);
            setSelectedCourse(null);
            setSelectedSection(null);
          }
        } catch (e) {
          console.error('Failed to fetch teacher subjects:', e);
          // fallback: try fetch subjects list
          try {
            const sres = await apiGet(API_ENDPOINTS.SUBJECTS);
            const slist = extractList(sres, ['data', 'subjects']);
            if (mounted && Array.isArray(slist) && slist.length > 0) {
              const mapped = slist.map((s: any) => ({ id: s.id, code: normalizeLabel(s.course_code), title: normalizeLabel(s.course_name), semester: s.semester ?? null, year_level: normalizeLabel(s.year_level ?? ''), sections: Array.isArray(s.sections) ? s.sections.map((x: any) => ({ id: x.id, name: normalizeLabel(x.name) })) : [] }));
              setCourses(mapped);
              if (mapped.length > 0) {
                setSelectedCourse(String(mapped[0].id));
                setCourseInfo({ code: mapped[0].code ?? '', title: mapped[0].title ?? '', teacher: user?.name ?? '', section: mapped[0].sections && mapped[0].sections[0] ? mapped[0].sections[0].name : '' });
                setSections(mapped[0].sections ?? []);
                if (mapped[0].sections && mapped[0].sections.length > 0) setSelectedSection(String(mapped[0].sections[0].id));
              }
            }
          } catch (e) {}
        }
      } finally {
        setLoading((l) => ({ ...l, periods: false, courses: false }));
      }
    };
    fetchInitial();
    return () => { mounted = false; };
  }, [user, isAuthenticated]);

  // When academicPeriods list loads, sync selectedSchoolYear → selectedQuarter → selectedPeriodId
  useEffect(() => {
    if (!selectedCourse) return;
    const found = courses.find((c) => String(c.id) === String(selectedCourse));

    if (found) {
      console.groupCollapsed('[GradeInput] Selected course changed');
      console.log('selectedCourse id:', selectedCourse);
      console.log('course.code meta:', debugLabelMeta(found.code));
      console.log('course.title meta:', debugLabelMeta(found.title));
      console.log('sections meta:', (found.sections ?? []).map((s: any) => ({
        id: s.id,
        name: debugLabelMeta(s.name),
      })));
      console.groupEnd();
    }

    if (found) {
      setSections(found.sections ?? []);
      setCourseInfo({ code: normalizeLabel(found.code), title: normalizeLabel(found.title), teacher: normalizeLabel(found.teacher ?? (user?.name ?? '')), section: found.sections && found.sections[0] ? normalizeLabel(found.sections[0].name) : '' });
      if (found.sections && found.sections.length > 0) {
        setSelectedSection(String(found.sections[0].id));
      } else {
        setSelectedSection(null);
      }
    }
  }, [selectedCourse, courses, user]);

  useEffect(() => {
    if (!courses.length) return;
    console.groupCollapsed('[GradeInput] Courses options debug');
    console.table(
      courses.map((course: any) => ({
        id: String(course.id),
        code_raw: String(course.code ?? ''),
        code_normalized: normalizeLabel(course.code),
        code_leading: debugLabelMeta(course.code).leadingSpaces,
        code_trailing: debugLabelMeta(course.code).trailingSpaces,
        title_raw: String(course.title ?? ''),
        title_normalized: normalizeLabel(course.title),
        title_leading: debugLabelMeta(course.title).leadingSpaces,
        title_trailing: debugLabelMeta(course.title).trailingSpaces,
      }))
    );
    console.groupEnd();
  }, [courses]);

  useEffect(() => {
    if (!sections.length) return;
    console.groupCollapsed('[GradeInput] Sections options debug');
    console.table(
      sections.map((section: any) => ({
        id: String(section.id),
        name_raw: String(section.name ?? ''),
        name_normalized: normalizeLabel(section.name),
        name_leading: debugLabelMeta(section.name).leadingSpaces,
        name_trailing: debugLabelMeta(section.name).trailingSpaces,
      }))
    );
    console.groupEnd();
  }, [sections]);

  // When selectedSection or selectedPeriodId changes, fetch activities
  useEffect(() => {
    let mounted = true;
    const fetchActivities = async () => {
      if (!selectedCourse || !selectedSection) return;
      try {
        setLoading((l) => ({ ...l, activities: true }));

        // Build query params - filter by academic_period_id if selected
        let query = `course_id=${encodeURIComponent(String(selectedCourse))}&section_id=${encodeURIComponent(String(selectedSection))}`;

        if (selectedPeriodId) {
          query += `&academic_period_id=${encodeURIComponent(String(selectedPeriodId))}`;
        }

        const res = await apiGet(`${API_ENDPOINTS.ACTIVITIES}?${query}`);
        let list = extractList(res, ['data', 'activities']);

        // Fallback: if period-filtered query returns no activities, retry without period filter
        if (selectedPeriodId && (!Array.isArray(list) || list.length === 0)) {
          const fallbackQuery = `course_id=${encodeURIComponent(String(selectedCourse))}&section_id=${encodeURIComponent(String(selectedSection))}`;
          const fallbackRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}?${fallbackQuery}`);
          const fallbackList = extractList(fallbackRes, ['data', 'activities']);
          if (Array.isArray(fallbackList) && fallbackList.length > 0) {
            list = fallbackList;
          }
        }

        if (mounted && Array.isArray(list)) {
          console.log('Fetched activities:', list); // Debug log
          setActivities(list);
        } else {
          setActivities([]);
        }
      } catch (e) {
        console.error('Failed to fetch activities:', e);
        setActivities([]);
      } finally {
        setLoading((l) => ({ ...l, activities: false }));
      }
    };
    fetchActivities();
    return () => { mounted = false; };
  }, [selectedCourse, selectedSection, selectedPeriodId]);

  // Fetch hybrid grading input items (activity + manual + merged) and student score map
  useEffect(() => {
    let mounted = true;
    const fetchGradingInputs = async () => {
      if (!selectedCourse || !selectedSection || !selectedPeriodId) {
        if (mounted) {
          setGradingItems([]);
          setGradingScoreMap({});
        }
        return;
      }

      try {
        // Sync LMS activities into grading inputs first (best effort)
        try {
          await apiPost(API_ENDPOINTS.GRADING_INPUTS_SYNC_LMS, {
            course_id: Number(selectedCourse),
            section_id: Number(selectedSection),
            academic_period_id: Number(selectedPeriodId),
            quarter: selectedQuarter || null,
          });
        } catch (syncErr) {
          console.warn('Failed to sync LMS grading inputs:', syncErr);
        }

        const giQuery = `course_id=${encodeURIComponent(String(selectedCourse))}&section_id=${encodeURIComponent(String(selectedSection))}&academic_period_id=${encodeURIComponent(String(selectedPeriodId))}&quarter=${encodeURIComponent(selectedQuarter || '')}`;
        const giRes = await apiGet(`${API_ENDPOINTS.GRADING_INPUTS}?${giQuery}`);
        const activeItems = extractList(giRes, ['items', 'data']);
        const hiddenItems = Array.isArray(giRes?.hidden_source_items)
          ? giRes.hidden_source_items.map((i: any) => ({ ...i, is_hidden: true }))
          : [];
        const scoreRows = extractList(giRes, ['scores']);

        if (mounted) {
          setGradingItems([...(Array.isArray(activeItems) ? activeItems : []), ...hiddenItems]);
          setGradingScoreMap(buildScoreMap(scoreRows));
        }
      } catch (err) {
        console.warn('Failed to fetch grading inputs:', err);
        if (mounted) {
          setGradingItems([]);
          setGradingScoreMap({});
        }
      }
    };

    fetchGradingInputs();
    return () => { mounted = false; };
  }, [selectedCourse, selectedSection, selectedPeriodId, selectedQuarter]);

  // When selectedSection changes, fetch students for that section
  useEffect(() => {
    let mounted = true;
    const fetchStudents = async () => {
      if (!selectedSection || !selectedCourse) return;
      try {
        setLoading((l) => ({ ...l, students: true }));
        // Get year level from selected course
        const course = courses.find((c) => String(c.id) === String(selectedCourse));
        const yearLevel = course?.year_level ?? null;
        
        // Build query with section_id and optionally year_level
        let query = `section_id=${encodeURIComponent(String(selectedSection))}`;
        if (yearLevel) {
          query += `&year_level=${encodeURIComponent(String(yearLevel))}`;
        }
        // Include grades in the response
        query += `&include_grades=true`;
        
        const res = await apiGet(`${API_ENDPOINTS.STUDENTS}?${query}`);
        const list = extractList(res, ['data', 'students']);
        if (mounted && Array.isArray(list)) {
          const mapped = mapStudentsForDisplay(list);
          setStudents(mapped);
        } else {
          setStudents([]);
        }
      } catch (e) {
        console.error('Failed to fetch students:', e);
        setStudents([]);
      } finally {
        setLoading((l) => ({ ...l, students: false }));
      }
    };
    fetchStudents();
    return () => { mounted = false; };
  }, [selectedSection, selectedCourse, courses]);

  if (!isAuthenticated) return null;

  // Derive DepEd component weights from selected course code
  const selectedCourseObj = courses.find((c) => String(c.id) === String(selectedCourse));
  const currentWeightGroup = getWeightGroup(selectedCourseObj?.code ?? '');
  const currentWeights = getWeights(currentWeightGroup);
  const componentItems = buildComponentItems(activities, gradingItems);
  const writtenItems = componentItems.written;
  const performanceItems = componentItems.performance;
  const quarterlyItems = componentItems.quarterly;
  const writtenSlots = Math.max(8, writtenItems.length);
  const performanceSlots = Math.max(5, performanceItems.length);
  const totalGradeColumns = 1 + (writtenSlots + 3) + (performanceSlots + 3) + 3 + 2;

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Class Record</h1>
            <p className="text-muted-foreground">Manage and input student grades</p>
          </div>
          <div className="flex items-center gap-2">
            {/* <Button variant="outline" onClick={handleExportClassRecord}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button> */}
            <Button variant="outline" onClick={handleExportClassRecordExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button
              onClick={handleSubmitGrades}
              disabled={loading.submitting || submissionControlLoading || !submissionEnabled}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading.submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {loading.submitting ? 'Submitting...' : submissionEnabled ? 'Submit Grades' : 'Submission Disabled'}
            </Button>
            {user?.role === 'admin' && (
              <div className="flex items-center gap-2 pl-2 border-l">
                <Label className="text-xs text-muted-foreground">Allow Submission</Label>
                <Switch
                  checked={submissionEnabled}
                  disabled={submissionControlSaving || submissionControlLoading}
                  onCheckedChange={handleToggleSubmissionControl}
                />
              </div>
            )}
          </div>
        </div>

        {/* Course Selection and Info */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Academic Year</Label>
                <Select value={selectedSchoolYear ?? undefined} onValueChange={(v) => {
                  setSelectedSchoolYear(v);
                  // Pick first quarter of the newly selected school year
                  const quarters = academicPeriods.filter((p: any) => String(p.school_year) === v);
                  if (quarters.length > 0) {
                    const first = quarters[0];
                    setSelectedQuarter(String(first.quarter ?? ''));
                    setSelectedPeriodId(String(first.id));
                  } else {
                    setSelectedQuarter(null);
                    setSelectedPeriodId(null);
                  }
                }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set(academicPeriods.map((p: any) => String(p.school_year)))).map((year) => (
                      <SelectItem hideIndicator key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Quarter</Label>
                <Select value={selectedQuarter ?? undefined} onValueChange={(v) => {
                  setSelectedQuarter(v);
                  const matched = academicPeriods.find(
                    (p: any) => String(p.school_year) === String(selectedSchoolYear) && String(p.quarter) === v
                  );
                  if (matched) setSelectedPeriodId(String(matched.id));
                }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicPeriods
                      .filter((p: any) => String(p.school_year) === String(selectedSchoolYear))
                      .sort((a: any, b: any) => {
                        const order = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'];
                        return order.indexOf(a.quarter) - order.indexOf(b.quarter);
                      })
                      .map((p: any) => (
                        <SelectItem hideIndicator key={p.id} value={String(p.quarter)}>{p.quarter}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Course</Label>
                <Select value={selectedCourse ?? undefined} onValueChange={(v) => {
                  logSelectChange('course', v);
                  setSelectedCourse(v);
                }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem hideIndicator key={c.id} value={String(c.id)}>{`${normalizeLabel(c.code)} - ${normalizeLabel(c.title)} (${normalizeLabel(c.teacher || 'Unassigned')})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Section</Label>
                <Select value={selectedSection ?? undefined} onValueChange={(v) => {
                  logSelectChange('section', v);
                  setSelectedSection(v);
                }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem hideIndicator key={s.id} value={String(s.id)}>{normalizeLabel(s.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Course Info Banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">{courseInfo.code} - {courseInfo.title}</p>
                  <p className="text-sm text-muted-foreground">Teacher: {courseInfo.teacher} | Section: {courseInfo.section}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs">
                    {selectedSchoolYear && selectedQuarter ? `${selectedSchoolYear} • ${selectedQuarter}` : selectedSchoolYear ?? 'No period selected'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class Record Table */}
        <Card className="mb-6">
          <CardHeader>
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Class Record
                </CardTitle>
                <CardDescription className="hidden md:block">
                  Written Work ({currentWeights.ww}%) • Performance Tasks ({currentWeights.pt}%) • Quarterly Assessment ({currentWeights.qa}%)
                </CardDescription>
              </div>
              <div>
                <Button
                  onClick={() => {
                    // Use import.meta.env.BASE_URL to get the correct base path (/ui/ in production, / in dev)
                    const basePath = import.meta.env.BASE_URL || '/';
                    const url = `${basePath}teacher/grade-input-edit?course=${selectedCourse}&section=${selectedSection}&quarter=${encodeURIComponent(selectedQuarter ?? '')}&period_id=${selectedPeriodId || ''}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Grades
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
                <div className="overflow-x-auto overflow-y-auto max-h-[600px] border rounded-lg">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-background">
                  <tr className="border-b-2 border-border bg-background">
                    <th className="p-2 text-left font-semibold sticky left-0 z-30 bg-background border-r border-border min-w-[200px] max-w-[200px] w-[200px]">
                      Learner's Name
                    </th>
                    {/* Written Work */}
                    <th colSpan={writtenSlots + 3} className="p-2 text-center font-semibold bg-table-written border-r border-border">
                      Written Work ({currentWeights.ww}%)
                    </th>
                    {/* Performance Tasks */}
                    <th colSpan={performanceSlots + 3} className="p-2 text-center font-semibold bg-table-performance border-r border-border">
                      Performance Tasks ({currentWeights.pt}%)
                    </th>
                    {/* Quarterly Assessment */}
                    <th colSpan={3} className="p-2 text-center font-semibold bg-table-exam border-r border-border">
                      Quarterly Assessment ({currentWeights.qa}%)
                    </th>
                    {/* Total */}
                    <th colSpan={2} className="p-2 text-center font-semibold bg-table-total">
                      {selectedQuarter ?? 'Quarter'} Grade
                    </th>
                  </tr>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-2 text-left text-xs font-medium sticky left-0 z-30 bg-muted border-r border-border min-w-[200px] max-w-[200px] w-[200px]">ID / Name</th>
                    {/* Written sub-columns */}
                    {writtenItems.map((act, idx) => (
                      <th key={`wh${idx}`} className="p-1 text-center font-medium w-12 bg-table-written/50" title={act.title}>
                        {act.title.length > 10 ? act.title.substring(0, 10) + '...' : act.title}
                      </th>
                    ))}
                    {Array.from({ length: Math.max(0, writtenSlots - writtenItems.length) }).map((_, i) => (
                      <th key={`whe${i}`} className="p-1 text-center font-medium w-12 bg-table-written/50">-</th>
                    ))}
                    <th className="p-1 text-center font-medium w-12 bg-table-written/50">Total</th>
                    <th className="p-1 text-center font-medium w-12 bg-table-written/50">PS</th>
                    <th className="p-1 text-center font-medium w-12 bg-table-written border-r border-border">WS</th>
                    {/* Performance sub-columns */}
                    {performanceItems.map((act, idx) => (
                      <th key={`ph${idx}`} className="p-1 text-center font-medium w-12 bg-table-performance/50" title={act.title}>
                        {act.title.length > 10 ? act.title.substring(0, 10) + '...' : act.title}
                      </th>
                    ))}
                    {Array.from({ length: Math.max(0, performanceSlots - performanceItems.length) }).map((_, i) => (
                      <th key={`phe${i}`} className="p-1 text-center font-medium w-12 bg-table-performance/50">-</th>
                    ))}
                    <th className="p-1 text-center font-medium w-12 bg-table-performance/50">Total</th>
                    <th className="p-1 text-center font-medium w-12 bg-table-performance/50">PS</th>
                    <th className="p-1 text-center font-medium w-12 bg-table-performance border-r border-border">WS</th>
                    {/* Quarterly Assessment sub-columns */}
                    <th className="p-1 text-center font-medium w-12 bg-table-exam/50">Score</th>
                    <th className="p-1 text-center font-medium w-12 bg-table-exam/50">PS</th>
                    <th className="p-1 text-center font-medium w-12 bg-table-exam border-r border-border">WS</th>
                    {/* Total columns */}
                    <th className="p-1 text-center font-medium w-16 bg-table-total">Initial<br/><span className="text-[10px] font-normal">(0-100)</span></th>
                    <th className="p-1 text-center font-medium w-14 bg-table-total">Grade</th>
                  </tr>
                  <tr className="border-b border-border bg-muted/30 text-[10px]">
                    <th className="p-1 text-right font-medium sticky left-0 z-30 bg-muted border-r border-border min-w-[200px] max-w-[200px] w-[200px]">HPS →</th>
                    {/* Written Works HPS */}
                    {writtenItems.map((act, idx) => (
                      <th key={`whps${idx}`} className="p-1 text-center text-muted-foreground bg-table-written/30">{act.max_score}</th>
                    ))}
                    {Array.from({ length: Math.max(0, writtenSlots - writtenItems.length) }).map((_, i) => (
                      <th key={`whpse${i}`} className="p-1 text-center text-muted-foreground bg-table-written/30">-</th>
                    ))}
                    <th className="p-1 text-center text-muted-foreground bg-table-written/30">{writtenItems.reduce((sum, act) => sum + parseFloat(act.max_score ?? 0), 0)}</th>
                    <th className="p-1 text-center text-muted-foreground bg-table-written/30">100%</th>
                    <th className="p-1 text-center text-muted-foreground bg-table-written border-r border-border">{currentWeights.ww}%</th>
                    {/* Performance Tasks HPS */}
                    {performanceItems.map((act, idx) => (
                      <th key={`phps${idx}`} className="p-1 text-center text-muted-foreground bg-table-performance/30">{act.max_score}</th>
                    ))}
                    {Array.from({ length: Math.max(0, performanceSlots - performanceItems.length) }).map((_, i) => (
                      <th key={`phpsee${i}`} className="p-1 text-center text-muted-foreground bg-table-performance/30">-</th>
                    ))}
                    <th className="p-1 text-center text-muted-foreground bg-table-performance/30">{performanceItems.reduce((sum, act) => sum + parseFloat(act.max_score ?? 0), 0)}</th>
                    <th className="p-1 text-center text-muted-foreground bg-table-performance/30">100%</th>
                    <th className="p-1 text-center text-muted-foreground bg-table-performance border-r border-border">{currentWeights.pt}%</th>
                    {/* Quarterly Assessment HPS */}
                    <th className="p-1 text-center text-muted-foreground bg-table-exam/30">{quarterlyItems.reduce((sum, act) => sum + parseFloat(act.max_score ?? 0), 0)}</th>
                    <th className="p-1 text-center text-muted-foreground bg-table-exam/30">100%</th>
                    <th className="p-1 text-center text-muted-foreground bg-table-exam border-r border-border">{currentWeights.qa}%</th>
                    <th className="p-1 text-center text-muted-foreground bg-table-total">100%</th>
                    <th className="p-1 text-center text-muted-foreground bg-table-total">100</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const categorized = componentItems;
                    const grades = calculateGrades(student.id, categorized, currentWeights);
                    const currentGenderRank = Number(student?._gender_rank ?? 2);
                    const previousGenderRank = idx > 0 ? Number(students[idx - 1]?._gender_rank ?? 2) : null;
                    const showGenderLabel = idx === 0 || currentGenderRank !== previousGenderRank;

                    return (
                      <>
                        {showGenderLabel && (
                          <tr key={`gender-${currentGenderRank}-${idx}`} className="border-y border-border bg-muted/60">
                            <td colSpan={totalGradeColumns} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {getGenderGroupLabel(currentGenderRank)}
                            </td>
                          </tr>
                        )}
                        <tr key={idx} className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="p-2 sticky left-0 z-10 bg-background border-r border-border min-w-[200px] max-w-[200px] w-[200px]">
                            <div>
                              <p className="font-medium text-xs">{idx + 1}. {student.name}</p>
                              <p className="text-[10px] text-muted-foreground">{student.student_code ?? student.id}</p>
                            </div>
                          </td>
                          {/* Written Works - Individual Scores */}
                          {categorized.written.map((act, actIdx) => (
                            <td key={`w${actIdx}`} className="p-1 text-center bg-table-written/20">
                              <div className="text-xs">{getStudentGrade(student.id, act) || '-'}</div>
                            </td>
                          ))}
                          {/* Fill empty columns if less than 8 activities */}
                          {Array.from({ length: Math.max(0, writtenSlots - categorized.written.length) }).map((_, i) => (
                            <td key={`we${i}`} className="p-1 text-center bg-table-written/20">
                              <div className="text-xs text-muted-foreground">-</div>
                            </td>
                          ))}
                          <td className="p-1 text-center font-semibold bg-table-written/30 text-xs">
                            {grades.written.total.toFixed(0)}
                          </td>
                          <td className="p-1 text-center font-medium bg-table-written/30 text-xs">
                            {grades.written.ps.toFixed(2)}%
                          </td>
                          <td className="p-1 text-center font-semibold bg-table-written border-r border-border text-xs">
                            {grades.written.ws.toFixed(2)}
                          </td>
                          {/* Performance Tasks - Individual Scores */}
                          {categorized.performance.map((act, actIdx) => (
                            <td key={`p${actIdx}`} className="p-1 text-center bg-table-performance/20">
                              <div className="text-xs">{getStudentGrade(student.id, act) || '-'}</div>
                            </td>
                          ))}
                          {/* Fill empty columns if less than 5 activities */}
                          {Array.from({ length: Math.max(0, performanceSlots - categorized.performance.length) }).map((_, i) => (
                            <td key={`pe${i}`} className="p-1 text-center bg-table-performance/20">
                              <div className="text-xs text-muted-foreground">-</div>
                            </td>
                          ))}
                          <td className="p-1 text-center font-semibold bg-table-performance/30 text-xs">
                            {grades.performance.total.toFixed(0)}
                          </td>
                          <td className="p-1 text-center font-medium bg-table-performance/30 text-xs">
                            {grades.performance.ps.toFixed(2)}%
                          </td>
                          <td className="p-1 text-center font-semibold bg-table-performance border-r border-border text-xs">
                            {grades.performance.ws.toFixed(2)}
                          </td>
                          {/* Quarterly Assessment */}
                          <td className="p-1 text-center bg-table-exam/20">
                            <div className="text-xs">{grades.quarterly.total.toFixed(0)}</div>
                          </td>
                          <td className="p-1 text-center font-medium bg-table-exam/30 text-xs">
                            {grades.quarterly.ps.toFixed(2)}%
                          </td>
                          <td className="p-1 text-center font-semibold bg-table-exam border-r border-border text-xs">
                            {grades.quarterly.ws.toFixed(2)}
                          </td>
                          {/* Totals */}
                          <td className="p-1 text-center font-bold bg-table-total text-xs">
                            {grades.initialGrade.toFixed(2)}
                          </td>
                          <td className="p-1 text-center font-bold bg-table-total text-xs">
                            {grades.finalGrade}
                          </td>
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Total Students: {students.length}</p>
                <p className="text-[10px]">
                  <span className="font-medium">HPS</span> = Highest Possible Score • 
                  <span className="font-medium"> PS</span> = Percentage Score • 
                  <span className="font-medium"> WS</span> = Weighted Score
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import/Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offline Support</CardTitle>
            <CardDescription className="text-xs">Import or export class record for offline editing</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Hidden file input for import */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportClassRecord}
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              aria-label="Import Excel file"
              title="Select Excel file to import"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                  loading.importing 
                    ? 'border-primary/50 bg-primary/5' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
                onClick={handleImportClick}
              >
                <div className="flex items-center gap-3">
                  {loading.importing ? (
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">
                      {loading.importing ? 'Importing...' : 'Import Excel File'}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {loading.importing 
                        ? 'Processing grades from Excel file...' 
                        : 'Upload edited class record (.xlsx, .xls)'}
                    </p>
                    {!loading.importing && (
                      <Button size="sm" variant="outline" className="mt-1" disabled={!selectedCourse || !selectedSection}>
                        <Upload className="h-3 w-3 mr-1" />
                        Choose File
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              <div 
                className="border border-border rounded-lg p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handleExportClassRecordExcel}
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Export to Excel</p>
                    <p className="text-xs text-muted-foreground mb-2">Download current class record for offline editing</p>
                    <Button size="sm" variant="outline" className="mt-1" disabled={!selectedCourse || !selectedSection}>
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Tip:</strong> Export the class record first to get the correct template format. 
                Edit grades in Excel (only modify score columns), then import the file back to update grades in the system.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={submitModalOpen} onOpenChange={(open) => { if (!loading.submitting) setSubmitModalOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{submitResult ? (submitResult.success ? 'Grades Submitted' : 'Submission Failed') : 'Submit Grades'}</DialogTitle>
            <DialogDescription>
              {submitResult
                ? submitResult.message
                : `You are about to submit grades for ${students.length} students. This will save the ${selectedQuarter ?? 'selected'} grades to the system.`}
            </DialogDescription>
          </DialogHeader>

          {!submitResult && (
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Course:</span> {courseInfo.code} - {courseInfo.title}</p>
              <p><span className="font-medium">Section:</span> {courseInfo.section || selectedSection}</p>
              <p><span className="font-medium">Period:</span> {selectedSchoolYear} • {selectedQuarter}</p>
            </div>
          )}

          {submitResult && (
            <div className="text-sm space-y-1">
              {typeof submitResult.inserted === 'number' && <p>Inserted: {submitResult.inserted}</p>}
              {typeof submitResult.updated === 'number' && <p>Updated: {submitResult.updated}</p>}
              {submitResult.errors && submitResult.errors.length > 0 && (
                <p className="text-amber-600">Warnings: {submitResult.errors.slice(0, 3).join('; ')}{submitResult.errors.length > 3 ? '...' : ''}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModalOpen(false)} disabled={loading.submitting}>
              {submitResult ? 'Close' : 'Cancel'}
            </Button>
            {!submitResult && (
              <Button onClick={confirmSubmitGrades} disabled={loading.submitting || !submissionEnabled} className="bg-green-600 hover:bg-green-700">
                {loading.submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {loading.submitting ? 'Submitting...' : 'Confirm Submit'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default GradeInput;
