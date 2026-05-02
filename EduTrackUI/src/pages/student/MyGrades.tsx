import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import AccessLockedCard from "@/components/AccessLockedCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Loader2, GraduationCap, BarChart3, CircleCheck, CircleX } from "lucide-react";
import { API_ENDPOINTS, apiGet } from "@/lib/api";

type CourseGradeCard = {
  id: string | number;
  subjectId: string | number;
  code: string;
  title: string;
  teacher: string;
  activeGrade: number | null;
  rawScore: number;
  maxScore: number;
  gradedActivities: number;
};

const MyGrades = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseGradeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSY, setActiveSY] = useState<string>("");
  const [hasActiveEnrollmentRecord, setHasActiveEnrollmentRecord] = useState<boolean | null>(null);
  const [gradingContext, setGradingContext] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "student") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  // Fetch student's courses and compute grades for active grading period only
  useEffect(() => {
    const fetchGrades = async () => {
      if (!user?.id) return;
      setLoading(true);

      try {
        // 1) Fetch student info to get year_level and section_id
        const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_USER(user.id));
        const student = studentRes.data || studentRes.student || studentRes || null;
        
        if (!student) {
          console.error('Student record not found for user:', user.id);
          setCourses([]);
          setLoading(false);
          return;
        }

        // Normalize year_level to numeric value (supports '2nd Year', '2', or 2)
        let studentYearLevelNum: number | null = null;
        const studentYearLevelRaw = student.year_level ?? student.yearLevel;
        if (typeof studentYearLevelRaw === 'number') studentYearLevelNum = studentYearLevelRaw;
        else if (typeof studentYearLevelRaw === 'string') {
          const m = String(studentYearLevelRaw).match(/(\d+)/);
          studentYearLevelNum = m ? Number(m[1]) : null;
        }

        // 2) Fetch active academic period for school year + enrollment gating
        let activePeriod: any = null;
        try {
          const activePeriodRes = await apiGet(`${API_ENDPOINTS.ACADEMIC_PERIODS_ACTIVE}-public`);
          activePeriod = activePeriodRes.data || activePeriodRes.period || activePeriodRes || null;
        } catch (err) {
          console.warn('Failed to fetch active period from public endpoint, trying authenticated endpoint', err);
          try {
            const activePeriodRes = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS_ACTIVE);
            activePeriod = activePeriodRes.data || activePeriodRes.period || activePeriodRes || null;
          } catch (err2) {
            console.error('Failed to fetch active period', err2);
          }
        }
        
        if (!activePeriod) {
          console.warn('No active academic period found');
          setCourses([]);
          setLoading(false);
          return;
        }

        // Store active school year for display
        if (activePeriod.school_year) {
          setActiveSY(activePeriod.school_year);
        }

        // Gate access: student must have an enrollment record for the active academic period
        let enrollmentsArray: any[] = [];
        try {
          const enrollmentResponse = await apiGet(API_ENDPOINTS.ENROLLMENTS);
          if (Array.isArray(enrollmentResponse.data)) {
            enrollmentsArray = enrollmentResponse.data;
          } else if (enrollmentResponse.data && Array.isArray(enrollmentResponse.data.data)) {
            enrollmentsArray = enrollmentResponse.data.data;
          } else if (enrollmentResponse.data?.data?.id) {
            enrollmentsArray = [enrollmentResponse.data.data];
          } else if (enrollmentResponse.data?.id) {
            enrollmentsArray = [enrollmentResponse.data];
          }
        } catch (error) {
          console.error('Error checking student enrollment records:', error);
          enrollmentsArray = [];
        }

        const hasEnrollmentForActivePeriod = activePeriod?.id
          ? enrollmentsArray.some((e: any) => {
              const periodId = e?.academic_period_id ?? e?.academicPeriodId ?? e?.enrollment_period_id;
              return String(periodId) === String(activePeriod.id);
            })
          : enrollmentsArray.length > 0;

        setHasActiveEnrollmentRecord(hasEnrollmentForActivePeriod);
        if (!hasEnrollmentForActivePeriod) {
          setCourses([]);
          setLoading(false);
          return;
        }

        // 3) Fetch active grading context for the exact grading period to display
        let resolvedGradingContext: any = null;
        try {
          const gradingContextRes = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS_GRADING_CONTEXT);
          resolvedGradingContext = gradingContextRes.data || gradingContextRes.context || gradingContextRes || null;
        } catch (err) {
          console.warn('Failed to fetch grading context', err);
        }
        if (resolvedGradingContext) setGradingContext(resolvedGradingContext);

        const activeGradingPeriodId =
          resolvedGradingContext?.current_period?.id ??
          activePeriod?.id ??
          null;

        // 4) Fetch subjects for student (same shape used by my courses)
        let subjects: any[] = [];
        try {
          const params = new URLSearchParams();
          if (studentYearLevelNum) params.set('year_level', String(studentYearLevelNum));
          const subjectsRes = await apiGet(`${API_ENDPOINTS.SUBJECTS_FOR_STUDENT}?${params.toString()}`);
          const rows = subjectsRes.data || subjectsRes.subjects || subjectsRes || [];
          subjects = Array.isArray(rows) ? rows : [];
        } catch (err) {
          console.error('Failed to fetch subjects', err);
          subjects = [];
        }

        // 5) Fetch teacher names via teacher-subject-assignments
        const teacherMap = new Map<number, { first_name: string; last_name: string }>();
        try {
          const subjectIds = (Array.isArray(subjects) ? subjects : []).map((s: any) => s?.id).filter(Boolean);
          if (subjectIds.length > 0) {
            const tsaRes = await apiGet(`${API_ENDPOINTS.TEACHER_SUBJECT_ASSIGNMENTS}?subject_id=${subjectIds.join(',')}`);
            const teachersBySubject: Record<string, any> = tsaRes.teachers || {};
            Object.entries(teachersBySubject).forEach(([subjectKey, teacherInfo]: [string, any]) => {
              teacherMap.set(Number(subjectKey), {
                first_name: teacherInfo?.first_name || '',
                last_name: teacherInfo?.last_name || '',
              });
            });
          }
        } catch (err) {
          console.warn('Failed to fetch teacher-subject-assignments', err);
        }

        // 6) Fetch grades per subject using existing student-grades endpoint used in student pages
        const sectionId = student?.section_id ?? student?.sectionId ?? null;
        const subjectActivitiesMap = new Map<string, any[]>();

        if (Array.isArray(subjects) && subjects.length > 0) {
          const calls = subjects.map(async (subject: any) => {
            const subjectId = subject?.id ?? subject?.subject_id;
            if (!subjectId) return;

            const params = new URLSearchParams();
            params.set('course_id', String(subjectId));
            params.set('student_id', String(student.id));
            if (sectionId) params.set('section_id', String(sectionId));
            if (activeGradingPeriodId) params.set('academic_period_id', String(activeGradingPeriodId));

            try {
              const res = await apiGet(`${API_ENDPOINTS.ACTIVITIES_STUDENT_GRADES}?${params.toString()}`);
              const rows = Array.isArray(res?.data) ? res.data : [];
              subjectActivitiesMap.set(String(subjectId), rows);
            } catch (err) {
              console.warn('Failed to fetch subject grades', { subjectId, err });
              subjectActivitiesMap.set(String(subjectId), []);
            }
          });

          await Promise.all(calls);
        }

        // 7) Build per-subject card metrics from active grading-period activities
        const coursesWithGrades: CourseGradeCard[] = (Array.isArray(subjects) ? subjects : []).map((subject: any, index: number) => {
          const subjectId = subject?.id ?? subject?.subject_id ?? `subject-${index}`;
          const normalizedSubjectId = String(subjectId);
          const teacherEntry = teacherMap.get(Number(subjectId));
          const teacherName = teacherEntry
            ? `${teacherEntry.first_name} ${teacherEntry.last_name}`.trim() || 'TBA'
            : (
                subject?.teacher_name ||
                (subject?.teacher?.name) ||
                ([subject?.teacher_first_name, subject?.teacher_last_name].filter(Boolean).join(' ') || 'TBA')
              );

          let rawScore = 0;
          let maxScore = 0;
          let gradedActivities = 0;

          const activitiesForSubject = subjectActivitiesMap.get(normalizedSubjectId) || [];

          activitiesForSubject.forEach((a: any) => {
            const activitySubjectCandidates = [
              a?.subject_id,
              a?.course_id,
              a?.teacher_subject_id,
              a?.subject?.id,
              a?.course?.id,
            ]
              .filter((v) => v !== undefined && v !== null)
              .map(String);

            if (!activitySubjectCandidates.includes(normalizedSubjectId)) return;

            const g = a?.student_grade ?? a?.grade ?? a?.score;
            if (g === null || g === undefined || Number.isNaN(Number(g))) return;

            gradedActivities += 1;
            rawScore += Number(g);
            maxScore += Number(a?.max_score ?? a?.maxScore ?? 100);
          });

          const activeGrade = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : null;

          return {
            id: subjectId,
            subjectId,
            code: subject?.course_code || subject?.code || 'N/A',
            title: subject?.course_name || subject?.title || subject?.name || `Subject ${index + 1}`,
            teacher: teacherName,
            activeGrade,
            rawScore,
            maxScore,
            gradedActivities,
          };
        });

        setCourses(coursesWithGrades);
      } catch (e) {
        console.error('Failed to load grades', e);
        setGradingContext(null);
        setHasActiveEnrollmentRecord(true);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user?.role === 'student') {
      fetchGrades();
    }
  }, [user, isAuthenticated]);

  const gradedCourses = useMemo(
    () => courses.filter((c) => c.activeGrade !== null),
    [courses]
  );

  const overallAverage = useMemo(() => {
    if (gradedCourses.length === 0) return null;
    const sum = gradedCourses.reduce((acc, item) => acc + Number(item.activeGrade), 0);
    return Math.round(sum / gradedCourses.length);
  }, [gradedCourses]);

  const passingCount = useMemo(
    () => gradedCourses.filter((c) => Number(c.activeGrade) >= 75).length,
    [gradedCourses]
  );

  const failingCount = useMemo(
    () => gradedCourses.filter((c) => Number(c.activeGrade) < 75).length,
    [gradedCourses]
  );

  const notYetGradedCount = courses.length - gradedCourses.length;

  const activeGradingLabel =
    gradingContext?.current_period?.quarter ||
    gradingContext?.current_period?.period_type ||
    "Current Period";

  const gradeTone = (grade: number | null) => {
    if (grade === null) return "bg-slate-100 text-slate-600 border-slate-200";
    if (grade >= 90) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (grade >= 75) return "bg-sky-100 text-sky-800 border-sky-200";
    return "bg-rose-100 text-rose-800 border-rose-200";
  };

  if (!isAuthenticated) return null;

  if (loading || hasActiveEnrollmentRecord === null) {
    return (
      <DashboardLayout fullBleed>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your enrollment access...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!loading && hasActiveEnrollmentRecord === false) {
    return (
      <DashboardLayout fullBleed>
        <AccessLockedCard
          title="Enrollment Record Required"
          description={`There are no enrollment records for this SY ${activeSY || 'N/A'}.`}
          benefitsTitle="What you need to do"
          benefits={[
            "Submit your enrollment for the current active school year",
            "Wait for your enrollment to be recorded in the system",
            "Return to access your grades once your record exists"
          ]}
          actionButton={{
            label: "Go to My Enrollments",
            onClick: () => navigate('/enrollment/my-enrollments')
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fullBleed>
      <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-0 lg:px-8 lg:pb-8 bg-gradient-to-b from-background to-muted/20 min-h-screen">
        <div className="w-full space-y-6">
          <div className="mb-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">My Grades</h1>
                <p className="text-sm text-muted-foreground">Academic report based on the active grading period</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-blue-100 bg-blue-50/40">
              <CardHeader className="pb-2">
                <CardDescription className="text-blue-700">Overall Average</CardDescription>
                <CardTitle className="text-blue-900 text-3xl">
                  {overallAverage !== null ? overallAverage : '—'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-blue-800">
                {gradedCourses.length} graded subject{gradedCourses.length === 1 ? '' : 's'}
              </CardContent>
            </Card>

            <Card className="border-emerald-100 bg-emerald-50/40">
              <CardHeader className="pb-2">
                <CardDescription className="text-emerald-700">Passing Subjects</CardDescription>
                <CardTitle className="text-emerald-900 text-3xl">{passingCount}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-emerald-800 flex items-center gap-2">
                <CircleCheck className="h-4 w-4" />
                75 and above
              </CardContent>
            </Card>

            <Card className="border-rose-100 bg-rose-50/40">
              <CardHeader className="pb-2">
                <CardDescription className="text-rose-700">Needs Improvement</CardDescription>
                <CardTitle className="text-rose-900 text-3xl">{failingCount}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-rose-800 flex items-center gap-2">
                <CircleX className="h-4 w-4" />
                Below 75
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50/60">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600">Active Grading</CardDescription>
                <CardTitle className="text-slate-900 text-xl leading-tight">{activeGradingLabel}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-slate-700">
                {activeSY ? `SY ${activeSY}` : 'School year unavailable'}
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Per Subject Grades
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Showing grades for {activeGradingLabel.toLowerCase()} only.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="self-start sm:self-center">
                  {gradingContext?.message || 'Current grading context'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground text-sm">Loading grades...</span>
                </div>
              ) : courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                    <BookOpen className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="font-medium text-muted-foreground">No subjects found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Grades will appear once subjects and activities are available for the active period</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {courses.map((course) => (
                      <div key={course.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{course.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{course.code}</p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1 text-sm font-bold ${gradeTone(course.activeGrade)}`}>
                            {course.activeGrade !== null ? course.activeGrade : '—'}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground truncate">Instructor: {course.teacher || 'TBA'}</p>

                        <Progress
                          value={Math.max(0, Math.min(100, course.activeGrade ?? 0))}
                          className="mt-3 h-2 bg-muted"
                        />

                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{course.gradedActivities} graded activit{course.gradedActivities === 1 ? 'y' : 'ies'}</span>
                          <span>
                            {course.maxScore > 0 ? `${Math.round(course.rawScore)}/${Math.round(course.maxScore)} pts` : 'No scores yet'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40 inline-block" />
                      Passing (75+)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-500/40 inline-block" />
                      Below 75
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 border border-slate-400 inline-block" />
                      Not yet graded
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/20 border border-sky-500/40 inline-block" />
                      Graded in active period only
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {notYetGradedCount > 0 && (
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              {notYetGradedCount} subject{notYetGradedCount === 1 ? '' : 's'} currently have no graded activities in {activeGradingLabel.toLowerCase()}.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MyGrades;
