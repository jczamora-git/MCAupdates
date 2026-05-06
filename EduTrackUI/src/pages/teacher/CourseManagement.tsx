import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Users, ClipboardList, UserPlus, LayoutGrid, List, CheckCircle2, AlertCircle, Clock, Mail, User, BookOpen, FileText, HelpCircle, Award, Zap, Microscope, Upload, FileIcon, X, Trash2, Search, Palette, MessageCircle, Mic, UsersRound, Settings, Pencil, Eye } from "lucide-react";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { API_ENDPOINTS, apiGet, apiPost, apiPut, apiDelete, apiUpload } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertMessage } from "@/components/AlertMessage";

// Helper function to get activity type display label and icon
const getActivityTypeDisplay = (type: string) => {
  const typeMap: Record<string, { label: string; color: string; bgColor: string; Icon: any }> = {
    worksheet: { label: 'Worksheet', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', Icon: FileText },
    quiz: { label: 'Quiz', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200', Icon: HelpCircle },
    exam: { label: 'Exam', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', Icon: Award },
    project: { label: 'Project', color: 'text-cyan-600', bgColor: 'bg-cyan-50 border-cyan-200', Icon: Zap },
    art: { label: 'Art', color: 'text-pink-600', bgColor: 'bg-pink-50 border-pink-200', Icon: Palette },
    storytime: { label: 'Storytime', color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', Icon: MessageCircle },
    recitation: { label: 'Recitation', color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', Icon: Mic },
    participation: { label: 'Participation', color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', Icon: UsersRound },
    other: { label: 'Other', color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', Icon: ClipboardList },
  };
  return typeMap[type] || typeMap['other'];
};

const CourseManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const location = useLocation();

  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [courseCode, setCourseCode] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState<string | null>(null);
  const [courseYearLevel, setCourseYearLevel] = useState<number | string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sections, setSections] = useState<Array<{ id: string | number; name: string }>>([]);
  const [canonicalCourseId, setCanonicalCourseId] = useState<string | number | null>(null);
  const [selectedAcademicPeriod, setSelectedAcademicPeriod] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "teacher") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  

  const [activities, setActivities] = useState<any[]>([]);

  const [viewType, setViewType] = useState<"list" | "grid">(() => {
    try {
      const saved = localStorage.getItem("course_activities_view");
      if (saved === "list" || saved === "grid") return saved;
    } catch (e) {}
    return "list";
  });

  // Activity category filter state (empty = show all)
  const activityCategories = [
    'worksheet',
    'quiz',
    'exam',
    'project',
    'art',
    'storytime',
    'recitation',
    'participation',
    'other',
  ];
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((p) => p !== cat) : [...prev, cat]));
  };

  // persist view preference
  useEffect(() => {
    try {
      localStorage.setItem("course_activities_view", viewType);
    } catch (e) {}
  }, [viewType]);

  // Add activity dialog state (controlled)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newMaxScore, setNewMaxScore] = useState<string>("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAllowLateSubmission, setNewAllowLateSubmission] = useState(true);
  // Edit activity state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editActivityId, setEditActivityId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMaxScore, setEditMaxScore] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAllowLateSubmission, setEditAllowLateSubmission] = useState(true);
  const [deleteActivity, setDeleteActivity] = useState<any | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  

  // Students state and view (fetched from API)
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Academic periods
  const [academicPeriods, setAcademicPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);

  const courseInfo = {
    title: courseTitle ?? "",
    code: courseCode ?? "",
    section: sectionName ?? "",
    students: students.length,
  };

  const openEditActivity = (activity: any) => {
    setEditActivityId(activity.id);
    setEditTitle(activity.title ?? '');
    setEditType(activity.type ?? '');
    setEditDescription(activity.description ?? '');
    setEditMaxScore(String(activity.max_score ?? ''));
    setEditDueDate(activity.due_at ? String(activity.due_at).split(' ')[0] : '');
    setEditAllowLateSubmission(activity.allow_late_submission === 1 || activity.allow_late_submission === true);
    setIsEditOpen(true);
  };

  const handleDeleteActivity = async () => {
    if (!deleteActivity?.id) return;
    const activityId = Number(deleteActivity.id);
    try {
      setDeletingActivityId(activityId);
      const res = await apiDelete(API_ENDPOINTS.ACTIVITY_BY_ID(activityId));
      setActivities((prev) => prev.filter((activity) => Number(activity.id) !== activityId));
      setDeleteActivity(null);
      setAlert({ type: 'success', message: res?.message ?? 'Activity deleted successfully.' });
    } catch (e) {
      setAlert({ type: 'error', message: e instanceof Error ? e.message : 'Failed to delete activity' });
    } finally {
      setDeletingActivityId(null);
    }
  };

  const [studentViewType, setStudentViewType] = useState<"list" | "grid">(() => {
    try {
      const saved = localStorage.getItem("course_students_view");
      if (saved === "list" || saved === "grid") return saved;
    } catch (e) {}
    return "list";
  });

  // persist student view preference
  useEffect(() => {
    try {
      localStorage.setItem("course_students_view", studentViewType);
    } catch (e) {}
  }, [studentViewType]);

  // Learning Materials state
  const [learningMaterials, setLearningMaterials] = useState<any[]>([]);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [materialType, setMaterialType] = useState<"file" | "link" | "text">("text");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [materialLinks, setMaterialLinks] = useState<string[]>([""]);
  const [currentLinkInput, setCurrentLinkInput] = useState("");

  // Students sidebar state
  const [isStudentsPanelOpen, setIsStudentsPanelOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentSidebarGrades, setStudentSidebarGrades] = useState<any | null>(null);
  const [loadingStudentGrades, setLoadingStudentGrades] = useState(false);

  // Fetch academic periods on mount and select current active period
  useEffect(() => {
    let mounted = true;
    const fetchPeriods = async () => {
      try {
        const res = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS);
        const list = res.data ?? res.periods ?? res ?? [];
        if (Array.isArray(list) && mounted) {
          // Show all available periods
          setAcademicPeriods(list);
          // Find and select active period
          const active = list.find((p: any) => p.status === 'active');
          if (active) {
            console.log('Active academic period:', active);
            setSelectedPeriod(active);
            setSelectedAcademicPeriod(String(active.id ?? active.academic_period_id));
          } else if (list.length > 0) {
            // fallback to first available if no active found
            const firstPeriod = list[0];
            setSelectedAcademicPeriod(String(firstPeriod.id ?? firstPeriod.academic_period_id));
            setSelectedPeriod(firstPeriod);
          }
        }
      } catch (e) {
        console.error('Failed to fetch academic periods:', e);
      }
    };
    fetchPeriods();
    return () => { mounted = false; };
  }, []);

  if (!isAuthenticated) return null;

  // Fetch course/section metadata and students when courseId or section_id in query changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sectionId = params.get('section_id');
    // keep selected section id in state for other hooks
    setSelectedSectionId(sectionId);

    const fetchInfo = async () => {
      try {
        // Try to resolve course info from teacher subject assignments (preferred)
        let courseFound = false;
        let detectedYearLevel: number | string | null = null;
        // Track section resolution with a local variable — never read React state inside
        // async closures (stale closure problem causes [object Object] overwrite).
        let sectionResolved = false;
        try {
          const res = await apiGet(API_ENDPOINTS.TEACHER_MY_SUBJECTS);
          const subjects = Array.isArray(res?.subjects) ? res.subjects : [];
          if (Array.isArray(subjects)) {
            for (const subject of subjects) {
              const subjectId = subject.subject_id ?? subject.id ?? null;
              if (String(subjectId) === String(courseId) || String(subject.subject_id) === String(courseId)) {
                setCourseTitle(subject.name ?? subject.subject_name ?? subject.course_name ?? subject.title ?? '');
                setCourseCode(subject.course_code ?? subject.code ?? '');
                detectedYearLevel = subject.level ?? subject.subject_level ?? subject.year_level ?? subject.year ?? null;
                if (detectedYearLevel) setCourseYearLevel(detectedYearLevel);
                const canonical = subject.subject_id ?? subject.id ?? courseId ?? null;
                setCanonicalCourseId(canonical);

                // The backend now resolves section_id directly via year_level_sections join.
                // Use it immediately so activity creation never gets a null section_id.
                if (subject.section_id) {
                  const resolvedSectionId = String(subject.section_id);
                  // Always coerce to string — prevents [object Object] if the DB driver
                  // returns a non-primitive for the column value.
                  const resolvedSectionName = String(subject.section_name ?? subject.level ?? resolvedSectionId);
                  setSelectedSectionId(resolvedSectionId);
                  setSectionName(resolvedSectionName);
                  setSections([{ id: resolvedSectionId, name: resolvedSectionName }]);
                  sectionResolved = true;
                  // Sync URL param so everything stays consistent
                  try {
                    const url = new URL(window.location.href);
                    if (!url.searchParams.get('section_id')) {
                      url.searchParams.set('section_id', resolvedSectionId);
                      window.history.replaceState({}, '', url.toString());
                    }
                  } catch (_) {}
                }

                courseFound = true;
                break;
              }
            }
          }
        } catch (e) {
          // ignore and fallback
          courseFound = false;
        }

        // Fallback: try subjects endpoint if course not found
        if (!courseFound && courseId) {
          try {
            const subj = await apiGet(API_ENDPOINTS.SUBJECT_BY_ID(courseId));
            // subject controller may return { success, data } or the subject directly
            const s = subj.data ?? subj;
            setCourseTitle(s.course_name ?? s.title ?? s.name ?? '');
            setCourseCode(s.course_code ?? s.code ?? '');
            // detect year_level from subject
            detectedYearLevel = detectedYearLevel ?? (s.year_level ?? s.yearLevel ?? s.year ?? null);
            if (detectedYearLevel) setCourseYearLevel(detectedYearLevel);
            // If we fetched the subject directly, use its id as canonical
            setCanonicalCourseId(s.id ?? s.subject_id ?? courseId);
          } catch (e) {}
        }

        // Resolve section name from sections endpoint only if not already resolved above
        if (!sectionResolved && sectionId) {
          try {
            const secRes = await apiGet(`${API_ENDPOINTS.SECTIONS}/${sectionId}`);
            const sdata = secRes.data ?? secRes;
            const secName = String(sdata.name ?? sdata.title ?? sectionId);
            const secObj = { id: sdata.id ?? sectionId, name: secName };
            setSectionName(secName);
            sectionResolved = true;
            // ensure sections list contains this
            setSections((prev) => {
              if (prev.find((p) => String(p.id) === String(secObj.id))) return prev;
              return [secObj, ...prev];
            });
          } catch (e) {}
        }

            // Fetch students for the year level (then filter by section if selected)
            if (detectedYearLevel) {
              try {
                setLoadingStudents(true);
                const stuRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?year_level=${encodeURIComponent(String(detectedYearLevel))}`);
                const list = stuRes.data ?? stuRes.students ?? stuRes ?? [];
                if (Array.isArray(list)) {
                  // Only rebuild sections list from students if section wasn't already resolved
                  if (!sectionResolved) {
                    const sectionMap = new Map<string | number, { id: string | number; name: string }>();
                    list.forEach((st: any) => {
                      if (st.section_id && st.section_name) {
                        const key = st.section_id;
                        if (!sectionMap.has(key)) {
                          sectionMap.set(key, { id: st.section_id, name: String(st.section_name) });
                        }
                      }
                    });

                    const nextSections = sectionMap.size > 0
                      ? Array.from(sectionMap.values())
                      : [{ id: `default-${detectedYearLevel}`, name: String(detectedYearLevel) }];

                    setSections(nextSections);

                    if (sectionId && !String(sectionId).startsWith('default-')) {
                      const secMatch = nextSections.find((s) => String(s.id) === String(sectionId));
                      if (secMatch) { setSectionName(secMatch.name); sectionResolved = true; }
                    } else if (nextSections.length > 0) {
                      setSelectedSectionId(String(nextSections[0].id));
                      setSectionName(nextSections[0].name ?? null);
                      sectionResolved = true;
                    }
                  }

                  const activeSectionId = sectionId ?? null;
                  const filtered = activeSectionId && !String(activeSectionId).startsWith('default-')
                    ? list.filter((st: any) => String(st.section_id) === String(activeSectionId))
                    : list;

                  setStudents(filtered.map((st: any) => ({
                    id: st.student_id ?? st.id ?? st.user_id ?? String(st.id),
                    name: (st.first_name && st.last_name)
                      ? `${st.first_name} ${st.last_name}`
                      : (st.name ?? `${st.firstName ?? ''} ${st.lastName ?? ''}`).trim(),
                    email: st.email ?? st.user_email ?? '',
                    status: st.status ?? st.user_status ?? 'active'
                  })));
                } else {
                  setStudents([]);
                }
              } catch (e) {
                console.error('Failed to fetch students:', e);
                setStudents([]);
              } finally {
                setLoadingStudents(false);
              }
            } else if (sectionId && !String(sectionId).startsWith('default-')) {
              // Fallback: fetch by section_id only if year_level not detected
              try {
                setLoadingStudents(true);
                const stuRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?section_id=${String(sectionId)}`);
                const list = stuRes.data ?? stuRes.students ?? stuRes ?? [];
                if (Array.isArray(list)) {
                  setStudents(list.map((st: any) => ({ 
                    id: st.student_id ?? st.id ?? st.user_id ?? String(st.id), 
                    name: (st.first_name && st.last_name) ? `${st.first_name} ${st.last_name}` : (st.name ?? `${st.firstName ?? ''} ${st.lastName ?? ''}`).trim(), 
                    email: st.email ?? st.user_email ?? '', 
                    status: st.status ?? st.user_status ?? 'active' 
                  })));
                } else {
                  setStudents([]);
                }
              } catch (e) {
                console.error('Failed to fetch students by section:', e);
                setStudents([]);
              } finally {
                setLoadingStudents(false);
              }
            }
      } catch (e) {}
    };

    fetchInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, location.search]);

            // Fetch activities for the course with grading stats in a single request
  useEffect(() => {
    const effectiveCourseId = canonicalCourseId ?? courseId;
    if (!effectiveCourseId) return;
    const fetchActivities = async () => {
      try {
        const q = new URLSearchParams();
        q.set('course_id', String(effectiveCourseId));
        
        // Only add section_id if it's a valid integer (not null, not "default-")
        if (selectedSectionId && !String(selectedSectionId).startsWith('default-')) {
          const parsedSectionId = parseInt(String(selectedSectionId), 10);
          if (!isNaN(parsedSectionId)) {
            q.set('section_id', String(parsedSectionId));
          }
        }
        
        if (selectedAcademicPeriod) q.set('academic_period_id', String(selectedAcademicPeriod));
        if (courseYearLevel) q.set('year_level', String(courseYearLevel));
        
        console.log('Fetching activities with params:', {
          course_id: effectiveCourseId,
          section_id: selectedSectionId,
          academic_period_id: selectedAcademicPeriod,
          year_level: courseYearLevel
        });
        
        // Use optimized endpoint that returns activities with grading stats
        const endpoint = API_ENDPOINTS.ACTIVITIES_COURSE_WITH_STATS 
          ? `${API_ENDPOINTS.ACTIVITIES_COURSE_WITH_STATS}?${q.toString()}`
          : `${API_ENDPOINTS.ACTIVITIES}?${q.toString()}`;
        
        const res = await apiGet(endpoint);
        console.log('Activities API response:', res);
        const actList = res.data ?? res.activities ?? [];
        const totalStudents = Array.isArray(students) ? students.length : 0;

        if (Array.isArray(actList)) {
          const activitiesWithStats = actList.map((a: any) => {
            // Use grading_stats from API if available, otherwise compute from graded_count
            const gradedCount = a.grading_stats?.graded ?? a.graded_count ?? 0;
            const total = a.grading_stats?.total ?? totalStudents;
            const pending = Math.max(total - gradedCount, 0);
            const percentage = total > 0 ? Math.round((gradedCount / total) * 100) : 0;

            return {
              id: a.id,
              title: a.title,
              type: a.type,
              description: a.description,
              max_score: a.max_score,
              due_at: a.due_at,
              allow_late_submission: a.allow_late_submission,
              academic_period_id: a.academic_period_id,
              grading_stats: {
                total,
                graded: gradedCount,
                pending,
                percentage_graded: percentage,
              }
            };
          });

          setActivities(activitiesWithStats);
        }
      } catch (e) {
        // keep empty activities array as fallback
      }
    };

    fetchActivities();
  }, [courseId, canonicalCourseId, selectedSectionId, selectedAcademicPeriod, courseYearLevel, students.length]);

  // Refetch activities when window regains focus (e.g., coming back from quiz builder)
  useEffect(() => {
    const handleFocus = () => {
      const effectiveCourseId = canonicalCourseId ?? courseId;
      if (effectiveCourseId) {
        // Small delay to ensure database changes are committed
        setTimeout(async () => {
          try {
            const q = new URLSearchParams();
            q.set('course_id', String(effectiveCourseId));
            if (selectedSectionId && !String(selectedSectionId).startsWith('default-')) {
              const parsedSectionId = parseInt(String(selectedSectionId), 10);
              if (!isNaN(parsedSectionId)) {
                q.set('section_id', String(parsedSectionId));
              }
            }
            if (selectedAcademicPeriod) q.set('academic_period_id', String(selectedAcademicPeriod));
            if (courseYearLevel) q.set('year_level', String(courseYearLevel));
            
            const endpoint = API_ENDPOINTS.ACTIVITIES_COURSE_WITH_STATS 
              ? `${API_ENDPOINTS.ACTIVITIES_COURSE_WITH_STATS}?${q.toString()}`
              : `${API_ENDPOINTS.ACTIVITIES}?${q.toString()}`;
            
            const res = await apiGet(endpoint);
            const actList = res.data ?? res.activities ?? [];
            const totalStudents = Array.isArray(students) ? students.length : 0;

            if (Array.isArray(actList)) {
              const activitiesWithStats = actList.map((a: any) => {
                const gradedCount = a.grading_stats?.graded ?? a.graded_count ?? 0;
                const total = a.grading_stats?.total ?? totalStudents;
                const pending = Math.max(total - gradedCount, 0);
                const percentage = total > 0 ? Math.round((gradedCount / total) * 100) : 0;

                return {
                  id: a.id,
                  title: a.title,
                  type: a.type,
                  description: a.description,
                  max_score: a.max_score,
                  due_at: a.due_at,
                  allow_late_submission: a.allow_late_submission,
                  academic_period_id: a.academic_period_id,
                  grading_stats: { total, graded: gradedCount, pending, percentage_graded: percentage }
                };
              });
              setActivities(activitiesWithStats);
            }
          } catch (e) {
            console.error('Error refetching activities on focus:', e);
          }
        }, 300);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [courseId, canonicalCourseId, selectedSectionId, selectedAcademicPeriod, courseYearLevel, students.length]);

  // Fetch learning materials
  useEffect(() => {
    const effectiveCourseId = canonicalCourseId ?? courseId;
    if (!effectiveCourseId) return;

    const fetchLearningMaterials = async () => {
      try {
        // Parse section_id if available, but it's optional
        const parsedSectionId = selectedSectionId ? parseInt(String(selectedSectionId), 10) : null;
        const validSectionId = parsedSectionId && !isNaN(parsedSectionId) ? parsedSectionId : null;

        // Resolve school_year from the active period
        const schoolYear: string | undefined = selectedPeriod?.school_year || selectedPeriod?.year || undefined;

        // Fetch materials filtered by subject, section, and school year
        const endpoint = validSectionId
          ? API_ENDPOINTS.LEARNING_MATERIALS_BY_SUBJECT(effectiveCourseId, validSectionId, schoolYear)
          : `${API_ENDPOINTS.LEARNING_MATERIALS}/subject/${effectiveCourseId}${schoolYear ? `?school_year=${encodeURIComponent(schoolYear)}` : ''}`;

        const materials = await apiGet(endpoint);
        if (materials.success && Array.isArray(materials.data)) {
          setLearningMaterials(materials.data);
        }
      } catch (e) {
        console.error('Failed to fetch learning materials:', e);
      }
    };

    fetchLearningMaterials();
  }, [courseId, canonicalCourseId, selectedSectionId, selectedPeriod]);

  // Fetch student sidebar grades (bulk) when a student is selected
  useEffect(() => {
    if (!selectedStudent) {
      setStudentSidebarGrades(null);
      return;
    }
    const effectiveCourseId = canonicalCourseId ?? courseId;
    if (!effectiveCourseId) return;

    const fetchSidebarGrades = async () => {
      setLoadingStudentGrades(true);
      try {
        const q = new URLSearchParams();
        q.set('student_id', String(selectedStudent.id));
        q.set('course_id', String(effectiveCourseId));
        if (selectedSectionId && !String(selectedSectionId).startsWith('default-')) {
          q.set('section_id', String(selectedSectionId));
        }
        if (selectedAcademicPeriod) {
          q.set('academic_period_id', String(selectedAcademicPeriod));
        }
        const res = await apiGet(`${API_ENDPOINTS.STUDENT_SIDEBAR_GRADES}?${q.toString()}`);
        if (res.success) {
          setStudentSidebarGrades(res);
        }
      } catch (e) {
        console.error('Failed to fetch student sidebar grades:', e);
      } finally {
        setLoadingStudentGrades(false);
      }
    };

    fetchSidebarGrades();
  }, [selectedStudent, canonicalCourseId, courseId, selectedSectionId, selectedAcademicPeriod]);

  // Filter activities based on selected categories (empty = show all)
  const filteredActivities = activities.filter((a) => {
    if (!selectedCategories || selectedCategories.length === 0) return true;
    return selectedCategories.includes(a.type);
  });
  const filteredActivitiesLength = filteredActivities.length;

  // Helper function to format relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    // After a week, show the date
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header with enhanced title section */}
        <div className="border-b border-blue-100 px-8 py-6 shadow-sm">
          <Button variant="ghost" onClick={() => navigate("/teacher/courses")} className="mb-4 text-gray-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Subjects
          </Button>

          <div className="space-y-2">
            <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {courseInfo.title}
            </h1>
            <p className="text-xl text-gray-600 font-semibold">
              {courseInfo.code}
              {courseInfo.section && ` - ${courseInfo.section}`}
            </p>
            <div className="flex items-center gap-3">
              {courseInfo.section && (
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{courseInfo.section}</span>
              )}
              {selectedPeriod && selectedPeriod.status === 'active' && (
                <div className="ml-auto flex items-center gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 px-4 py-2 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-bold text-blue-900">
                    {selectedPeriod.school_year || selectedPeriod.year || 'N/A'}
                    {(selectedPeriod.quarter || selectedPeriod.semester || selectedPeriod.period_type) && ' - '}
                    {selectedPeriod.quarter || selectedPeriod.semester}
                    {selectedPeriod.period_type && !selectedPeriod.quarter && ` (${selectedPeriod.period_type})`}
                  </span>
                </div>
              )}
              <Button
                onClick={() => setIsStudentsPanelOpen(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-semibold gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                <Users className="h-4 w-4" />
                Students ({students.length})
              </Button>
            </div>
          </div>
        </div>

        {/* Main content area that fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <div className="grid gap-6 h-full grid-cols-2 p-6 min-h-0">
            {/* Activities column */}
            <div className="h-full min-h-0">
              <Card className="flex flex-col h-full border-0 rounded-lg shadow-md bg-white overflow-hidden min-h-0">
                <CardHeader className="bg-gradient-to-r from-primary/8 to-accent/8 border-b border-blue-100 px-6 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900">Activities</CardTitle>
                    <CardDescription className="text-sm text-gray-600 mt-1">Showing: {Math.min(filteredActivitiesLength, activities.length)} of {activities.length} activities</CardDescription>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {activityCategories.map((cat) => {
                        const info = getActivityTypeDisplay(cat);
                        const active = selectedCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
                            className={`text-xs inline-flex items-center gap-1 px-2 py-1 rounded-full transition-colors border ${active ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                            title={info.label}
                          >
                            <info.Icon className="h-3 w-3" />
                            <span className="sr-only">{info.label}</span>
                          </button>
                        );
                      })}

                      
                      {/* Clear filter button (shown when categories selected) */}
                      {selectedCategories.length > 0 && (
                        <button onClick={() => setSelectedCategories([])} className="text-xs ml-2 text-muted-foreground underline">Clear</button>
                      )}
                    </div>

                    {/* Academic Period Filter */}
                    <div className="mt-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Period</span>
                        </div>
                        <div className="flex gap-1.5">
                          {academicPeriods
                            .filter((period) => {
                              // Only show periods from the same school year as the active period
                              if (!selectedPeriod) return true;
                              const activeYear = selectedPeriod.school_year || selectedPeriod.year;
                              const periodYear = period.school_year || period.year;
                              return activeYear === periodYear;
                            })
                            .sort((a, b) => {
                              // Sort by quarter number (1st, 2nd, 3rd, 4th)
                              const getQuarterNum = (period: any) => {
                                const quarter = period.quarter || period.period_type || '';
                                const match = quarter.match(/(\d+)/);
                                return match ? parseInt(match[1]) : 0;
                              };
                              return getQuarterNum(a) - getQuarterNum(b);
                            })
                            .map((period) => {
                            const isSelected = selectedAcademicPeriod === String(period.id ?? period.academic_period_id);
                            const quarterLabel = period.quarter || period.period_type;
                            return (
                              <button
                                key={period.id ?? period.academic_period_id}
                                onClick={() => setSelectedAcademicPeriod(String(period.id ?? period.academic_period_id))}
                                className={`
                                  relative px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200
                                  flex items-center gap-1.5 border-2
                                  ${isSelected 
                                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-purple-500 shadow-md shadow-purple-200'
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }
                                `}
                              >
                                {period.status === 'active' && (
                                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'} animate-pulse`} />
                                )}
                                <span>{quarterLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      aria-pressed={viewType === "grid"}
                      title="Toggle list / grid"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewType((v) => (v === "list" ? "grid" : "list"))}
                      className="text-xs flex items-center gap-1 border-gray-300"
                    >
                      {viewType === "list" ? (
                        <LayoutGrid className="h-4 w-4" />
                      ) : (
                        <List className="h-4 w-4" />
                      )}
                    </Button>

                    {/* Edit Activity Dialog (uses Create dialog UI for consistent styling) */}
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                      <DialogContent className="max-w-2xl border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
                        <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                          <div>
                            <DialogTitle className="text-2xl font-bold text-white">Edit Activity</DialogTitle>
                            <p className="text-sm font-medium opacity-95 mt-2">Update the details for this activity.</p>
                            {selectedPeriod && selectedPeriod.status === 'active' && (
                              <div className="mt-3 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/30">
                                <p className="text-xs font-semibold opacity-90">Academic Period:</p>
                                <p className="text-sm font-bold">
                                  {selectedPeriod.school_year} - {selectedPeriod.name || selectedPeriod.quarter || selectedPeriod.period_name || 'Current Period'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="px-8 py-6 bg-white space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                          <div>
                            <Label htmlFor="edit-activity-title">Activity Title</Label>
                            <Input id="edit-activity-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Enter activity title" />
                          </div>
                          
                          <div>
                            <Label htmlFor="edit-activity-description">Description / Instructions</Label>
                            <div className="mt-2">
                              <ReactQuill
                                theme="snow"
                                value={editDescription}
                                onChange={setEditDescription}
                                placeholder="Add instructions, requirements, or notes for students..."
                                style={{ height: '150px', marginBottom: '50px' }}
                                modules={{
                                  toolbar: [
                                    [{ 'header': [1, 2, 3, false] }],
                                    ['bold', 'italic', 'underline'],
                                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                    ['link'],
                                    ['clean']
                                  ]
                                }}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="edit-activity-type">Type</Label>
                            <Select value={editType} onValueChange={(v) => setEditType(v)}>
                              <SelectTrigger id="edit-activity-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                               <SelectContent>
                                  <SelectItem value="worksheet">Worksheet</SelectItem>
                                  <SelectItem value="quiz">Quiz</SelectItem>
                                  <SelectItem value="exam">Exam</SelectItem>
                                  <SelectItem value="project">Project</SelectItem>
                                  <SelectItem value="art">Art</SelectItem>
                                  <SelectItem value="storytime">Storytime</SelectItem>
                                  <SelectItem value="recitation">Recitation</SelectItem>
                                  <SelectItem value="participation">Participation</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="edit-max-score">Maximum Score</Label>
                              <Input id="edit-max-score" type="number" value={editMaxScore} onChange={(e) => setEditMaxScore(e.target.value)} placeholder="100" />
                            </div>
                            <div>
                              <Label htmlFor="edit-due-date">Due Date <span className="text-amber-600">*</span></Label>
                              <Input id="edit-due-date" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <input
                              type="checkbox"
                              id="edit-allow-late-submission"
                              checked={editAllowLateSubmission}
                              onChange={(e) => setEditAllowLateSubmission(e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <Label htmlFor="edit-allow-late-submission" className="text-sm font-medium text-gray-700 cursor-pointer">
                              Allow late submissions
                            </Label>
                          </div>
                          
                          <div className="pt-2 flex items-center justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                            <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-full" onClick={async () => {
                              if (!editActivityId) return;
                              if (!editTitle) { setAlert({ type: 'error', message: 'Title is required' }); return; }
                              if (!editType) { setAlert({ type: 'error', message: 'Please select a category for the activity' }); return; }
                              if (editType !== 'quiz' && editType !== 'exam' && (!editMaxScore || Number(editMaxScore) <= 0)) { setAlert({ type: 'error', message: 'Please enter a valid maximum score (greater than 0)' }); return; }
                              try {
                                const payload: any = {
                                  title: editTitle,
                                  type: editType,
                                  max_score: (editType === 'quiz' || editType === 'exam') ? (editMaxScore || 0) : (Number(editMaxScore) || 0),
                                  due_at: editDueDate || null,
                                  description: editDescription || null,
                                  allow_late_submission: editAllowLateSubmission ? 1 : 0
                                };
                                const res = await apiPut(`${API_ENDPOINTS.ACTIVITIES}/${editActivityId}`, payload);
                                if (res && res.success && res.data) {
                                  const updated = res.data;
                                  if (!updated.grading_stats) updated.grading_stats = activities.find((x) => x.id === editActivityId)?.grading_stats ?? { total: 0, graded: 0, pending: 0, percentage_graded: 0 };
                                  setActivities((prev) => prev.map((a) => a.id === editActivityId ? ({ ...a, ...updated }) : a));
                                  setIsEditOpen(false);
                                  setAlert({ type: 'success', message: res.message ?? 'Activity updated' });
                                } else {
                                  setAlert({ type: 'error', message: res?.message ?? 'Failed to update activity' });
                                }
                              } catch (e) {
                                setAlert({ type: 'error', message: e instanceof Error ? e.message : 'Error updating activity' });
                              }
                            }}>Save Changes</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={!!deleteActivity} onOpenChange={(open) => !open && setDeleteActivity(null)}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Delete Activity?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-gray-600">
                          Are you sure you want to delete "{deleteActivity?.title ?? 'this activity'}"? This action may remove it from the students' activity list.
                        </p>
                        <div className="flex items-center justify-end gap-3 pt-4">
                          <Button variant="outline" onClick={() => setDeleteActivity(null)} disabled={!!deletingActivityId}>Cancel</Button>
                          <Button
                            onClick={handleDeleteActivity}
                            disabled={!!deletingActivityId}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            {deletingActivityId ? 'Deleting...' : 'Delete Activity'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                        <Button size="sm" onClick={() => setIsAddOpen(true)} className="text-xs bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md rounded-full">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Activity
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
                        <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                          <div>
                            <DialogTitle className="text-2xl font-bold text-white">Create New Activity</DialogTitle>
                            <p className="text-sm font-medium opacity-95 mt-2">Create a new activity for this course.</p>
                            {selectedPeriod && selectedPeriod.status === 'active' && (
                              <div className="mt-3 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/30">
                                <p className="text-xs font-semibold opacity-90">Academic Period:</p>
                                <p className="text-sm font-bold">
                                  {selectedPeriod.school_year} - {selectedPeriod.name || selectedPeriod.quarter || selectedPeriod.period_name || 'Current Period'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="px-8 py-6 bg-white space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                          <div>
                            <Label htmlFor="activity-title">Activity Title</Label>
                            <Input id="activity-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Enter activity title" />
                          </div>
                          
                          <div>
                            <Label htmlFor="activity-description">Description / Instructions</Label>
                            <div className="mt-2">
                              <ReactQuill
                                theme="snow"
                                value={newDescription}
                                onChange={setNewDescription}
                                placeholder="Add instructions, requirements, or notes for students..."
                                style={{ height: '150px', marginBottom: '50px' }}
                                modules={{
                                  toolbar: [
                                    [{ 'header': [1, 2, 3, false] }],
                                    ['bold', 'italic', 'underline'],
                                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                    ['link'],
                                    ['clean']
                                  ]
                                }}
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="activity-type">Type</Label>
                            <Select value={newType} onValueChange={(v) => setNewType(v)}>
                              <SelectTrigger id="activity-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                               <SelectContent>
                                  <SelectItem value="worksheet">Worksheet</SelectItem>
                                  <SelectItem value="quiz">Quiz</SelectItem>
                                  <SelectItem value="exam">Exam</SelectItem>
                                  <SelectItem value="project">Project</SelectItem>
                                  <SelectItem value="art">Art</SelectItem>
                                  <SelectItem value="storytime">Storytime</SelectItem>
                                  <SelectItem value="recitation">Recitation</SelectItem>
                                  <SelectItem value="participation">Participation</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {newType !== 'quiz' && newType !== 'exam' && (
                              <div>
                                <Label htmlFor="max-score">Maximum Score</Label>
                                <Input id="max-score" type="number" value={newMaxScore} onChange={(e) => setNewMaxScore(e.target.value)} placeholder="100" />
                              </div>
                            )}
                            {(newType === 'quiz' || newType === 'exam') && (
                              <div className="col-span-1">
                                <Label className="text-sm text-gray-600">Maximum Score</Label>
                                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-xs text-blue-800">
                                    Score will be calculated from quiz questions. Configure questions after saving.
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className={(newType === 'quiz' || newType === 'exam') ? 'col-span-1' : ''}>
                              <Label htmlFor="due-date">Due Date <span className="text-amber-600">*</span></Label>
                              <Input id="due-date" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <input
                              type="checkbox"
                              id="allow-late-submission"
                              checked={newAllowLateSubmission}
                              onChange={(e) => setNewAllowLateSubmission(e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <Label htmlFor="allow-late-submission" className="text-sm font-medium text-gray-700 cursor-pointer">
                              Allow late submissions
                            </Label>
                          </div>
                          
                          <div className="pt-2">
                            <Button className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-full" disabled={!newTitle || !newType || !newDueDate || (!newMaxScore && newType !== 'quiz' && newType !== 'exam')} onClick={async () => {
                              // validate
                              const effectiveCourseId = canonicalCourseId ?? courseId;
                              if (!newTitle || !effectiveCourseId) {
                                setAlert({ type: 'error', message: 'Please fill in title and ensure course is loaded' });
                                return;
                              }
                              if (!newType) {
                                setAlert({ type: 'error', message: 'Please select a category for the activity' });
                                return;
                              }
                              if (newType !== 'quiz' && newType !== 'exam' && (!newMaxScore || Number(newMaxScore) <= 0)) {
                                setAlert({ type: 'error', message: 'Please enter a valid maximum score (greater than 0)' });
                                return;
                              }
                              if (!newDueDate) {
                                setAlert({ type: 'error', message: 'Please select a due date for the activity' });
                                return;
                              }
                              
                              // Check if there's an active academic period
                              if (!selectedPeriod || selectedPeriod.status !== 'active') {
                                setAlert({ type: 'error', message: 'No active academic period found. Please contact administrator.' });
                                return;
                              }

                              try {
                                // Resolve section_id: prefer the current selectedSectionId, otherwise
                                // fall back to the first real section in state (handles the case where
                                // selectedSectionId is still null or a synthetic "default-" placeholder).
                                const rawSectionId = selectedSectionId ?? null;
                                const validSectionId = (rawSectionId && !String(rawSectionId).startsWith('default-'))
                                  ? rawSectionId
                                  : (sections.find((s) => s.id && !String(s.id).startsWith('default-'))?.id ?? null);

                                if (!validSectionId) {
                                  setAlert({ type: 'error', message: 'No section is selected. Please select a section from the dropdown before creating an activity.' });
                                  return;
                                }
                                
                                const res = await apiPost(API_ENDPOINTS.ACTIVITIES, {
                                  course_id: effectiveCourseId,
                                  section_id: validSectionId,
                                  title: newTitle,
                                  description: newDescription || null,
                                  type: newType,
                                  max_score: (newType === 'quiz' || newType === 'exam') ? 0 : (Number(newMaxScore) || 100),
                                  due_at: newDueDate || null,
                                  allow_late_submission: newAllowLateSubmission ? 1 : 0,
                                  academic_period_id: selectedPeriod.id, // Link to active academic period
                                });

                                if (res.success && res.data) {
                                  const newActivity = res.data;
                                  if (!newActivity.grading_stats) {
                                    newActivity.grading_stats = { total: 0, graded: 0, pending: 0, percentage_graded: 0 };
                                  }
                                  setActivities((prev) => [newActivity, ...prev]);
                                  setNewTitle("");
                                  setNewType("");
                                  setNewDescription("");
                                  setNewMaxScore("");
                                  setNewDueDate("");
                                  setNewAllowLateSubmission(true);
                                  setIsAddOpen(false);
                                  setAlert({ type: 'success', message: `Activity created for ${selectedPeriod.school_year} - ${selectedPeriod.name || selectedPeriod.quarter || selectedPeriod.period_name || 'Current Period'}` });
                                } else {
                                  setAlert({ type: 'error', message: 'Failed to create activity: ' + (res.message || 'Unknown error') });
                                }
                              } catch (e) {
                                setAlert({ type: 'error', message: 'Error: ' + (e instanceof Error ? e.message : 'Unknown error') });
                              }
                            }}>Create Activity</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
                {/* scrollable container for activities */}
                <div className="space-y-0 h-full overflow-y-auto pr-3 pb-6 scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-blue-50 hover:scrollbar-thumb-blue-500">
                  {activities.length === 0 ? (
                    <div className="p-8 text-center">
                      <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No activities yet. Create one to get started.</p>
                    </div>
                  ) : filteredActivities.length === 0 ? (
                    <div className="p-8 text-center">
                      <ClipboardList className="h-12 w-12 text-gray-100 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No activities match the selected categories.</p>
                    </div>
                  ) : viewType === "list" && filteredActivities.map((activity) => {
                    // Compute stats using current students count (not stale fetch-time data)
                    const gradedCount = activity.grading_stats?.graded ?? 0;
                    const totalStudents = students.length;
                    const pending = Math.max(totalStudents - gradedCount, 0);
                    const percentage = totalStudents > 0 ? Math.round((gradedCount / totalStudents) * 100) : 0;
                    const stats = { total: totalStudents, graded: gradedCount, pending, percentage_graded: percentage };
                    return (
                    <div key={activity.id} className="p-5 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-b-0">
                      <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                          <p className="font-semibold text-base text-gray-900">{activity.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {(() => {
                              const typeInfo = getActivityTypeDisplay(activity.type);
                              const IconComponent = typeInfo.Icon;
                              return (
                                <Badge className={`text-xs py-1 px-2 border gap-1 flex items-center ${typeInfo.bgColor} ${typeInfo.color}`}>
                                  <IconComponent className="h-3 w-3" />
                                  {typeInfo.label}
                                </Badge>
                              );
                            })()}
                            <span className="text-xs text-gray-500 font-medium">{activity.max_score} points</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 flex-shrink-0">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">{activity.due_at ? new Date(activity.due_at).toLocaleDateString() : 'No due date'}</span>
                        </div>
                      </div>
                      <div className="mt-4 mb-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 font-medium">Grading Progress</span>
                          <span className="font-bold text-blue-600">{stats.graded}/{stats.total}</span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                          <div 
                            className="h-full rounded-full transition-all duration-300" 
                            style={{
                              width: `${stats.percentage_graded}%`,
                              background: stats.percentage_graded === 100 ? '#10b981' : stats.percentage_graded >= 50 ? '#2563eb' : '#f59e0b',
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          {stats.pending === 0 && stats.total > 0 ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-green-600 font-medium">All graded</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                              <span className="text-amber-600 font-medium">{stats.pending} pending</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {(activity.type === 'worksheet' || activity.type === 'project' || activity.type === 'art' || activity.type === 'other') && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => navigate(`/teacher/courses/${canonicalCourseId ?? courseId}/activities/${activity.id}/outputs${selectedSectionId ? `?section_id=${selectedSectionId}` : ''}`)}
                              className="h-9 w-9 p-0 bg-white text-gray-700 border border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                              title="View Outputs"
                              aria-label="View activity outputs"
                            >
                              <FileIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {(activity.type === 'quiz' || activity.type === 'exam') && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => navigate(`/teacher/courses/${canonicalCourseId ?? courseId}/activities/${activity.id}/review${selectedSectionId ? `?section_id=${selectedSectionId}` : ''}`)}
                                className="h-9 w-9 p-0 bg-white text-gray-700 border border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                title="Review"
                                aria-label="Review activity"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/teacher/courses/${canonicalCourseId ?? courseId}/activities/${activity.id}/quiz-builder`)}
                                className="h-9 w-9 p-0 border border-gray-300 text-gray-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300"
                                title="Configure"
                                aria-label="Configure activity"
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditActivity(activity)}
                            className="h-9 w-9 p-0 border border-gray-300 text-gray-700 hover:bg-gray-100"
                            title="Edit"
                            aria-label="Edit activity"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteActivity(activity)}
                            className="h-9 w-9 p-0 border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                            title="Delete"
                            aria-label="Delete activity"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    );
                  })}

                  {viewType === "grid" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredActivities.map((activity) => {
                        // Compute stats using current students count (not stale fetch-time data)
                        const gradedCount = activity.grading_stats?.graded ?? 0;
                        const totalStudents = students.length;
                        const pending = Math.max(totalStudents - gradedCount, 0);
                        const percentage = totalStudents > 0 ? Math.round((gradedCount / totalStudents) * 100) : 0;
                        const stats = { total: totalStudents, graded: gradedCount, pending, percentage_graded: percentage };
                        return (
                        <div key={activity.id} className="p-4 border border-border rounded-lg hover:shadow-md transition-shadow bg-card flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="font-semibold text-sm leading-tight">{activity.title}</p>
                              </div>
                              {(() => {
                                const typeInfo = getActivityTypeDisplay(activity.type);
                                const IconComponent = typeInfo.Icon;
                                return (
                                  <Badge className={`text-xs py-1 px-2 border gap-1 flex items-center ${typeInfo.bgColor} ${typeInfo.color} flex-shrink-0`}>
                                    <IconComponent className="h-3 w-3" />
                                    {typeInfo.label}
                                  </Badge>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                              <Clock className="h-3 w-3" />
                              <span>{activity.due_at ? new Date(activity.due_at).toLocaleDateString() : 'No due date'}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-medium">Grading</span>
                                <span className="font-bold text-primary">{stats.graded}/{stats.total}</span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                                <div 
                                  className="h-full rounded-full transition-all duration-300" 
                                  style={{
                                    width: `${stats.percentage_graded}%`,
                                    background: stats.percentage_graded === 100 ? '#10b981' : stats.percentage_graded >= 50 ? '#2563eb' : '#f59e0b',
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 text-xs">
                              {stats.pending === 0 && stats.total > 0 ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  <span className="text-green-600 font-medium">Complete</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                  <span className="text-amber-600 font-medium">{stats.pending} left</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {(activity.type === 'worksheet' || activity.type === 'project' || activity.type === 'art' || activity.type === 'other') && (
                                <Button 
                                  size="sm" 
                                  variant="default" 
                                  onClick={() => navigate(`/teacher/courses/${canonicalCourseId ?? courseId}/activities/${activity.id}/outputs${selectedSectionId ? `?section_id=${selectedSectionId}` : ''}`)}
                                  className="h-8 w-8 p-0 bg-white text-gray-700 border border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300 shadow-sm"
                                  title="View Outputs"
                                  aria-label="View activity outputs"
                                >
                                  <FileIcon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {(activity.type === 'quiz' || activity.type === 'exam') && (
                                <>
                                  <Button 
                                    size="sm" 
                                    variant="default" 
                                    onClick={() => navigate(`/teacher/courses/${canonicalCourseId ?? courseId}/activities/${activity.id}/review${selectedSectionId ? `?section_id=${selectedSectionId}` : ''}`)}
                                    className="h-8 w-8 p-0 bg-white text-gray-700 border border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300 shadow-sm"
                                    title="Review"
                                    aria-label="Review activity"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => navigate(`/teacher/courses/${canonicalCourseId ?? courseId}/activities/${activity.id}/quiz-builder`)}
                                    className="h-8 w-8 p-0 border border-gray-300 text-gray-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300"
                                    title="Configure"
                                    aria-label="Configure activity"
                                  >
                                    <Settings className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => openEditActivity(activity)}
                                className="h-8 w-8 p-0 border border-gray-300 text-gray-700 hover:bg-gray-100"
                                title="Edit"
                                aria-label="Edit activity"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteActivity(activity)}
                                className="h-8 w-8 p-0 border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                title="Delete"
                                aria-label="Delete activity"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
              {/* Render alert messages at the bottom like admin pages */}
              {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
            </Card>
            </div>

            {/* Learning Materials column */}
            <div className="h-full min-h-0">
            <Card className="flex flex-col h-full border-0 rounded-lg shadow-md bg-white overflow-hidden min-h-0">
              <CardHeader className="bg-gradient-to-r from-primary/8 to-accent/8 border-b border-blue-100 px-6 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold text-gray-900">Learning Materials</CardTitle>
                    <CardDescription className="text-sm text-gray-600 mt-1">{learningMaterials.length} materials shared</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={isAddMaterialOpen} onOpenChange={(open) => {
                      setIsAddMaterialOpen(open);
                      // Reset state when dialog closes
                      if (!open) {
                        setEditingMaterialId(null);
                        setMaterialTitle('');
                        setMaterialDescription('');
                        setMaterialFiles([]);
                        setMaterialLinks(['']);
                        setMaterialType('text');
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => {
                          // Reset to add mode
                          setEditingMaterialId(null);
                          setMaterialTitle('');
                          setMaterialDescription('');
                          setMaterialFiles([]);
                          setMaterialLinks(['']);
                          setMaterialType('text');
                          setIsAddMaterialOpen(true);
                        }} className="text-xs bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-full shadow-md">
                          <Upload className="h-4 w-4 mr-1" />
                          Add Material
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
                        <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                          <div>
                            <DialogTitle className="text-2xl font-bold text-white">{editingMaterialId ? 'Edit Learning Material' : 'Add Learning Material'}</DialogTitle>
                            <p className="text-sm font-medium opacity-95 mt-2">Share learning materials with your students.</p>
                          </div>
                        </div>
                        <div className="px-8 py-6 bg-white space-y-6 overflow-y-auto max-h-[calc(90vh-150px)]">
  {/* Material Type Selection */}
  <div>
    <Label>Material Type</Label>
    <div className="flex gap-2 mt-2">
      <Button
        type="button"
        variant={materialType === "text" ? "default" : "outline"}
        className="flex-1"
        onClick={() => setMaterialType("text")}
      >
        <FileText className="h-4 w-4 mr-2" />
        Compose Text
      </Button>
      <Button
        type="button"
        variant={materialType === "file" ? "default" : "outline"}
        className="flex-1"
        onClick={() => setMaterialType("file")}
      >
        <Upload className="h-4 w-4 mr-2" />
        Upload File
      </Button>
      <Button
        type="button"
        variant={materialType === "link" ? "default" : "outline"}
        className="flex-1"
        onClick={() => setMaterialType("link")}
      >
        <FileIcon className="h-4 w-4 mr-2" />
        Share Link
      </Button>
    </div>
  </div>

  <div>
    <Label htmlFor="material-title">Material Title</Label>
    <Input
      id="material-title"
      value={materialTitle}
      onChange={(e) => setMaterialTitle(e.target.value)}
      placeholder="e.g., Chapter 3: Photosynthesis"
    />
  </div>
  <div>
    <Label htmlFor="material-description">Description</Label>
                            <div className="mt-2">
                              <ReactQuill
                                theme="snow"
                                value={materialDescription}
                                onChange={setMaterialDescription}
                                placeholder="Add description, instructions, or notes for your students..."
                                style={{ height: '200px', marginBottom: '50px' }}
                                modules={{
                                  toolbar: [
                                    [{ 'header': [1, 2, 3, false] }],
                                    ['bold', 'italic', 'underline', 'strike'],
                                    [{ 'color': [] }, { 'background': [] }],
                                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                    [{ 'align': [] }],
                                    ['link', 'image'],
                                    ['clean']
                                  ]
                                }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Use the toolbar above to format your text with rich styling</p>
                          </div>

                          {materialType === "text" ? (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-800">
                                <strong>Compose Mode:</strong> Write your learning material directly using the rich text editor above. No file upload or link needed.
                              </p>
                            </div>
                          ) : materialType === "file" ? (
                            <div>
                              <Label htmlFor="material-file">File Upload (Max 50MB per file)</Label>
                              <div className="mt-2">
                                <input
                                  id="material-file"
                                  type="file"
                                  multiple
                                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.xls,.xlsx,.jpg,.jpeg,.png,.mp4,.zip"
                                  onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    const maxSize = 50 * 1024 * 1024; // 50MB
                                    const invalidFiles = files.filter(f => f.size > maxSize);
                                    
                                    if (invalidFiles.length > 0) {
                                      setAlert({ type: 'error', message: `${invalidFiles.length} file(s) exceed 50MB limit: ${invalidFiles.map(f => f.name).join(', ')}` });
                                      return;
                                    }
                                    
                                    setMaterialFiles(files);
                                  }}
                                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {materialFiles.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {materialFiles.map((file, idx) => (
                                      <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                                        <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                                            onClick={() => setMaterialFiles(materialFiles.filter((_, i) => i !== idx))}
                                          >
                                            <X className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Label htmlFor="material-link">Link URLs</Label>
                              <div className="space-y-2 mt-2">
                                {materialLinks.map((link, index) => (
                                  <div key={index} className="flex gap-2">
                                    <Input
                                      type="url"
                                      value={link}
                                      onChange={(e) => {
                                        const newLinks = [...materialLinks];
                                        newLinks[index] = e.target.value;
                                        setMaterialLinks(newLinks);
                                      }}
                                      placeholder="https://www.youtube.com/watch?v=..."
                                    />
                                    {materialLinks.length > 1 && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setMaterialLinks(materialLinks.filter((_, i) => i !== index));
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setMaterialLinks([...materialLinks, ""])}
                                  className="w-full"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Another Link
                                </Button>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">YouTube, Google Drive, or any web link</p>
                            </div>
                          )}
                          <div className="flex gap-3 pt-4">
                            <Button
                              onClick={async () => {
                                if (!materialTitle.trim()) {
                                  setAlert({ type: 'error', message: 'Please enter a title' });
                                  return;
                                }
                                if (materialType === 'text' && !materialDescription.trim()) {
                                  setAlert({ type: 'error', message: 'Please add some content in the description' });
                                  return;
                                }
                                if (materialType === 'file' && materialFiles.length === 0) {
                                  setAlert({ type: 'error', message: 'Please select at least one file to upload' });
                                  return;
                                }
                                if (materialType === 'link' && !materialLinks.some(link => link.trim())) {
                                  setAlert({ type: 'error', message: 'Please enter at least one link URL' });
                                  return;
                                }
                                
                                                                try {
                                  const effectiveCourseId = canonicalCourseId ?? courseId;
                                  let fileUrls: string[] = [];
                                  let fileNames: string[] = [];
                                  let totalFileSize = 0;
                                  
                                  // Upload files to Hostinger storage if type is 'file'
                                  if (materialType === 'file' && materialFiles.length > 0) {
                                    setAlert({ type: 'info', message: `Uploading ${materialFiles.length} file(s) to server...` });
                                    
                                    for (const file of materialFiles) {
                                      const uploadResult = await apiUpload(API_ENDPOINTS.UPLOAD_FILE, file, 'file', {
                                        folder: 'learning-materials',
                                        subject_id: String(effectiveCourseId),
                                      });
                                      fileUrls.push(uploadResult.file_url || uploadResult.url);
                                      fileNames.push(file.name);
                                      totalFileSize += file.size;
                                    }
                                  }
                                  
                                  // Parse section_id to ensure it's a valid integer (or null)
                                  const parsedSectionId = selectedSectionId ? parseInt(String(selectedSectionId), 10) : null;
                                  const validSectionId = parsedSectionId && !isNaN(parsedSectionId) ? parsedSectionId : null;
                                  
                                  // Prepare links data (filter out empty links)
                                  const validLinks = materialType === 'link' ? materialLinks.filter(link => link.trim()) : [];
                                  const linksData = validLinks.length > 0 ? JSON.stringify(validLinks) : (validLinks[0] || null);
                                  
                                  // Save learning material to database (scoped to active school year)
                                  const materialData = {
                                    subject_id: effectiveCourseId,
                                    section_id: validSectionId,
                                    school_year: selectedPeriod?.school_year || selectedPeriod?.year || null,
                                    type: materialType,
                                    title: materialTitle,
                                    description: materialDescription,
                                    file_url: materialType === 'file' && fileUrls.length > 0 ? JSON.stringify(fileUrls) : (editingMaterialId ? undefined : null),
                                    file_name: materialType === 'file' && fileNames.length > 0 ? JSON.stringify(fileNames) : (editingMaterialId ? undefined : null),
                                    file_size: materialType === 'file' ? totalFileSize : (editingMaterialId ? undefined : null),
                                    link_url: materialType === 'link' ? linksData : null,
                                    created_by: user?.id,
                                  };
                                  
                                  let result;
                                  if (editingMaterialId) {
                                    // Update existing material
                                    result = await apiPut(`${API_ENDPOINTS.LEARNING_MATERIALS}/${editingMaterialId}`, materialData);
                                    // Update in local state
                                    setLearningMaterials(learningMaterials.map(m => 
                                      m.id === editingMaterialId ? { ...m, ...result.data } : m
                                    ));
                                    setAlert({ type: 'success', message: 'Learning material updated successfully!' });
                                  } else {
                                    // Create new material
                                    result = await apiPost(API_ENDPOINTS.LEARNING_MATERIALS, materialData);
                                    // Add to local state with server data
                                    const newMaterial = {
                                      id: result.id || result.data?.id || Date.now(),
                                      type: materialType,
                                      title: materialTitle,
                                      description: materialDescription,
                                      file_url: materialType === 'file' && fileUrls.length > 0 ? JSON.stringify(fileUrls) : null,
                                      file_name: materialType === 'file' && fileNames.length > 0 ? JSON.stringify(fileNames) : null,
                                      file_size: totalFileSize,
                                      link_url: materialType === 'link' ? linksData : null,
                                      created_at: new Date().toISOString(),
                                    };
                                    setLearningMaterials([newMaterial, ...learningMaterials]);
                                    setAlert({ type: 'success', message: 'Learning material added successfully!' });
                                  }
                                  
                                  // Reset form
                                  setMaterialTitle('');
                                  setMaterialDescription('');
                                  setMaterialFiles([]);
                                  setMaterialLinks(['']);
                                  setEditingMaterialId(null);
                                  setIsAddMaterialOpen(false);
                                } catch (error: any) {
                                  console.error('Error adding learning material:', error);
                                  setAlert({ type: 'error', message: error.message || 'Failed to add learning material' });
                                }
                              }}
                              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
                            >
                              {editingMaterialId ? 'Update Material' : 'Add Material'}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsAddMaterialOpen(false);
                                setMaterialTitle('');
                                setMaterialDescription('');
                                setMaterialFiles([]);
                                setMaterialLinks(['']);
                                setEditingMaterialId(null);
                              }}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0 min-h-0">
                <div className="h-full overflow-y-auto pr-3 pb-6 scrollbar-thin scrollbar-thumb-blue-400 scrollbar-track-blue-50 hover:scrollbar-thumb-blue-500">
                  {learningMaterials.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileIcon className="h-12 w-12 text-gray-300 mb-3" />
                      <p className="text-gray-500 text-sm">No learning materials yet.</p>
                      <p className="text-gray-400 text-xs mt-1">Share files or links with your students</p>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4">
                      {learningMaterials.map((material) => {
                        // Helper function to get YouTube video ID
                        const getYouTubeId = (url: string) => {
                          const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
                          const match = url.match(regExp);
                          return (match && match[7].length === 11) ? match[7] : null;
                        };

                        // Parse links (could be JSON array or single string)
                        let links: string[] = [];
                        if (material.type === 'link' && material.link_url) {
                          try {
                            const parsed = JSON.parse(material.link_url);
                            links = Array.isArray(parsed) ? parsed : [material.link_url];
                          } catch {
                            links = [material.link_url];
                          }
                        }

                        // Get YouTube IDs for all links
                        const youtubeLinks = links.map(link => ({
                          url: link,
                          youtubeId: getYouTubeId(link)
                        })).filter(item => item.youtubeId);

                        const hasMultipleLinks = links.length > 1;

                        return (
                          <div key={material.id} className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
                            <div className="flex gap-4">
                              {/* Icon */}
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                                material.type === 'file' ? 'bg-gradient-to-br from-blue-50 to-blue-100 ring-2 ring-blue-200' : 
                                material.type === 'link' ? 'bg-gradient-to-br from-purple-50 to-purple-100 ring-2 ring-purple-200' : 
                                'bg-gradient-to-br from-green-50 to-green-100 ring-2 ring-green-200'
                              }`}>
                                {material.type === 'file' ? (
                                  <FileText className="h-6 w-6 text-blue-600" />
                                ) : material.type === 'link' ? (
                                  <FileIcon className="h-6 w-6 text-purple-600" />
                                ) : (
                                  <FileText className="h-6 w-6 text-green-600" />
                                )}
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                {/* Header with Title and Badge */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <h4 className="font-bold text-gray-900 text-base leading-tight">{material.title}</h4>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs font-semibold px-3 py-1 flex-shrink-0 ${
                                      material.type === 'file' ? 'bg-blue-50 text-blue-700 border-blue-300' : 
                                      material.type === 'link' ? 'bg-purple-50 text-purple-700 border-purple-300' : 
                                      'bg-green-50 text-green-700 border-green-300'
                                    }`}
                                  >
                                    {material.type === 'file' ? '📎 File' : material.type === 'link' ? '🔗 Link' : '📝 Text'}
                                  </Badge>
                                </div>
                                
                                {/* Description */}
                                {material.description && (
                                  <div 
                                    className="text-sm text-gray-700 mt-2 mb-3 leading-relaxed prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: material.description }}
                                  />
                                )}
                                
                                {/* Extract links from description for file type materials */}
                                {(() => {
                                  // Helper to extract URLs from HTML description
                                  const extractLinksFromDescription = (html: string) => {
                                    const tempDiv = document.createElement('div');
                                    tempDiv.innerHTML = html;
                                    const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
                                    const textContent = tempDiv.textContent || '';
                                    const matches = textContent.match(urlRegex) || [];
                                    return matches;
                                  };

                                  const getYouTubeId = (url: string) => {
                                    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
                                    const match = url.match(regExp);
                                    return (match && match[7].length === 11) ? match[7] : null;
                                  };

                                  // For file type materials, extract links from description
                                  if (material.type === 'file' && material.description) {
                                    const descLinks = extractLinksFromDescription(material.description);
                                    const descYoutubeLinks = descLinks.map(link => ({
                                      url: link,
                                      youtubeId: getYouTubeId(link)
                                    })).filter(item => item.youtubeId);

                                    if (descYoutubeLinks.length > 0) {
                                      return (
                                        <div className={`mt-3 mb-3 ${descYoutubeLinks.length > 1 ? 'grid grid-cols-2 gap-1.5 max-w-md' : 'max-w-xs'}`}>
                                          {descYoutubeLinks.map((item, idx) => (
                                            <a
                                              key={idx}
                                              href={item.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="block rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow border-2 border-gray-200 w-full"
                                            >
                                              <img
                                                src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`}
                                                alt={`Video ${idx + 1}`}
                                                className="w-full h-auto"
                                              />
                                            </a>
                                          ))}
                                        </div>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                                
                                {/* YouTube Thumbnails for link type */}
                                {material.type === 'link' && youtubeLinks.length > 0 && (
                                  <div className={`mt-3 mb-3 ${hasMultipleLinks ? 'grid grid-cols-2 gap-1.5 max-w-md' : 'max-w-xs'}`}>
                                    {youtubeLinks.map((item, idx) => (
                                      <a
                                        key={idx}
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow border-2 border-gray-200 w-full"
                                      >
                                        <img
                                          src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`}
                                          alt={`Video ${idx + 1}`}
                                          className="w-full h-auto"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                )}

                                {/* File/Link Details */}
                                <div className="flex flex-col gap-2 mt-3">
                                  {material.type === 'file' ? (
                                    <div className="space-y-2">
                                      {(() => {
                                        // Parse file URLs and names (could be JSON array or single string)
                                        let fileUrls: string[] = [];
                                        let fileNames: string[] = [];
                                        
                                        try {
                                          const parsedUrls = JSON.parse(material.file_url || '[]');
                                          fileUrls = Array.isArray(parsedUrls) ? parsedUrls : [material.file_url];
                                        } catch {
                                          fileUrls = material.file_url ? [material.file_url] : [];
                                        }
                                        
                                        try {
                                          const parsedNames = JSON.parse(material.file_name || '[]');
                                          fileNames = Array.isArray(parsedNames) ? parsedNames : [material.file_name];
                                        } catch {
                                          fileNames = material.file_name ? [material.file_name] : [];
                                        }
                                        
                                        return fileUrls.map((url, idx) => (
                                          <div key={idx} className="flex items-center gap-2">
                                            <a
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg flex-1"
                                            >
                                              <Upload className="h-4 w-4" />
                                              {fileNames[idx] || `File ${idx + 1}`}
                                            </a>
                                          </div>
                                        ));
                                      })()}
                                      {material.file_size && (
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">
                                            Total: {(material.file_size / 1024 / 1024).toFixed(2)} MB
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ) : material.type === 'link' ? (
                                    <div className="space-y-2">
                                      {links.map((link, idx) => {
                                        const hasThumb = youtubeLinks.find(yt => yt.url === link);
                                        // Only show link text if it doesn't have a thumbnail
                                        if (!hasThumb) {
                                          return (
                                            <a
                                              key={idx}
                                              href={link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg break-all"
                                            >
                                              <FileIcon className="h-4 w-4 flex-shrink-0" />
                                              {link}
                                            </a>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                                
                                {/* Timestamp */}
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                                  <p className="text-xs text-gray-500 font-medium">
                                    Added {getRelativeTime(material.created_at || material.uploadedAt)}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex flex-col gap-2 items-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-9 w-9 p-0 rounded-lg border border-transparent hover:border-blue-200"
                                  onClick={() => {
                                    // Populate form with material data for editing
                                    setEditingMaterialId(material.id);
                                    setMaterialType(material.type);
                                    setMaterialTitle(material.title);
                                    setMaterialDescription(material.description || '');
                                    
                                    // Parse links if it's a link type
                                    if (material.type === 'link' && material.link_url) {
                                      try {
                                        const links = JSON.parse(material.link_url);
                                        setMaterialLinks(Array.isArray(links) ? links : [material.link_url]);
                                      } catch {
                                        setMaterialLinks([material.link_url]);
                                      }
                                    }
                                    
                                    setIsAddMaterialOpen(true);
                                  }}
                                  title="Edit material"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0 rounded-lg border border-transparent hover:border-red-200"
                                  onClick={async () => {
                                    if (!confirm('Are you sure you want to delete this material?')) return;
                                    try {
                                      await apiDelete(`${API_ENDPOINTS.LEARNING_MATERIALS}/${material.id}`);
                                      setLearningMaterials(learningMaterials.filter(m => m.id !== material.id));
                                      setAlert({ type: 'success', message: 'Material deleted successfully' });
                                    } catch (error) {
                                      console.error('Error deleting material:', error);
                                      setAlert({ type: 'error', message: 'Failed to delete material' });
                                    }
                                  }}
                                  title="Delete material"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>

        {/* Alert messages at the bottom */}
        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

        {/* Students Side Panel */}
        {isStudentsPanelOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div 
              className="absolute inset-0 bg-black/40 transition-opacity"
              onClick={() => {
                if (!selectedStudent) {
                  setIsStudentsPanelOpen(false);
                }
              }}
            />
            {/* Panel */}
            <div className="relative ml-auto w-full max-w-2xl bg-background shadow-2xl flex flex-col border-l border-border">
              {!selectedStudent ? (
                // Students List View
                <>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-green-600 to-emerald-500 p-6 text-white flex items-center justify-between border-b border-emerald-200">
                    <div>
                      <h2 className="text-2xl font-bold">Students</h2>
                      <p className="text-sm opacity-90 mt-1">{courseInfo.title} - {students.length} student(s)</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsStudentsPanelOpen(false);
                        setStudentSearchQuery("");
                      }}
                      className="p-1 hover:bg-white/20 rounded-lg transition-all"
                      title="Close panel"
                      aria-label="Close"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="p-4 border-b border-border bg-muted/30">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or student ID..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="pl-10 py-2 text-sm border-2 focus:border-emerald-500 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Students List */}
                  <div className="flex-1 overflow-y-auto">
                    {(() => {
                      // Filter students by search query
                      const filteredStudents = students.filter((student) => {
                        if (!studentSearchQuery.trim()) return true;
                        const query = studentSearchQuery.toLowerCase();
                        const studentName = student.name.toLowerCase();
                        const studentId = (student.id || "").toLowerCase();
                        return studentName.includes(query) || studentId.includes(query);
                      });

                      if (filteredStudents.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <User className="h-16 w-16 text-gray-300 mb-4" />
                            <p className="text-lg text-gray-500 font-medium">
                              {studentSearchQuery ? "No students match your search" : "No students enrolled"}
                            </p>
                            <p className="text-sm text-gray-400 mt-2">
                              {studentSearchQuery ? "Try a different search term" : "Students will appear here once enrolled"}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="divide-y divide-border">
                          {filteredStudents.map((student) => {
                            // Format name as "Lastname, Firstname" for Filipino format
                            const nameParts = student.name.split(' ');
                            const formattedName = nameParts.length >= 2 
                              ? `${nameParts[nameParts.length - 1]}, ${nameParts.slice(0, -1).join(' ')}`
                              : student.name;

                            return (
                              <button
                                key={student.id}
                                onClick={() => setSelectedStudent(student)}
                                className="w-full p-5 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 transition-all duration-200 text-left border-l-4 border-l-transparent hover:border-l-green-500 hover:shadow-md group"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:shadow-lg transition-all duration-200">
                                    <User className="h-6 w-6 text-green-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-base text-gray-900 group-hover:text-green-700 transition-colors">{formattedName}</p>
                                    <p className="text-sm text-gray-600 mt-1">{student.id}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Mail className="h-3 w-3 text-gray-400 group-hover:text-green-500 transition-colors" />
                                      <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">{student.email}</span>
                                    </div>
                                    <div className="mt-2">
                                      {student.status === "active" ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Active
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">
                                          {student.status}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : (
                // Student Detail View
                <>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white border-b border-cyan-200">
                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span className="text-sm font-medium">Back to Students</span>
                    </button>
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <User className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        {(() => {
                          // Format name as "Lastname, Firstname"
                          const nameParts = selectedStudent.name.split(' ');
                          const formattedName = nameParts.length >= 2 
                            ? `${nameParts[nameParts.length - 1]}, ${nameParts.slice(0, -1).join(' ')}`
                            : selectedStudent.name;
                          return <h2 className="text-2xl font-bold">{formattedName}</h2>;
                        })()}
                        <p className="text-sm opacity-90 mt-1">{selectedStudent.id} • {selectedStudent.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Student Summary */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {loadingStudentGrades ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm">Loading grades…</p>
                      </div>
                    ) : (
                      <>
                        {/* Course Performance */}
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-4">Course Performance</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <Card className="border-2">
                              <CardContent className="p-4">
                                <p className="text-sm text-gray-600 mb-1">Activities Completed</p>
                                <p className="text-3xl font-bold text-blue-600">
                                  {studentSidebarGrades
                                    ? `${studentSidebarGrades.summary.graded_total}/${studentSidebarGrades.summary.total_items}`
                                    : `0/${activities.length}`}
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="border-2">
                              <CardContent className="p-4">
                                <p className="text-sm text-gray-600 mb-1">Average Grade</p>
                                <p className={`text-3xl font-bold ${studentSidebarGrades?.summary.average_percent != null ? (studentSidebarGrades.summary.average_percent >= 75 ? 'text-green-600' : 'text-orange-500') : 'text-gray-400'}`}>
                                  {studentSidebarGrades?.summary.average_percent != null
                                    ? `${studentSidebarGrades.summary.average_percent}%`
                                    : '—'}
                                </p>
                              </CardContent>
                            </Card>
                          </div>
                        </div>

                        {/* Activity Grades (LMS) */}
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-3">Activity Grades</h3>
                          {(!studentSidebarGrades || studentSidebarGrades.activity_grades.length === 0) ? (
                            <div className="text-center py-6 text-gray-400">
                              <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                              <p className="text-sm">No activities yet</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {studentSidebarGrades.activity_grades.map((ag: any) => {
                                const { label, bgColor, color, Icon } = getActivityTypeDisplay(ag.type);
                                const graded = ag.student_grade !== null;
                                const pct = graded && ag.max_score > 0
                                  ? Math.round((ag.student_grade / ag.max_score) * 100)
                                  : null;
                                return (
                                  <div key={ag.id} className={`p-3 border-2 rounded-lg ${bgColor}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
                                        <div className="min-w-0">
                                          <p className="font-medium text-sm truncate">{ag.title}</p>
                                          <p className="text-xs text-gray-500 mt-0.5">{label} · HPS {ag.max_score}</p>
                                        </div>
                                      </div>
                                      {graded ? (
                                        <div className="text-right flex-shrink-0">
                                          <p className="font-bold text-sm">{ag.student_grade}/{ag.max_score}</p>
                                          <p className={`text-xs font-medium ${pct != null && pct >= 75 ? 'text-green-600' : 'text-orange-500'}`}>
                                            {pct != null ? `${pct}%` : ''}
                                          </p>
                                        </div>
                                      ) : (
                                        <Badge variant="outline" className="text-xs flex-shrink-0">Not Graded</Badge>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Manual Input Grades */}
                        {studentSidebarGrades && studentSidebarGrades.manual_grades.length > 0 && (
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-3">Manual Input Grades</h3>
                            <div className="space-y-2">
                              {studentSidebarGrades.manual_grades.map((mg: any) => {
                                const graded = mg.student_grade !== null;
                                const pct = graded && mg.max_score > 0
                                  ? Math.round((mg.student_grade / mg.max_score) * 100)
                                  : null;
                                const componentLabel =
                                  mg.component === 'written' ? 'Written Works' :
                                  mg.component === 'performance' ? 'Performance Tasks' :
                                  mg.component === 'quarterly' ? 'Quarterly Assessment' : mg.component;
                                return (
                                  <div key={mg.id} className="p-3 border-2 border-slate-200 rounded-lg bg-slate-50">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{mg.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          {componentLabel} · HPS {mg.max_score}
                                          {mg.source_type === 'merged' && (
                                            <span className="ml-1 text-purple-600 font-medium">· Merged</span>
                                          )}
                                        </p>
                                      </div>
                                      {graded ? (
                                        <div className="text-right flex-shrink-0">
                                          <p className="font-bold text-sm">{mg.student_grade}/{mg.max_score}</p>
                                          <p className={`text-xs font-medium ${pct != null && pct >= 75 ? 'text-green-600' : 'text-orange-500'}`}>
                                            {pct != null ? `${pct}%` : ''}
                                          </p>
                                        </div>
                                      ) : (
                                        <Badge variant="outline" className="text-xs flex-shrink-0">Not Graded</Badge>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Student Info */}
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-4">Student Information</h3>
                      <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                        <div>
                          <p className="text-xs text-gray-600 font-medium">Student ID</p>
                          <p className="text-sm font-semibold mt-1">{selectedStudent.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 font-medium">Email</p>
                          <p className="text-sm font-semibold mt-1">{selectedStudent.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 font-medium">Status</p>
                          <div className="mt-1">
                            {selectedStudent.status === "active" ? (
                              <Badge className="bg-green-100 text-green-700 border-green-300">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">{selectedStudent.status}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CourseManagement;
