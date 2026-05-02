import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Save, ArrowLeft, Search, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  SortingState,
  useReactTable,
  ColumnOrderState,
} from "@tanstack/react-table";
import { API_ENDPOINTS, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from '@/components/Confirm';

type EditableScoreCellProps = {
  value: number;
  disabled?: boolean;
  onSave: (nextValue: string) => void;
};

const EditableScoreCell = ({ value, disabled = false, onSave }: EditableScoreCellProps) => {
  const [draft, setDraft] = useState(String(Number.isFinite(value) && value !== 0 ? value : ''));

  useEffect(() => {
    setDraft(String(Number.isFinite(value) && value !== 0 ? value : ''));
  }, [value]);

  return (
    <Input
      type="number"
      value={draft}
      disabled={disabled}
      placeholder="—"
      className={`h-8 min-w-[76px] text-center font-medium ${
        disabled 
          ? 'bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200' 
          : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500'
      }`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.currentTarget as HTMLInputElement).blur();
        }
        if (e.key === 'Escape') {
          setDraft(String(Number.isFinite(value) && value !== 0 ? value : ''));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
};

const GradeInputEdit = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!isAuthenticated || !["teacher", "admin"].includes(String(user?.role ?? ''))) {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  // Get parameters from URL
  const selectedCourse = searchParams.get("course");
  const selectedSection = searchParams.get("section");
  const selectedQuarter = searchParams.get("quarter") || "";
  const urlPeriodId = searchParams.get("period_id");

  const [courseInfo, setCourseInfo] = useState({
    code: "",
    title: "",
    teacher: "",
    section: "",
  });

  const [students, setStudents] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [academicPeriods, setAcademicPeriods] = useState<any[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [gradingItems, setGradingItems] = useState<any[]>([]);
  const [gradingScoreMap, setGradingScoreMap] = useState<Record<string, Record<string, number>>>({});
  const [manualInputDialogOpen, setManualInputDialogOpen] = useState(false);
  const [savingManualInput, setSavingManualInput] = useState(false);
  const [manualInputForm, setManualInputForm] = useState({
    title: "",
    component: "written",
    maxScore: "10",
  });
  const [editInputDialogOpen, setEditInputDialogOpen] = useState(false);
  const [savingEditInput, setSavingEditInput] = useState(false);
  const [editingInputItem, setEditingInputItem] = useState<any | null>(null);
  const [editInputForm, setEditInputForm] = useState({ title: "", maxScore: "" });
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [manageMergedDialogOpen, setManageMergedDialogOpen] = useState(false);
  const [savingMergedInput, setSavingMergedInput] = useState(false);
  const [editingMergedItemId, setEditingMergedItemId] = useState<string | null>(null);
  const [mergeForm, setMergeForm] = useState({
    title: "",
    component: "written",
    strategy: "sum",
    selectedItemIds: [] as string[],
  });

  const extractList = useCallback((res: any, keys: string[] = []): any[] => {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    for (const key of keys) {
      const value = (res as any)[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  }, []);

  const buildScoreMap = useCallback((scoreRows: any[]) => {
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
  }, []);

  const buildComponentItems = useCallback((acts: any[], items: any[]) => {
    if (Array.isArray(items) && items.length > 0) {
      const sorted = [...items].sort((a, b) => {
        const ao = Number(a.display_order ?? 0);
        const bo = Number(b.display_order ?? 0);
        if (ao !== bo) return ao - bo;
        return Number(a.id ?? 0) - Number(b.id ?? 0);
      });

      // Collect all source_item_ids referenced by merged columns so we can hide them
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
        // is_hidden: either flagged by backend (is_active=0 source) or detected as source of an active merge
        const isHidden = !!(item.is_hidden) || mergedSourceItemIds.has(String(item.id));
        return {
          id: String(item.id),
          field: `gi_${item.id}`,
          title: String(item.title ?? ''),
          max_score: Number(item.max_score ?? 0),
          component: String(item.component ?? 'written'),
          source_type: String(item.source_type ?? 'manual'),
          source_activity_id: item.source_activity_id ? Number(item.source_activity_id) : null,
          activity_type: activityType,
          merge_strategy: String(item.merge_strategy ?? 'sum'),
          merge_sources: Array.isArray(item.merge_sources) ? item.merge_sources : [],
          is_hidden: isHidden,
        };
      });

      // Visible items → rendered as columns and counted in component totals
      // Hidden sources → used only for merged score computation, never rendered
      return {
        written:      mapped.filter((i: any) => i.component === 'written'      && !i.is_hidden),
        performance:  mapped.filter((i: any) => i.component === 'performance'  && !i.is_hidden),
        quarterly:    mapped.filter((i: any) => i.component === 'quarterly'    && !i.is_hidden),
        hiddenSources: mapped.filter((i: any) => i.is_hidden),
      };
    }

    const categorized = categorizeActivities(acts || []);
    return {
      written: categorized.written.map((act: any, idx: number) => ({
        id: `activity_${act.id}`,
        field: `w${idx + 1}`,
        title: String(act.title ?? ''),
        max_score: Number(act.max_score ?? 0),
        component: 'written',
        source_type: 'activity',
        source_activity_id: Number(act.id),
        activity_type: String(act.type ?? '').toLowerCase(),
        is_hidden: false,
      })),
      performance: categorized.performance.map((act: any, idx: number) => ({
        id: `activity_${act.id}`,
        field: `p${idx + 1}`,
        title: String(act.title ?? ''),
        max_score: Number(act.max_score ?? 0),
        component: 'performance',
        source_type: 'activity',
        source_activity_id: Number(act.id),
        activity_type: String(act.type ?? '').toLowerCase(),
        is_hidden: false,
      })),
      quarterly: categorized.quarterly.map((act: any, idx: number) => ({
        id: `activity_${act.id}`,
        field: `q${idx + 1}`,
        title: String(act.title ?? ''),
        max_score: Number(act.max_score ?? 0),
        component: 'quarterly',
        source_type: 'activity',
        source_activity_id: Number(act.id),
        activity_type: String(act.type ?? '').toLowerCase(),
        is_hidden: false,
      })),
      hiddenSources: [],
    };
  }, []);

  // Helper to categorize activities by DepEd grading component
  const categorizeActivities = (activities: any[]) => {
    const written: any[] = [];
    const performance: any[] = [];
    const quarterly: any[] = [];

    activities.forEach(act => {
      const type = (act.type || '').toLowerCase().trim();

      // Written Work: quiz, worksheet, assignment, other
      if (['quiz', 'worksheet', 'assignment', 'other'].includes(type)) {
        written.push(act);

      // Performance Tasks: project, laboratory, performance, art, storytime, recitation, participation
      } else if ([
        'project',
        'laboratory',
        'performance',
        'art',
        'storytime',
        'recitation',
        'participation',
      ].includes(type)) {
        performance.push(act);

      // Quarterly Assessment: exam
      } else if (type === 'exam') {
        quarterly.push(act);

      // Fallback: unrecognized types → Written Work to prevent silent data loss
      } else {
        console.warn(`[categorizeActivities] Unrecognized activity type "${act.type}" (id: ${act.id}, title: "${act.title}") → defaulting to Written Work`);
        written.push(act);
      }
    });

    return { written, performance, quarterly };
  };

  // DepEd weight group derived from course_code prefix
  const getWeightGroup = (courseCode: string): 'languages' | 'science_math' | 'mapeh_epp' => {
    const prefix = (courseCode || '').split('-')[0].toUpperCase();
    if (['MATH', 'SCI'].includes(prefix)) return 'science_math';
    if (['MAPEH', 'EPP'].includes(prefix)) return 'mapeh_epp';
    return 'languages';
  };

  // WW = Written Work, PT = Performance Tasks, QA = Quarterly Assessment
  const getWeights = (group: 'languages' | 'science_math' | 'mapeh_epp') => {
    if (group === 'science_math') return { ww: 40, pt: 40, qa: 20 };
    if (group === 'mapeh_epp') return { ww: 20, pt: 60, qa: 20 };
    return { ww: 30, pt: 50, qa: 20 };
  };

  const formatFinalGrade = (initialGrade: number): number => {
    const clamped = Math.max(0, Math.min(100, Number(initialGrade || 0)));

    if (clamped >= 60) {
      return Math.min(100, 75 + Math.floor((clamped - 60) / 1.6));
    }

    return 60 + Math.floor(clamped / 4);
  };

  const normalizeText = (value: any): string => String(value ?? '').replace(/\s+/g, ' ').trim();

  const formatStudentDisplayName = (student: any): string => {
    const lastName = normalizeText(student?.last_name ?? student?.lastname ?? '');
    const firstName = normalizeText(student?.first_name ?? student?.firstname ?? '');
    const middleRaw = normalizeText(student?.middle_name ?? student?.middlename ?? student?.middle_initial ?? '');
    const middleInitial = middleRaw ? `${middleRaw.charAt(0).toUpperCase()}.` : '';

    if (lastName || firstName) {
      const base = [lastName, firstName].filter(Boolean).join(', ');
      return `${base}${middleInitial ? ` ${middleInitial}` : ''}`.trim();
    }

    return normalizeText(student?.name ?? '');
  };

  const getStudentSortKeys = (student: any) => {
    const lastName = normalizeText(student?.last_name ?? student?.lastname ?? '');
    const firstName = normalizeText(student?.first_name ?? student?.firstname ?? '');
    const middleRaw = normalizeText(student?.middle_name ?? student?.middlename ?? student?.middle_initial ?? '');
    const middleInitial = middleRaw ? middleRaw.charAt(0).toUpperCase() : '';

    return {
      lastName,
      firstName,
      middleInitial,
    };
  };

  const normalizeGender = (value: any): string => normalizeText(value).toLowerCase();

  const getGenderRank = (gender: string): number => {
    if (['male', 'm', 'boy', 'man'].includes(gender)) return 0;
    if (['female', 'f', 'girl', 'woman'].includes(gender)) return 1;
    return 2;
  };

  const getGenderGroupLabel = (gender: string): string => {
    const rank = getGenderRank(gender);
    if (rank === 0) return 'Male';
    if (rank === 1) return 'Female';
    return 'Unspecified';
  };

  // Fetch data on mount
  useEffect(() => {
    let mounted = true;
    const normalizeLabel = (v: any): string => String(v ?? '').replace(/\s+/g, ' ').trim();

    const fetchData = async () => {
      if (!selectedCourse || !selectedSection) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Resolve academic period — prefer explicit period_id from URL, fallback to active
        let resolvedPeriodId: string | null = urlPeriodId || null;
        try {
          const pRes = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS);
          const pList = extractList(pRes, ['data', 'periods']);
          if (Array.isArray(pList)) {
            if (mounted) setAcademicPeriods(pList);
            if (!resolvedPeriodId) {
              const active = pList.find((p: any) => p.status === 'active');
              if (active) resolvedPeriodId = String(active.id);
            }
          }
        } catch (e) {}

        if (mounted && resolvedPeriodId) setSelectedPeriodId(resolvedPeriodId);

        // Fetch teacher/admin subjects — same endpoint policy as GradeInput
        let yearLevel: string | null = null;
        try {
          const subjectsRes = user?.role === 'admin'
            ? await apiGet(API_ENDPOINTS.SUBJECTS)
            : await apiGet(API_ENDPOINTS.TEACHER_MY_SUBJECTS);
          const subjects = extractList(subjectsRes, ['subjects', 'data']);
          if (mounted && Array.isArray(subjects)) {
            setCourses(subjects);
            const found = subjects.find((s: any) =>
              String(s.subject_id ?? s.id) === String(selectedCourse)
            );
            if (found) {
              yearLevel = normalizeLabel(found.level || found.subject_level || found.year_level || '');
              setCourseInfo({
                code: normalizeLabel(found.course_code || found.code || ''),
                title: normalizeLabel(found.name || found.subject_name || ''),
                teacher: normalizeLabel(user?.name ?? ''),
                section: normalizeLabel(found.section_name ?? yearLevel),
              });
            }
          }
        } catch (e) {}

        // Fetch activities filtered by course + section + period
        let actList: any[] = [];
        let usedActivityFallback = false;
        try {
          let activityQuery = `course_id=${encodeURIComponent(String(selectedCourse))}&section_id=${encodeURIComponent(String(selectedSection))}`;
          if (resolvedPeriodId) activityQuery += `&academic_period_id=${encodeURIComponent(resolvedPeriodId)}`;
          
          console.log('Fetching activities with query:', activityQuery);
          const actRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}?${activityQuery}`);
          actList = extractList(actRes, ['data', 'activities']);
          console.log('Activities fetched:', {
            count: actList?.length ?? 0,
            activities: actList?.map((a: any) => ({ id: a.id, title: a.title, type: a.type })) ?? []
          });

          // Fallback: if period-filtered query has no activities, retry without academic_period_id
          if ((!Array.isArray(actList) || actList.length === 0) && resolvedPeriodId) {
            const fallbackQuery = `course_id=${encodeURIComponent(String(selectedCourse))}&section_id=${encodeURIComponent(String(selectedSection))}`;
            const fallbackRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}?${fallbackQuery}`);
            const fallbackList = extractList(fallbackRes, ['data', 'activities']);
            console.log('Activities fallback (no period filter):', {
              count: fallbackList?.length ?? 0,
              activities: fallbackList?.map((a: any) => ({ id: a.id, title: a.title, type: a.type })) ?? []
            });
            if (Array.isArray(fallbackList) && fallbackList.length > 0) {
              actList = fallbackList;
              usedActivityFallback = true;
            }
          }

          if (mounted) setActivities(actList);
        } catch (e) {
          console.error('Failed to fetch activities:', e);
        }

        // Hybrid grading inputs: sync LMS activities then fetch all grading items + non-activity scores
        let fetchedGradingItems: any[] = [];
        let fetchedScoreMap: Record<string, Record<string, number>> = {};
        try {
          if (resolvedPeriodId && !usedActivityFallback) {
            await apiPost(API_ENDPOINTS.GRADING_INPUTS_SYNC_LMS, {
              course_id: Number(selectedCourse),
              section_id: Number(selectedSection),
              academic_period_id: Number(resolvedPeriodId),
              quarter: selectedQuarter || null,
            });

            const giQuery = `course_id=${encodeURIComponent(String(selectedCourse))}&section_id=${encodeURIComponent(String(selectedSection))}&academic_period_id=${encodeURIComponent(String(resolvedPeriodId))}&quarter=${encodeURIComponent(selectedQuarter || '')}`;
            const giRes = await apiGet(`${API_ENDPOINTS.GRADING_INPUTS}?${giQuery}`);
            const activeItems = extractList(giRes, ['items', 'data']);
            // Merge in hidden source items (is_active=0 sources needed for merge computation)
            const hiddenItems = Array.isArray(giRes?.hidden_source_items)
              ? giRes.hidden_source_items.map((i: any) => ({ ...i, is_hidden: true }))
              : [];
            fetchedGradingItems = [...activeItems, ...hiddenItems];
            const scoreRows = extractList(giRes, ['scores']);
            fetchedScoreMap = buildScoreMap(scoreRows);
          }
        } catch (e) {
          // fallback to pure LMS columns if hybrid endpoints fail
          fetchedGradingItems = [];
          fetchedScoreMap = {};
        }

        if (mounted) {
          setGradingItems(fetchedGradingItems);
          setGradingScoreMap(fetchedScoreMap);
        }

        // Fetch students with grades
        try {
          let query = `section_id=${encodeURIComponent(String(selectedSection))}`;
          if (yearLevel) query += `&year_level=${encodeURIComponent(yearLevel)}`;
          query += `&include_grades=true`;

          const studRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?${query}`);
          const studList = extractList(studRes, ['data', 'students']);
          if (mounted && Array.isArray(studList)) {
            setStudents(studList);

            const groupedItems = buildComponentItems(actList, fetchedGradingItems);
            // Include hidden source items in row hydration so recalculateMergedFields can find their values
            const allItems = [
              ...groupedItems.written,
              ...groupedItems.performance,
              ...groupedItems.quarterly,
              ...(groupedItems.hiddenSources || []),
            ];
            const gridRows = studList.map((st: any) => {
              const stGrades = st.grades ?? st.activity_grades ?? [];
              const studentMapId = String(st.id ?? st.student_id ?? st.user_id ?? '');
              const sortKeys = getStudentSortKeys(st);
              const normalizedGender = normalizeGender(st.gender ?? st.sex ?? '');
              const row: any = {
                id: st.student_id ?? st.id ?? String(st.id),
                student_db_id: st.id ?? null,
                name: formatStudentDisplayName(st),
                gender: normalizedGender,
                _sortLastName: sortKeys.lastName,
                _sortFirstName: sortKeys.firstName,
                _sortMiddleInitial: sortKeys.middleInitial,
              };

              allItems.forEach((item: any) => {
                let score = 0;
                if (item.source_type === 'activity' && item.source_activity_id) {
                  const grade = stGrades.find((g: any) => String(g.activity_id) === String(item.source_activity_id));
                  score = grade ? parseFloat(grade.grade ?? 0) : 0;
                  if (!row._grade_exists) row._grade_exists = {};
                  row._grade_exists[String(item.source_activity_id)] = !!grade;
                } else {
                  score = Number(fetchedScoreMap[String(item.id)]?.[studentMapId] ?? 0);
                }
                row[item.field] = Number.isFinite(score) ? score : 0;
              });

              return recalculateMergedFields(row);
            });

            const groupedAndSortedRows = [...gridRows].sort((a: any, b: any) => {
              const genderDiff = getGenderRank(a.gender) - getGenderRank(b.gender);
              if (genderDiff !== 0) return genderDiff;

              const lastNameDiff = String(a._sortLastName ?? '').localeCompare(String(b._sortLastName ?? ''), undefined, { sensitivity: 'base' });
              if (lastNameDiff !== 0) return lastNameDiff;

              const firstNameDiff = String(a._sortFirstName ?? '').localeCompare(String(b._sortFirstName ?? ''), undefined, { sensitivity: 'base' });
              if (firstNameDiff !== 0) return firstNameDiff;

              const middleDiff = String(a._sortMiddleInitial ?? '').localeCompare(String(b._sortMiddleInitial ?? ''), undefined, { sensitivity: 'base' });
              if (middleDiff !== 0) return middleDiff;

              return String(a.id ?? '').localeCompare(String(b.id ?? ''), undefined, { sensitivity: 'base' });
            });

            setGrades(groupedAndSortedRows);
          }
        } catch (e) {
          console.error('Failed to fetch students:', e);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [selectedCourse, selectedSection, urlPeriodId, user, selectedQuarter, extractList, buildComponentItems, buildScoreMap, reloadToken]);

  const confirm = useConfirm();

  const componentItems = useMemo(() => buildComponentItems(activities, gradingItems), [activities, gradingItems, buildComponentItems]);
  const allGradeItems = useMemo(
    // Include hiddenSources so recalculateMergedFields can resolve source fields for old merges
    () => [
      ...componentItems.written,
      ...componentItems.performance,
      ...componentItems.quarterly,
      ...(componentItems.hiddenSources || []),
    ],
    [componentItems]
  );

  const mergeCandidates = useMemo(() => {
    if (!Array.isArray(gradingItems)) return [];
    return gradingItems
      .filter((item: any) => String(item.source_type ?? '') !== 'merged')
      .map((item: any) => ({
        id: String(item.id),
        title: String(item.title ?? ''),
        component: String(item.component ?? 'written'),
        source_type: String(item.source_type ?? 'manual'),
        source_activity_id: item.source_activity_id ? Number(item.source_activity_id) : null,
        max_score: Number(item.max_score ?? 0),
      }));
  }, [gradingItems]);

  const mergedItems = useMemo(() => {
    if (!Array.isArray(gradingItems)) return [];
    return [...gradingItems]
      .filter((item: any) => String(item.source_type ?? '') === 'merged')
      .sort((a: any, b: any) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0));
  }, [gradingItems]);

  const selectedMergeCandidates = useMemo(
    () => mergeCandidates.filter((item: any) => mergeForm.selectedItemIds.includes(String(item.id))),
    [mergeCandidates, mergeForm.selectedItemIds]
  );

  const mergeComputedHps = useMemo(() => {
    const scores = selectedMergeCandidates.map((item: any) => Number(item.max_score ?? 0));
    const sum = scores.reduce((acc: number, value: number) => acc + value, 0);
    if (mergeForm.strategy === 'average' && scores.length > 0) {
      return sum / scores.length;
    }
    return sum;
  }, [selectedMergeCandidates, mergeForm.strategy]);

  const recalculateMergedFields = useCallback((row: any) => {
    const items = allGradeItems || [];
    const byItemId = new Map<string, any>();
    const byActivityId = new Map<string, any>();

    items.forEach((item: any) => {
      byItemId.set(String(item.id), item);
      if (item.source_type === 'activity' && item.source_activity_id) {
        byActivityId.set(String(item.source_activity_id), item);
      }
    });

    const nextRow = { ...row };

    items
      .filter((item: any) => String(item.source_type ?? '') === 'merged')
      .forEach((mergedItem: any) => {
        const sources = Array.isArray(mergedItem.merge_sources) ? mergedItem.merge_sources : [];
        const strategy = String(mergedItem.merge_strategy ?? 'sum').toLowerCase();

        let sum = 0;
        let count = 0;

        sources.forEach((src: any) => {
          const srcType = String(src?.source_type ?? '').toLowerCase();
          let fieldName: string | null = null;

          if (srcType === 'activity') {
            const mapped = byActivityId.get(String(src?.source_activity_id ?? ''));
            fieldName = mapped?.field ?? null;
          } else if (srcType === 'manual') {
            const mapped = byItemId.get(String(src?.source_item_id ?? ''));
            fieldName = mapped?.field ?? null;
          }

          if (!fieldName) return;
          const rawScore = Number(nextRow?.[fieldName] ?? 0);
          if (!Number.isFinite(rawScore)) return;

          const weight = Number(src?.weight ?? 1);
          sum += rawScore * (Number.isFinite(weight) ? weight : 1);
          count += 1;
        });

        const computed = strategy === 'average' && count > 0 ? (sum / count) : sum;
        // Only overwrite when at least one source was found in the row.
        // If count === 0, source items are not in allGradeItems (deactivated); preserve
        // the value already loaded from the backend's server-side merged score computation.
        if (count > 0) {
          nextRow[mergedItem.field] = Number.isFinite(computed) ? Number(computed.toFixed(2)) : 0;
        }
      });

    return nextRow;
  }, [allGradeItems]);

  const handleCellValueChanged = useCallback(async (rowId: string, field: string, incomingValue: string | number) => {
    const row = grades.find((g: any) => String(g.id) === String(rowId));
    if (!row) return;

    const studentDbId = row?.student_db_id ?? row?.id;
    const oldValue = Number(row?.[field] ?? 0);
    let value = Number(incomingValue);
    if (Number.isNaN(value)) value = 0;

    if (value < 0) {
      try {
        await confirm({
          title: 'Invalid score',
          description: 'Negative scores are not allowed.',
          confirmText: 'OK',
          variant: 'destructive'
        });
      } catch (e) {}
      return;
    }

    const item = allGradeItems.find((it: any) => it.field === field);
    if (!item) {
      setGrades(prev => prev.map((g: any) => String(g.id) === String(rowId) ? { ...g, [field]: value } : g));
      return;
    }

    // Block editing of quiz/exam scores from LMS
    const isReadOnly = item.source_type === 'activity' && ['quiz', 'exam', 'test'].includes(String(item.activity_type ?? '').toLowerCase());
    if (isReadOnly) {
      setToast({ type: 'info', message: 'Quiz and exam scores are synced from the LMS and cannot be edited here.' });
      return;
    }

    if (item.source_type === 'merged') {
      setToast({ type: 'info', message: 'Merged columns are computed from their source scores and cannot be edited directly.' });
      return;
    }

    if (item.source_type === 'activity' && !item.source_activity_id) {
      setToast({ type: 'error', message: 'Unable to map column to activity.' });
      return;
    }

    const maxScore = Number(item.max_score ?? 0) || 0;
    let clamped = Math.max(0, Math.min(value, maxScore || value));
    if (value > maxScore && maxScore > 0) {
      let s = String(incomingValue ?? '').replace(/[^\d]/g, '');
      while (s.length > 0 && Number(s) > maxScore) {
        s = s.slice(0, -1);
      }
      const truncated = s.length > 0 ? s : String(maxScore);
      const truncatedNum = Number(truncated);

      try {
        const ok = await confirm({
          title: 'Score too high',
          description: `The entered score exceeds the maximum allowed (${maxScore}). It will be truncated to ${truncated}.`,
          emphasis: String(maxScore),
          confirmText: 'OK',
          variant: 'default'
        });
        if (!ok) return;
      } catch (e) {}

      clamped = truncatedNum;
    }

    const nextData = recalculateMergedFields({ ...row, [field]: clamped });
    setGrades(prev => prev.map((g: any) => String(g.id) === String(rowId) ? nextData : g));

    if (item.source_type !== 'activity') {
      setGradingScoreMap(prev => ({
        ...prev,
        [String(item.id)]: {
          ...(prev[String(item.id)] || {}),
          [String(studentDbId)]: clamped,
        },
      }));
    }

    try {
      const res = item.source_type === 'activity'
        ? await apiPost(API_ENDPOINTS.ACTIVITY_GRADES(item.source_activity_id), { student_id: studentDbId, grade: clamped })
        : await apiPost(API_ENDPOINTS.GRADING_INPUT_SCORE(item.id), { student_id: studentDbId, score: clamped });
      setToast({ type: 'success', message: res?.message ?? 'Grade saved' });
    } catch (err: any) {
      console.error('Failed saving grade', err);
      const revertedData = recalculateMergedFields({ ...row, [field]: oldValue });
      setGrades(prev => prev.map((g: any) => String(g.id) === String(rowId) ? revertedData : g));
      if (item.source_type !== 'activity') {
        setGradingScoreMap(prev => ({
          ...prev,
          [String(item.id)]: {
            ...(prev[String(item.id)] || {}),
            [String(studentDbId)]: Number(oldValue ?? 0),
          },
        }));
      }
      setToast({ type: 'error', message: err?.message ?? 'Failed to save grade' });
    }
  }, [allGradeItems, confirm, grades, recalculateMergedFields]);

  // Alert / toast state
  const [toast, setToast] = useState<{type: 'success'|'error'|'info', message: string} | null>(null);
  const closeToast = () => setToast(null);

  const calculateComponentTotal = (row: any, items: any[]) => {
    return items.reduce((sum: number, item: any) => sum + (Number(row?.[item.field] ?? 0) || 0), 0);
  };

  const calculateWrittenTotal = (row: any) => calculateComponentTotal(row, componentItems.written);
  const calculatePerformanceTotal = (row: any) => calculateComponentTotal(row, componentItems.performance);
  const calculateQuarterlyTotal = (row: any) => calculateComponentTotal(row, componentItems.quarterly);

  const getWrittenMaxScore = () => componentItems.written.reduce((sum: number, item: any) => sum + Number(item.max_score ?? 0), 0);
  const getPerformanceMaxScore = () => componentItems.performance.reduce((sum: number, item: any) => sum + Number(item.max_score ?? 0), 0);
  const getQuarterlyMaxScore = () => componentItems.quarterly.reduce((sum: number, item: any) => sum + Number(item.max_score ?? 0), 0);

  const currentWeights = useMemo(() => {
    const group = getWeightGroup(courseInfo.code);
    return getWeights(group);
  }, [courseInfo.code]);

  // Filter grades based on search query
  const filteredGrades = useMemo(() => {
    if (!searchQuery.trim()) return grades;
    const query = searchQuery.toLowerCase();
    return grades.filter(g => 
      (g.id ?? '').toString().toLowerCase().includes(query) ||
      (g.name ?? '').toLowerCase().includes(query)
    );
  }, [grades, searchQuery]);

  const [sorting, setSorting] = useState<SortingState>([]);

  const toggleColumnSort = useCallback((columnId: string) => {
    setSorting((prev) => {
      const current = prev[0];
      if (!current || current.id !== columnId) {
        return [{ id: columnId, desc: false }];
      }
      if (current.desc === false) {
        return [{ id: columnId, desc: true }];
      }
      return [];
    });
  }, []);

  // Sort filteredGrades manually so pinnedTopRow (HPS) is always excluded from sorting
  const sortedGrades = useMemo(() => {
    if (!sorting.length) return filteredGrades;
    const { id, desc } = sorting[0];

    const getSortableValue = (row: any): string | number => {
      const writtenTotal = calculateWrittenTotal(row);
      const performanceTotal = calculatePerformanceTotal(row);
      const quarterlyTotal = calculateQuarterlyTotal(row);

      const writtenMax = getWrittenMaxScore();
      const performanceMax = getPerformanceMaxScore();
      const quarterlyMax = getQuarterlyMaxScore();

      const writtenPs = (writtenTotal / (writtenMax || 1)) * 100;
      const performancePs = (performanceTotal / (performanceMax || 1)) * 100;
      const quarterlyPs = (quarterlyTotal / (quarterlyMax || 1)) * 100;

      const writtenWs = (writtenTotal / (writtenMax || 1)) * currentWeights.ww;
      const performanceWs = (performanceTotal / (performanceMax || 1)) * currentWeights.pt;
      const quarterlyWs = (quarterlyTotal / (quarterlyMax || 1)) * currentWeights.qa;

      const initial = writtenWs + performanceWs + quarterlyWs;
      const final = formatFinalGrade(initial);

      switch (id) {
        case 'written_total':
          return writtenTotal;
        case 'written_ps':
          return writtenPs;
        case 'written_ws':
          return writtenWs;
        case 'performance_total':
          return performanceTotal;
        case 'performance_ps':
          return performancePs;
        case 'performance_ws':
          return performanceWs;
        case 'quarterly_total':
          return quarterlyTotal;
        case 'quarterly_ps':
          return quarterlyPs;
        case 'quarterly_ws':
          return quarterlyWs;
        case 'initial_grade':
          return initial;
        case 'final_grade':
          return final;
        default:
          return row[id] ?? '';
      }
    };

    return [...filteredGrades].sort((a, b) => {
      const aVal = getSortableValue(a);
      const bVal = getSortableValue(b);

      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
      }

      return desc ? -cmp : cmp;
    });
  }, [filteredGrades, sorting, currentWeights, componentItems]);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const columnHelper = createColumnHelper<any>();
  const manuallySortableComputedColumns = useMemo(() => new Set([
    'written_total', 'written_ps', 'written_ws',
    'performance_total', 'performance_ps', 'performance_ws',
    'quarterly_total', 'quarterly_ps', 'quarterly_ws',
    'initial_grade', 'final_grade',
  ]), []);

  const writtenMaxScore = useMemo(() => getWrittenMaxScore(), [componentItems.written]);
  const performanceMaxScore = useMemo(() => getPerformanceMaxScore(), [componentItems.performance]);
  const quarterlyMaxScore = useMemo(() => getQuarterlyMaxScore(), [componentItems.quarterly]);

  const getRowMetrics = useCallback((row: any) => {
    const writtenTotal = calculateWrittenTotal(row);
    const performanceTotal = calculatePerformanceTotal(row);
    const quarterlyTotal = calculateQuarterlyTotal(row);

    const writtenPs = (writtenTotal / (writtenMaxScore || 1)) * 100;
    const performancePs = (performanceTotal / (performanceMaxScore || 1)) * 100;
    const quarterlyPs = (quarterlyTotal / (quarterlyMaxScore || 1)) * 100;

    const writtenWs = (writtenTotal / (writtenMaxScore || 1)) * currentWeights.ww;
    const performanceWs = (performanceTotal / (performanceMaxScore || 1)) * currentWeights.pt;
    const quarterlyWs = (quarterlyTotal / (quarterlyMaxScore || 1)) * currentWeights.qa;

    const initial = writtenWs + performanceWs + quarterlyWs;

    return {
      writtenTotal,
      performanceTotal,
      quarterlyTotal,
      writtenPs,
      performancePs,
      quarterlyPs,
      writtenWs,
      performanceWs,
      quarterlyWs,
      initial,
      final: formatFinalGrade(initial),
    };
  }, [currentWeights, writtenMaxScore, performanceMaxScore, quarterlyMaxScore]);

  // Highest Possible Score (pinned top row) values
  const pinnedTopRow = useMemo(() => {
    const row: any = {
      id: '',
      name: 'HPS →',
      __hps: true,
    };

    allGradeItems.forEach((item: any) => {
      row[item.field] = Number(item.max_score ?? 0);
    });

    return row;
  }, [allGradeItems]);

  const tableColumns = useMemo(() => {
    const scoreColumns = (items: any[], toneClass: string) => items.map((item: any) =>
      columnHelper.accessor(item.field, {
        id: item.field,
        header: () => (
          <div className="flex items-center gap-1 justify-center w-full group">
            <span className="truncate flex-1 text-center">{item.title.length > 12 ? `${item.title.substring(0, 12)}...` : item.title}</span>
            {item.source_type === 'activity' && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-blue-100 text-blue-700 border-blue-300 shrink-0">
                LMS
              </Badge>
            )}
            {item.source_type === 'manual' && (
              <button
                type="button"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/60"
                title="Edit title / HPS"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingInputItem(item);
                  setEditInputForm({ title: item.title, maxScore: String(item.max_score ?? '') });
                  setEditInputDialogOpen(true);
                }}
              >
                <Pencil className="h-3 w-3 text-slate-500" />
              </button>
            )}
          </div>
        ),
        size: 96,
        enableSorting: true,
        cell: (info) => {
          const row = info.row.original;
          const value = Number(row?.[item.field] ?? 0);
          if (row.__hps) {
            return <span className="font-bold text-slate-700">{Number(item.max_score ?? 0)}</span>;
          }
          if (item.source_type === 'merged') {
            return <span className={`font-semibold text-slate-700`}>{value > 0 ? Number(value).toFixed(2) : '—'}</span>;
          }
          const isReadOnly = item.source_type === 'activity' && ['quiz', 'exam', 'test'].includes(String(item.activity_type ?? '').toLowerCase());
          if (isReadOnly) {
            return <span className="font-medium text-slate-700">{value > 0 ? value : '—'}</span>;
          }
          return (
            <EditableScoreCell
              value={value}
              disabled={false}
              onSave={(nextValue) => handleCellValueChanged(String(row.id), item.field, nextValue)}
            />
          );
        },
      })
    );

    return [
      columnHelper.group({
        id: 'student-info',
        header: 'Student Info',
        columns: [
          columnHelper.accessor('id', {
            id: 'id',
            header: () => <span className="block w-full text-right">ID</span>,
            size: 140,
            cell: (info) => <span className="block w-full text-right whitespace-nowrap font-semibold text-slate-700">{String(info.getValue() ?? '')}</span>,
          }),
          columnHelper.accessor('name', {
            id: 'name',
            header: "Learner's Name",
            size: 220,
            cell: (info) => <span className="font-medium block w-full text-left text-slate-800">{String(info.getValue() ?? '')}</span>,
          }),
        ],
      }),
      columnHelper.group({
        id: 'written',
        header: `Written Works (${currentWeights.ww}%)`,
        columns: [
          ...scoreColumns(componentItems.written, 'bg-blue-100'),
          columnHelper.display({
            id: 'written_total',
            header: 'Total',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="font-bold text-blue-700">{writtenMaxScore.toFixed(2)}</span>;
              }
              const value = getRowMetrics(row).writtenTotal;
              return <span className="font-bold text-blue-700">{value.toFixed(2)}</span>;
            },
          }),
          columnHelper.display({
            id: 'written_ps',
            header: 'PS',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="text-blue-600">100.00%</span>;
              }
              const value = getRowMetrics(row).writtenPs;
              return <span className="text-blue-600">{value.toFixed(2)}%</span>;
            },
          }),
          columnHelper.display({
            id: 'written_ws',
            header: 'WS',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="font-bold text-blue-800">{currentWeights.ww.toFixed(2)}</span>;
              }
              const value = getRowMetrics(row).writtenWs;
              return <span className="font-bold text-blue-800">{value.toFixed(2)}</span>;
            },
          }),
        ],
      }),
      columnHelper.group({
        id: 'performance',
        header: `Performance Tasks (${currentWeights.pt}%)`,
        columns: [
          ...scoreColumns(componentItems.performance, 'bg-green-100'),
          columnHelper.display({
            id: 'performance_total',
            header: 'Total',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="font-bold text-green-700">{performanceMaxScore.toFixed(2)}</span>;
              }
              const value = getRowMetrics(row).performanceTotal;
              return <span className="font-bold text-green-700">{value.toFixed(2)}</span>;
            },
          }),
          columnHelper.display({
            id: 'performance_ps',
            header: 'PS',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="text-green-600">100.00%</span>;
              }
              const value = getRowMetrics(row).performancePs;
              return <span className="text-green-600">{value.toFixed(2)}%</span>;
            },
          }),
          columnHelper.display({
            id: 'performance_ws',
            header: 'WS',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="font-bold text-green-800">{currentWeights.pt.toFixed(2)}</span>;
              }
              const value = getRowMetrics(row).performanceWs;
              return <span className="font-bold text-green-800">{value.toFixed(2)}</span>;
            },
          }),
        ],
      }),
      columnHelper.group({
        id: 'quarterly',
        header: `Quarterly Assessment (${currentWeights.qa}%)`,
        columns: [
          ...scoreColumns(componentItems.quarterly, 'bg-yellow-100'),
          columnHelper.display({
            id: 'quarterly_total',
            header: 'Total',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="font-bold text-amber-700">{quarterlyMaxScore.toFixed(2)}</span>;
              }
              const value = getRowMetrics(row).quarterlyTotal;
              return <span className="font-bold text-amber-700">{value.toFixed(2)}</span>;
            },
          }),
          columnHelper.display({
            id: 'quarterly_ps',
            header: 'PS',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="text-amber-600">100.00%</span>;
              }
              const value = getRowMetrics(row).quarterlyPs;
              return <span className="text-amber-600">{value.toFixed(2)}%</span>;
            },
          }),
          columnHelper.display({
            id: 'quarterly_ws',
            header: 'WS',
            size: 88,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                return <span className="font-bold text-amber-800">{currentWeights.qa.toFixed(2)}</span>;
              }
              const value = getRowMetrics(row).quarterlyWs;
              return <span className="font-bold text-amber-800">{value.toFixed(2)}</span>;
            },
          }),
        ],
      }),
      columnHelper.group({
        id: 'quarter-grade',
        header: `${selectedQuarter || 'Quarter'} Grade`,
        columns: [
          columnHelper.display({
            id: 'initial_grade',
            header: 'Initial',
            size: 100,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                const totalWeight = currentWeights.ww + currentWeights.pt + currentWeights.qa;
                return <span className="font-bold text-purple-700">{totalWeight.toFixed(2)}</span>;
              }
              const value = getRowMetrics(row).initial;
              return <span className="font-bold text-purple-700">{value.toFixed(2)}</span>;
            },
          }),
          columnHelper.display({
            id: 'final_grade',
            header: 'Grade',
            size: 100,
            enableSorting: true,
            cell: (info) => {
              const row = info.row.original;
              if (row.__hps) {
                const totalWeight = currentWeights.ww + currentWeights.pt + currentWeights.qa;
                return <span className="font-bold text-purple-800">{Math.round(totalWeight)}</span>;
              }
              const metric = getRowMetrics(row);
              const isPass = metric.final >= 75;
              return (
                <span className={`${isPass ? 'bg-green-100 text-green-900 border border-green-300' : 'bg-red-100 text-red-900 border border-red-300'} px-3 py-1.5 rounded-md font-bold shadow-sm`}>
                  {metric.final}
                </span>
              );
            },
          }),
        ],
      }),
    ];
  }, [columnHelper, componentItems, currentWeights, getRowMetrics, handleCellValueChanged, quarterlyMaxScore, selectedQuarter, writtenMaxScore, performanceMaxScore]);

  const rowsWithGenderLabels = useMemo(() => {
    const rows: any[] = [];
    let previousGenderLabel: string | null = null;

    sortedGrades.forEach((row: any) => {
      const currentGenderLabel = getGenderGroupLabel(String(row?.gender ?? ''));
      if (currentGenderLabel !== previousGenderLabel) {
        rows.push({
          __gender_label: true,
          __label_text: currentGenderLabel,
          id: `gender-label-${currentGenderLabel.toLowerCase()}-${rows.length}`,
        });
        previousGenderLabel = currentGenderLabel;
      }
      rows.push(row);
    });

    return rows;
  }, [sortedGrades]);

  const tableData = useMemo(() => [pinnedTopRow, ...rowsWithGenderLabels], [pinnedTopRow, rowsWithGenderLabels]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: { sorting, columnOrder },
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // sorting is applied manually to keep the HPS row pinned at the top
  });

  const getColumnClassName = useCallback((columnId: string, isHeader = false, headerDepth = 0) => {
    // Determine section color theming
    let sectionColor = '';
    if (columnId.startsWith('written') || columnId.includes('written')) {
      sectionColor = isHeader ? 'bg-blue-50 border-blue-200' : 'border-blue-100 hover:bg-blue-50/50';
    } else if (columnId.startsWith('performance') || columnId.includes('performance')) {
      sectionColor = isHeader ? 'bg-green-50 border-green-200' : 'border-green-100 hover:bg-green-50/50';
    } else if (columnId.startsWith('quarterly') || columnId.includes('quarterly')) {
      sectionColor = isHeader ? 'bg-amber-50 border-amber-200' : 'border-amber-100 hover:bg-amber-50/50';
    } else if (columnId.startsWith('quarter-grade') || columnId.includes('_grade')) {
      sectionColor = isHeader ? 'bg-purple-50 border-purple-200' : 'border-purple-100 hover:bg-purple-50/50';
    } else {
      sectionColor = isHeader ? 'bg-slate-100 border-slate-200' : 'border-slate-200 hover:bg-slate-50';
    }

    const base = isHeader
      ? `border px-2 py-2 text-left font-semibold text-xs uppercase tracking-wide ${sectionColor} ${headerDepth === 0 ? 'text-sm' : 'text-xs'}`
      : `border px-2 py-2 align-middle text-center transition-colors ${sectionColor}`;

    const sticky = columnId === 'id'
      ? ' sticky left-0 z-30 bg-white'
      : columnId === 'name'
        ? ' sticky left-[140px] z-30 text-left bg-white'
        : '';

    const width = columnId === 'id'
      ? ' min-w-[140px] w-[140px]'
      : columnId === 'name'
        ? ' min-w-[220px] w-[220px]'
        : columnId.endsWith('_total') || columnId.endsWith('_ps') || columnId.endsWith('_ws')
          ? ' min-w-[88px] w-[88px]'
          : columnId === 'initial_grade' || columnId === 'final_grade'
            ? ' min-w-[100px] w-[100px]'
            : ' min-w-[96px] w-[96px]';

    const alignment = columnId === 'id' ? ' text-right whitespace-nowrap' : '';

    return `${base}${sticky}${width}${alignment}`;
  }, []);

  const handleSaveGrades = () => {
    alert("Grades saved successfully!");
    navigate(-1);
  };

  const handleOpenManualInputDialog = () => {
    setManualInputForm({ title: "", component: "written", maxScore: "10" });
    setManualInputDialogOpen(true);
  };

  const handleOpenMergeDialog = () => {
    setEditingMergedItemId(null);
    setMergeForm({
      title: "",
      component: "written",
      strategy: "sum",
      selectedItemIds: [],
    });
    setMergeDialogOpen(true);
  };

  const toggleMergeCandidate = (itemId: string, checked: boolean) => {
    setMergeForm(prev => {
      const current = new Set(prev.selectedItemIds);
      if (checked) current.add(itemId);
      else current.delete(itemId);
      return { ...prev, selectedItemIds: Array.from(current) };
    });
  };

  const handleOpenEditMergedDialog = (item: any) => {
    const itemId = String(item?.id ?? '');
    if (!itemId) {
      setToast({ type: 'error', message: 'Invalid merged item.' });
      return;
    }

    const activityToCandidate = new Map<string, string>();
    mergeCandidates.forEach((candidate: any) => {
      if (candidate.source_type === 'activity' && candidate.source_activity_id) {
        activityToCandidate.set(String(candidate.source_activity_id), String(candidate.id));
      }
    });

    const selectedIds: string[] = [];
    const mergeSources = Array.isArray(item?.merge_sources) ? item.merge_sources : [];
    mergeSources.forEach((src: any) => {
      const srcType = String(src?.source_type ?? '').toLowerCase();
      if (srcType === 'activity') {
        const candidateId = activityToCandidate.get(String(src?.source_activity_id ?? ''));
        if (candidateId) selectedIds.push(candidateId);
      } else if (srcType === 'manual') {
        const candidateId = String(src?.source_item_id ?? '');
        if (candidateId && mergeCandidates.some((candidate: any) => String(candidate.id) === candidateId)) {
          selectedIds.push(candidateId);
        }
      }
    });

    setEditingMergedItemId(itemId);
    setMergeForm({
      title: String(item?.title ?? ''),
      component: String(item?.component ?? 'written'),
      strategy: String(item?.merge_strategy ?? 'sum'),
      selectedItemIds: Array.from(new Set(selectedIds)),
    });
    setManageMergedDialogOpen(false);
    setMergeDialogOpen(true);
  };

  const handleDeleteMergedItem = async (item: any) => {
    const itemId = String(item?.id ?? '');
    if (!itemId) {
      setToast({ type: 'error', message: 'Invalid merged item.' });
      return;
    }

    try {
      const ok = await confirm({
        title: 'Delete merged column?',
        description: `This will remove "${String(item?.title ?? 'Merged Column')}" from the class record.`,
        confirmText: 'Delete',
        variant: 'destructive',
      });
      if (!ok) return;

      await apiDelete(API_ENDPOINTS.GRADING_INPUT_BY_ID(itemId));
      setToast({ type: 'success', message: 'Merged column deleted.' });
      setReloadToken(prev => prev + 1);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message ?? 'Failed to delete merged column.' });
    }
  };

  const handleCreateManualInput = async () => {
    const effectivePeriodId = selectedPeriodId ?? urlPeriodId;
    if (!selectedCourse || !selectedSection || !effectivePeriodId) {
      setToast({ type: 'error', message: 'Missing course, section, or academic period.' });
      return;
    }

    const title = manualInputForm.title.trim();
    const component = manualInputForm.component.trim().toLowerCase();
    const maxScore = Number(manualInputForm.maxScore);

    if (!title) {
      setToast({ type: 'error', message: 'Title is required.' });
      return;
    }
    if (!['written', 'performance', 'quarterly'].includes(component)) {
      setToast({ type: 'error', message: 'Invalid component selected.' });
      return;
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setToast({ type: 'error', message: 'HPS must be greater than 0.' });
      return;
    }

    try {
      setSavingManualInput(true);
      await apiPost(API_ENDPOINTS.GRADING_INPUTS, {
        course_id: Number(selectedCourse),
        section_id: Number(selectedSection),
        academic_period_id: Number(effectivePeriodId),
        quarter: selectedQuarter || null,
        title,
        component,
        max_score: maxScore,
        source_type: 'manual',
      });
      setToast({ type: 'success', message: 'Manual grading input added.' });
      setManualInputDialogOpen(false);
      setReloadToken(prev => prev + 1);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message ?? 'Failed to add manual input.' });
    } finally {
      setSavingManualInput(false);
    }
  };

  const handleUpdateManualInput = async () => {
    if (!editingInputItem) return;
    const title = editInputForm.title.trim();
    const maxScore = Number(editInputForm.maxScore);
    if (!title) {
      setToast({ type: 'error', message: 'Title is required.' });
      return;
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setToast({ type: 'error', message: 'HPS must be greater than 0.' });
      return;
    }
    try {
      setSavingEditInput(true);
      await apiPut(API_ENDPOINTS.GRADING_INPUT_BY_ID(editingInputItem.id), {
        title,
        max_score: maxScore,
      });
      setToast({ type: 'success', message: 'Column updated.' });
      setEditInputDialogOpen(false);
      setEditingInputItem(null);
      setReloadToken(prev => prev + 1);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message ?? 'Failed to update column.' });
    } finally {
      setSavingEditInput(false);
    }
  };

  const handleCreateMergedInput = async () => {
    const effectivePeriodId = selectedPeriodId ?? urlPeriodId;
    if (!selectedCourse || !selectedSection || !effectivePeriodId) {
      setToast({ type: 'error', message: 'Missing course, section, or academic period.' });
      return;
    }

    const title = mergeForm.title.trim();
    const component = mergeForm.component.trim().toLowerCase();
    const strategy = mergeForm.strategy.trim().toLowerCase();

    if (!title) {
      setToast({ type: 'error', message: 'Merged column title is required.' });
      return;
    }
    if (!['written', 'performance', 'quarterly'].includes(component)) {
      setToast({ type: 'error', message: 'Invalid component selected.' });
      return;
    }
    if (!['sum', 'average'].includes(strategy)) {
      setToast({ type: 'error', message: 'Invalid merge strategy selected.' });
      return;
    }
    if (selectedMergeCandidates.length < 2) {
      setToast({ type: 'error', message: 'Select at least 2 columns to merge.' });
      return;
    }

    const maxScore = Number(mergeComputedHps.toFixed(2));
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      setToast({ type: 'error', message: 'Computed HPS is invalid.' });
      return;
    }

    const mergeSources = selectedMergeCandidates
      .map((item: any) => {
        if (item.source_type === 'activity') {
          if (!item.source_activity_id) return null;
          return {
            source_type: 'activity',
            source_activity_id: Number(item.source_activity_id),
            weight: 1,
          };
        }
        return {
          source_type: 'manual',
          source_item_id: Number(item.id),
          weight: 1,
        };
      })
      .filter(Boolean);

    if (mergeSources.length < 2) {
      setToast({ type: 'error', message: 'Unable to build merge sources from selected columns.' });
      return;
    }

    const editingItem = editingMergedItemId
      ? (gradingItems || []).find((item: any) => String(item.id) === String(editingMergedItemId))
      : null;

    const displayOrder = editingItem
      ? Number(editingItem.display_order ?? 0)
      : (gradingItems || [])
          .filter((item: any) => String(item.component ?? '') === component)
          .reduce((max: number, item: any) => Math.max(max, Number(item.display_order ?? 0)), 0) + 1;

    try {
      setSavingMergedInput(true);
      const payload = {
        course_id: Number(selectedCourse),
        section_id: Number(selectedSection),
        academic_period_id: Number(effectivePeriodId),
        quarter: selectedQuarter || null,
        title,
        component,
        max_score: maxScore,
        source_type: 'merged',
        merge_strategy: strategy,
        display_order: displayOrder,
        merge_sources: mergeSources,
      };

      if (editingMergedItemId) {
        await apiPut(API_ENDPOINTS.GRADING_INPUT_BY_ID(editingMergedItemId), payload);
      } else {
        await apiPost(API_ENDPOINTS.GRADING_INPUTS, payload);
      }

      setToast({ type: 'success', message: editingMergedItemId ? 'Merged grading input updated.' : 'Merged grading input created.' });
      setMergeDialogOpen(false);
      setEditingMergedItemId(null);
      setReloadToken(prev => prev + 1);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message ?? (editingMergedItemId ? 'Failed to update merged input.' : 'Failed to create merged input.') });
    } finally {
      setSavingMergedInput(false);
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading class record...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-4 bg-background">
      {toast && (
        <AlertMessage type={toast.type} message={toast.message} onClose={closeToast} duration={2500} />
      )}

      {/* Edit Manual Input Dialog */}
      <Dialog open={editInputDialogOpen} onOpenChange={(open) => { setEditInputDialogOpen(open); if (!open) setEditingInputItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Column</DialogTitle>
            <DialogDescription>Update the title and highest possible score for this column.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-input-title">Title</Label>
              <Input
                id="edit-input-title"
                value={editInputForm.title}
                onChange={(e) => setEditInputForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-input-hps">Highest Possible Score (HPS)</Label>
              <Input
                id="edit-input-hps"
                type="number"
                min="1"
                step="0.01"
                value={editInputForm.maxScore}
                onChange={(e) => setEditInputForm(prev => ({ ...prev, maxScore: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInputDialogOpen(false)} disabled={savingEditInput}>Cancel</Button>
            <Button onClick={handleUpdateManualInput} disabled={savingEditInput}>
              {savingEditInput ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualInputDialogOpen} onOpenChange={setManualInputDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Input</DialogTitle>
            <DialogDescription>
              Create a manual grading column for this class record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="manual-input-title">Title</Label>
              <Input
                id="manual-input-title"
                placeholder="e.g., Oral Recitation"
                value={manualInputForm.title}
                onChange={(e) => setManualInputForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Component</Label>
              <Select
                value={manualInputForm.component}
                onValueChange={(value) => setManualInputForm(prev => ({ ...prev, component: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select component" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="written">Written Works</SelectItem>
                  <SelectItem value="performance">Performance Tasks</SelectItem>
                  <SelectItem value="quarterly">Quarterly Assessment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-input-hps">Highest Possible Score (HPS)</Label>
              <Input
                id="manual-input-hps"
                type="number"
                min="1"
                step="0.01"
                value={manualInputForm.maxScore}
                onChange={(e) => setManualInputForm(prev => ({ ...prev, maxScore: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualInputDialogOpen(false)} disabled={savingManualInput}>
              Cancel
            </Button>
            <Button onClick={handleCreateManualInput} disabled={savingManualInput}>
              {savingManualInput ? 'Creating...' : 'Create Input'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mergeDialogOpen}
        onOpenChange={(open) => {
          setMergeDialogOpen(open);
          if (!open) setEditingMergedItemId(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingMergedItemId ? 'Edit Merged Column' : 'Merge Columns'}</DialogTitle>
            <DialogDescription>
              {editingMergedItemId
                ? 'Update merged column settings and source mappings.'
                : 'Combine multiple source columns into one computed grading input.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="merge-input-title">Merged Column Title</Label>
              <Input
                id="merge-input-title"
                placeholder="e.g., Quiz Cluster 1"
                value={mergeForm.title}
                onChange={(e) => setMergeForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Target Component</Label>
                <Select
                  value={mergeForm.component}
                  onValueChange={(value) => setMergeForm(prev => ({ ...prev, component: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select component" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="written">Written Works</SelectItem>
                    <SelectItem value="performance">Performance Tasks</SelectItem>
                    <SelectItem value="quarterly">Quarterly Assessment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Merge Strategy</Label>
                <Select
                  value={mergeForm.strategy}
                  onValueChange={(value) => setMergeForm(prev => ({ ...prev, strategy: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="average">Average</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Source Columns</Label>
              <div className="max-h-56 overflow-y-auto rounded-md border p-3 space-y-2">
                {mergeCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No available source columns yet.</p>
                ) : (
                  mergeCandidates.map((item: any) => {
                    const checked = mergeForm.selectedItemIds.includes(String(item.id));
                    return (
                      <label key={item.id} className="flex items-start gap-3 rounded px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleMergeCandidate(String(item.id), value === true)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.component} • HPS {Number(item.max_score ?? 0).toFixed(2)} • {item.source_type}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Selected columns</span>
                <span className="font-medium">{selectedMergeCandidates.length}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-muted-foreground">Computed HPS</span>
                <span className="font-semibold">{mergeComputedHps.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} disabled={savingMergedInput}>
              Cancel
            </Button>
            <Button onClick={handleCreateMergedInput} disabled={savingMergedInput}>
              {savingMergedInput ? (editingMergedItemId ? 'Saving...' : 'Creating...') : (editingMergedItemId ? 'Save Changes' : 'Create Merged Column')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageMergedDialogOpen} onOpenChange={setManageMergedDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Merged Columns</DialogTitle>
            <DialogDescription>
              Edit or delete existing merged columns for this class record.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[420px] overflow-y-auto space-y-2">
            {mergedItems.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No merged columns yet.
              </div>
            ) : (
              mergedItems.map((item: any) => (
                <div key={String(item.id)} className="rounded-md border p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{String(item.title ?? 'Merged Column')}</div>
                    <div className="text-xs text-muted-foreground">
                      {String(item.component ?? 'written')} • {String(item.merge_strategy ?? 'sum')} • HPS {Number(item.max_score ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditMergedDialog(item)}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteMergedItem(item)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageMergedDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {courseInfo.code ? `${courseInfo.code} - ${courseInfo.title}` : 'Edit Class Record'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {courseInfo.code ? `Teacher: ${courseInfo.teacher} | Section: ${courseInfo.section}` : selectedQuarter}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleOpenManualInputDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Manual Input
          </Button>
          <Button variant="outline" onClick={handleOpenMergeDialog}>
            Merge Columns
          </Button>
          <Button variant="outline" onClick={() => setManageMergedDialogOpen(true)}>
            Manage Merged
          </Button>
          <Button onClick={handleSaveGrades}>
            <Save className="h-4 w-4 mr-2" />
            Save & Close
          </Button>
        </div>
      </div>

      {/* Course Info Banner */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">{courseInfo.code} - {courseInfo.title}</p>
              <p className="text-sm text-muted-foreground">Teacher: {courseInfo.teacher} | Section: {courseInfo.section}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {selectedQuarter || 'Quarter'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Students Count */}
      <div className="mb-4 flex items-center justify-between px-2">
        <div className="text-sm font-medium">Total Students: {grades.length}</div>
        <div className="text-sm text-muted-foreground">HPS = Highest Possible Score • PS = Percentage Score • WS = Weighted Score</div>
      </div>

      {/* TanStack Table */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Full Edit View
              </CardTitle>
              <CardDescription>
                Click cells to edit • Drag column headers to reorder • Sort by clicking column headers
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ID / Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="h-full overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 z-20 bg-background shadow-sm">
                {table.getHeaderGroups().map((headerGroup, idx) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const headerId = header.column.id;
                      const canSortHeader = manuallySortableComputedColumns.has(headerId) || header.column.getCanSort();
                      const fixedColumns = [
                        'id', 'name',
                        'written_total', 'written_ps', 'written_ws',
                        'performance_total', 'performance_ps', 'performance_ws',
                        'quarterly_total', 'quarterly_ps', 'quarterly_ws',
                        'initial_grade', 'final_grade',
                      ];
                      const componentGroups = ['written', 'performance', 'quarterly'];
                      const canDrag = !fixedColumns.includes(headerId) && idx > 0;
                      // Group headers (idx=0) for written/performance/quarterly can also accept drops
                      const isComponentGroupHeader = idx === 0 && componentGroups.includes(headerId);
                      const canDrop = canDrag || isComponentGroupHeader;

                      const handleDrop = async (e: React.DragEvent) => {
                        if (!draggedColumn || draggedColumn === headerId) return;
                        e.preventDefault();

                        // Determine target component from group header OR from target leaf column
                        let targetComponent: string | null = null;
                        if (isComponentGroupHeader) {
                          targetComponent = headerId; // e.g. 'written' | 'performance' | 'quarterly'
                        } else {
                          const targetItem = allGradeItems.find((it: any) => it.field === headerId);
                          targetComponent = targetItem?.component ?? null;
                        }

                        const draggedItem = allGradeItems.find((it: any) => it.field === draggedColumn);
                        const draggedComponent = draggedItem?.component ?? null;

                        // Cross-component drop → update via API
                        if (targetComponent && draggedComponent && targetComponent !== draggedComponent && draggedItem) {
                          try {
                            await apiPut(API_ENDPOINTS.GRADING_INPUT_BY_ID(draggedItem.id), {
                              component: targetComponent,
                            });
                            setToast({ type: 'success', message: `Moved "${draggedItem.title}" to ${targetComponent.charAt(0).toUpperCase() + targetComponent.slice(1)}.` });
                            setReloadToken(prev => prev + 1);
                          } catch (err: any) {
                            setToast({ type: 'error', message: err?.message ?? 'Failed to move column.' });
                          }
                          setDraggedColumn(null);
                          return;
                        }

                        // Same-component drop → reorder only
                        const currentOrder = table.getState().columnOrder;
                        const currentCols = currentOrder.length > 0 ? currentOrder : table.getAllLeafColumns().map(c => c.id);
                        const draggedIdx = currentCols.indexOf(draggedColumn);
                        const targetIdx = currentCols.indexOf(headerId);
                        if (draggedIdx !== -1 && targetIdx !== -1) {
                          const newOrder = [...currentCols];
                          newOrder.splice(draggedIdx, 1);
                          newOrder.splice(targetIdx, 0, draggedColumn);
                          setColumnOrder(newOrder);
                        }
                        setDraggedColumn(null);
                      };

                      return (
                        <th
                          key={header.id}
                          colSpan={header.colSpan}
                          className={`${getColumnClassName(headerId, true, idx)} ${canDrag ? 'cursor-move' : ''} ${draggedColumn === headerId ? 'opacity-50' : ''} ${isComponentGroupHeader && draggedColumn ? 'ring-2 ring-inset ring-primary/40' : ''}`}
                          draggable={canDrag}
                          onDragStart={() => canDrag && setDraggedColumn(headerId)}
                          onDragOver={(e) => {
                            if (canDrop && draggedColumn) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                            }
                          }}
                          onDrop={handleDrop}
                          onDragEnd={() => setDraggedColumn(null)}
                        >
                          {header.isPlaceholder ? null : (
                            <div className="flex items-center gap-1">
                              {canDrag && <GripVertical className="h-3 w-3 text-muted-foreground" />}
                              {canSortHeader ? (
                                <button
                                  type="button"
                                  className="flex-1 text-left hover:opacity-70 transition-opacity"
                                  onClick={() => toggleColumnSort(header.column.id)}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </button>
                              ) : (
                                <div className="flex-1 text-left">
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                </div>
                              )}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const isHps = !!row.original.__hps;
                  const isGenderLabel = !!row.original.__gender_label;

                  if (isGenderLabel) {
                    return (
                      <tr key={row.id} className="border-y border-slate-300 bg-slate-100/70">
                        <td colSpan={row.getVisibleCells().length} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {String(row.original.__label_text ?? 'Unspecified')}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={row.id} className={isHps ? 'bg-gradient-to-r from-slate-100 to-slate-50 font-semibold border-y-2 border-slate-300' : 'bg-white hover:bg-slate-50/50 transition-colors'}>
                      {row.getVisibleCells().map((cell) => {
                        const colId = cell.column.id;
                        const isStickyId = colId === 'id';
                        const isStickyName = colId === 'name';
                        return (
                          <td
                            key={cell.id}
                            className={`${getColumnClassName(colId)} ${isStickyId || isStickyName ? (isHps ? 'bg-slate-100' : 'bg-white') : ''}`}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GradeInputEdit;
