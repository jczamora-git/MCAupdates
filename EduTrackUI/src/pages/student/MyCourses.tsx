import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import AccessLockedCard from "@/components/AccessLockedCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, User, Loader2, Phone, Mail, IdCard, GraduationCap, Calendar, Award, Search, Grid3x3, List } from "lucide-react";
import { API_ENDPOINTS, apiGet } from "@/lib/api";

const MyCourses = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [hasActiveEnrollmentRecord, setHasActiveEnrollmentRecord] = useState<boolean | null>(null);
  const [activeSchoolYear, setActiveSchoolYear] = useState<string>("");

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "student") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);

        // Check active academic period and gate access by enrollment record for that period
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

        const resolvedSY = activePeriod?.school_year || '';
        setActiveSchoolYear(resolvedSY);

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
          return;
        }

        // declarations for values used across this function
        let studentYearLevelNum: number | null = null;
        let studentSectionId: any = null;

        // Fetch student info to get year_level and section_id (use by-user endpoint)
        const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_USER(user.id));
        const student = studentRes.data || studentRes.student || studentRes || null;
        
        if (!student) {
          console.error('Student record not found for user:', user.id);
          setCourses([]);
          setLoading(false);
          return;
        }

        // Compute a display-friendly year label for the student (e.g. '2nd Year')
        const ordinal = (n: number) => {
          if (!Number.isFinite(n)) return String(n);
          if (n % 10 === 1 && n % 100 !== 11) return `${n}st Year`;
          if (n % 10 === 2 && n % 100 !== 12) return `${n}nd Year`;
          if (n % 10 === 3 && n % 100 !== 13) return `${n}rd Year`;
          return `${n}th Year`;
        };

        const studentYearLevelRawVal = student.year_level ?? student.yearLevel ?? null;
        let displayYearLabel = 'N/A';
        if (studentYearLevelRawVal != null) {
          if (typeof studentYearLevelRawVal === 'number') displayYearLabel = ordinal(studentYearLevelRawVal);
          else if (typeof studentYearLevelRawVal === 'string') {
            const raw = studentYearLevelRawVal.trim();
            if (/year/i.test(raw)) {
              displayYearLabel = raw; // already contains 'Year'
            } else {
              const m = raw.match(/(\d+)/);
              if (m) displayYearLabel = ordinal(Number(m[1]));
              else if (/^\d+(st|nd|rd|th)$/i.test(raw)) displayYearLabel = `${raw} Year`;
              else displayYearLabel = raw;
            }
          } else {
            displayYearLabel = String(studentYearLevelRawVal);
          }
        }

        // Normalize year level to a numeric value (supports '2nd Year', '2', or 2)
        const studentYearLevelRaw = student.year_level ?? student.yearLevel;
        if (typeof studentYearLevelRaw === 'number') studentYearLevelNum = studentYearLevelRaw;
        else if (typeof studentYearLevelRaw === 'string') {
          const m = String(studentYearLevelRaw).match(/(\d+)/);
          studentYearLevelNum = m ? Number(m[1]) : null;
        }
        studentSectionId = student.section_id || student.sectionId;

        // store student info along with a computed display label and numeric year
        const studentInfoObj: any = { ...student, displayYearLabel, yearLevelNum: studentYearLevelNum };

        // Resolve section details (name, description) for nicer header display
        if (studentSectionId) {
          try {
            const secRes = await apiGet(`${API_ENDPOINTS.SECTIONS}/${encodeURIComponent(studentSectionId)}`);
            const sec = secRes.data || secRes.section || secRes || null;
            if (sec) {
              studentInfoObj.section_name = sec.name || student.section_name || student.sectionName || sec.title || studentInfoObj.section_name;
              studentInfoObj.section_description = sec.description || studentInfoObj.section_description || student.description || sec.desc || '';
            }
          } catch (err) {
            console.warn('Failed to fetch section details for header display', err);
          }
        }

        setStudentInfo(studentInfoObj);

        // Active period already fetched above and reused here for semester filtering
        if (!activePeriod) {
          console.warn('No active academic period found');
          setCourses([]);
          setLoading(false);
          return;
        }

        // Extract semester from active period (e.g., "1st Semester" -> "1st")
        const semesterMatch = (activePeriod.semester || '').match(/^(\d+)(st|nd|rd|th)/i);
        const currentSemesterShort = semesterMatch ? (String(semesterMatch[1]) === '1' ? '1st' : '2nd') : null;

        // Build candidate semester params (try short form '1st' then numeric '1')
        const subjectsQueryBase = new URLSearchParams();
        if (studentYearLevelNum) subjectsQueryBase.set('year_level', String(studentYearLevelNum));

        let subjects: any[] = [];

        const semesterCandidates: (string | null)[] = [];
        if (currentSemesterShort) {
          semesterCandidates.push(currentSemesterShort);
          // also try numeric form '1' or '2'
          semesterCandidates.push(currentSemesterShort.startsWith('1') ? '1' : '2');
        } else {
          semesterCandidates.push(null);
        }

        // Try server-side filtered fetches with different semester representations using student-accessible endpoint
        let fetched = false;
        for (const sem of semesterCandidates) {
          try {
            const params = new URLSearchParams(subjectsQueryBase.toString());
            if (sem) params.set('semester', sem);
            console.debug('Trying subjects fetch (student endpoint) with params:', params.toString());
            const subjectsRes = await apiGet(`${API_ENDPOINTS.SUBJECTS_FOR_STUDENT}?${params.toString()}`);
            const rows = subjectsRes.data || subjectsRes.subjects || subjectsRes || [];
            if (Array.isArray(rows) && rows.length > 0) {
              subjects = rows;
              fetched = true;
              break;
            }
            // if returned empty, continue to next candidate
          } catch (err) {
            console.warn('Subjects fetch failed for semester', sem, err);
            // try next candidate
          }
        }

        // If server-side attempts failed or returned empty, try student endpoint without semester
        if (!fetched) {
          try {
            const params = new URLSearchParams();
            if (studentYearLevelNum) params.set('year_level', String(studentYearLevelNum));
            console.debug('Trying subjects fetch (student endpoint) without semester:', params.toString());
            const subjectsRes = await apiGet(`${API_ENDPOINTS.SUBJECTS_FOR_STUDENT}?${params.toString()}`);
            const rows = subjectsRes.data || subjectsRes.subjects || subjectsRes || [];
            console.debug('MyCourses: subjects fetch fallback rows:', rows?.length ?? 0, rows);
            if (Array.isArray(rows)) subjects = rows;
          } catch (err) {
            console.error('Failed to fetch subjects from student endpoint fallback', err);
            subjects = [];
          }
        }

        // Fetch teacher info from teacher_subject_assignments (joins teachers+users for names)
        let teacherMap = new Map<number, { id: number; first_name: string; last_name: string }>();
        try {
          // Collect subject IDs to query only the needed teachers
          const subjectIds = (Array.isArray(subjects) ? subjects : []).map((s: any) => s?.id).filter(Boolean);
          const url = subjectIds.length
            ? `${API_ENDPOINTS.TEACHER_SUBJECT_ASSIGNMENTS}?subject_id=${subjectIds.join(',')}`
            : API_ENDPOINTS.TEACHER_SUBJECT_ASSIGNMENTS;
          const tsaRes = await apiGet(url);
          const tMap: Record<string, any> = tsaRes.teachers || {};
          for (const [subjectId, tInfo] of Object.entries(tMap)) {
            const t: any = tInfo;
            teacherMap.set(Number(subjectId), {
              id: t.teacher_id,
              first_name: t.first_name || '',
              last_name: t.last_name || '',
            });
          }
        } catch (err) {
          console.warn('Failed to fetch subject teachers', err);
        }

        // Map subjects to course cards with teacher info using the teacherMap
        const mappedCourses = (Array.isArray(subjects) ? subjects : []).map((subject: any) => {
          const subjId = subject?.id ?? subject?.subject_id ?? null;
          const teacherObj = subjId != null ? teacherMap.get(Number(subjId)) ?? null : null;

          const teacherName = teacherObj
            ? `${teacherObj.first_name} ${teacherObj.last_name}`.trim() || 'TBA'
            : 'TBA';
          const teacherId = teacherObj?.id ?? null;

          return {
            id: subject.id,
            title: subject.course_name || subject.title || subject.name || 'Untitled Course',
            code: subject.course_code || subject.code || 'N/A',
            teacher: teacherName,
            teacherId: teacherId,
            section: student.section_name || studentSectionId || 'N/A',
            credits: subject.units || subject.credits || 3,
            semester: subject.semester || currentSemesterShort || 'N/A',
            yearLevel: subject.year_level ?? subject.yearLevel ?? studentYearLevelRaw ?? 'N/A',
            grade: null // Will be calculated from activities later
          };
        });

        setCourses(mappedCourses);
      } catch (error) {
        console.error('Error fetching courses:', error);
        setHasActiveEnrollmentRecord(true);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user?.role === 'student') {
      fetchCourses();
    }
  }, [user, isAuthenticated]);

  // Filter courses based on search
  const filteredCourses = courses.filter((course) =>
    course.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.teacher?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewTeacher = async (teacherId: number | string) => {
    if (!teacherId) {
      // Show a message that teacher info is not available
      setSelectedTeacher({ 
        first_name: 'Not', 
        last_name: 'Assigned',
        email: 'N/A',
        phone: 'N/A',
        employee_id: 'N/A',
        assigned_courses: []
      });
      setTeacherDialogOpen(true);
      return;
    }

    try {
      setLoadingTeacher(true);
      setTeacherDialogOpen(true);
      
      const response = await apiGet(API_ENDPOINTS.TEACHER_BY_ID_PUBLIC(teacherId));
      const teacherData = response.data || response.teacher || response || null;
      
      if (teacherData) {
        setSelectedTeacher(teacherData);
      } else {
        setSelectedTeacher({
          first_name: 'Teacher',
          last_name: 'Information',
          email: 'Not available',
          phone: 'N/A',
          employee_id: 'N/A',
          assigned_courses: []
        });
      }
    } catch (error) {
      console.error('Error fetching teacher details:', error);
      setSelectedTeacher({
        first_name: 'Error',
        last_name: 'Loading',
        email: 'Unable to load teacher information',
        phone: 'N/A',
        employee_id: 'N/A',
        assigned_courses: []
      });
    } finally {
      setLoadingTeacher(false);
    }
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
          description={`There are no enrollment records for this SY ${activeSchoolYear || 'N/A'}.`}
          benefitsTitle="What you need to do"
          benefits={[
            "Submit your enrollment for the current active school year",
            "Wait for your enrollment to be recorded in the system",
            "Return to access your subjects and class details"
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
      <div className="px-4 pb-4 pt-4 sm:px-8 sm:pb-8 sm:pt-0 bg-gradient-to-b from-background to-muted/30 min-h-screen">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md flex-shrink-0">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight">
                My Subjects
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {studentInfo ? (
                  studentInfo.yearLevelNum && studentInfo.section_name
                    ? `${studentInfo.yearLevelNum}-${studentInfo.section_name} · ${courses.length} subject${courses.length !== 1 ? 's' : ''}`
                    : `${studentInfo.displayYearLabel || ''} · ${courses.length} subject${courses.length !== 1 ? 's' : ''}`
                ) : (
                  'View all your enrolled courses'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="shadow-md border-0">
          <CardHeader className="hidden sm:block bg-gradient-to-r from-muted/40 to-muted/20 border-b py-4 px-4 sm:px-6">
            {/* Filters and Controls — single scrollable row */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
              {/* Search */}
              <div className="relative min-w-[160px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 py-2 text-sm border rounded-xl bg-background shadow-sm"
                />
              </div>

              {/* View toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode((v) => (v === "list" ? "grid" : "list"))}
                className="flex-shrink-0 px-3 py-2 rounded-xl border gap-1.5 text-sm font-medium shadow-sm"
                title="Toggle view"
              >
                {viewMode === "grid" ? <Grid3x3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-3 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="ml-3 text-base text-muted-foreground">Loading your courses…</span>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-14 w-14 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-1">
                  {searchQuery ? "No Matching Courses" : "No Courses Found"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {searchQuery
                    ? "No courses match your search."
                    : "No courses are available for your year level and the current semester."}
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden bg-white hover:shadow-lg hover:border-primary/30"
                  >
                    {/* Card top */}
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 bg-gradient-to-br from-primary to-accent">
                        <BookOpen className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base text-gray-900 leading-snug">{course.code}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">{course.title}</p>
                      </div>
                    </div>

                    {/* Instructor row */}
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => handleViewTeacher(course.teacherId)}
                        className="w-full flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center flex-shrink-0 transition-colors">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground leading-none">Teacher</p>
                          <p className="font-medium truncate text-gray-900 text-sm">{course.teacher}</p>
                        </div>
                      </button>
                    </div>

                    {/* View Course button */}
                    <div className="px-4 pb-4 mt-auto">
                      <Button
                        onClick={() => navigate(`/student/courses/${course.id}`)}
                        className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-sm font-medium text-sm"
                      >
                        <BookOpen className="h-4 w-4 mr-2" />
                        View Course
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-2xl border transition-all duration-200 flex items-center gap-3 p-3 bg-white hover:shadow-md hover:border-primary/30"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 bg-gradient-to-br from-primary to-accent">
                      <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="font-semibold text-sm text-gray-900 truncate">{course.title}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0 font-medium">{course.code}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{course.teacher}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/student/courses/${course.id}`)}
                      className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg"
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Teacher Details Dialog */}
      <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Teacher Information</DialogTitle>
            <DialogDescription>
              Contact details for this teacher
            </DialogDescription>
          </DialogHeader>
          {loadingTeacher ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedTeacher ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedTeacher.first_name} {selectedTeacher.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">Teacher</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <IdCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Employee ID:</span>
                  <span className="font-medium">{selectedTeacher.employee_id || 'N/A'}</span>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <a 
                    href={`mailto:${selectedTeacher.email}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {selectedTeacher.email || 'N/A'}
                  </a>
                </div>

                {selectedTeacher.phone && selectedTeacher.phone !== 'N/A' && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Phone:</span>
                    <a 
                      href={`tel:${selectedTeacher.phone}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {selectedTeacher.phone}
                    </a>
                  </div>
                )}
              </div>

              {selectedTeacher.assigned_courses && selectedTeacher.assigned_courses.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2 text-sm">Assigned Courses</h4>
                  <div className="space-y-1">
                    {selectedTeacher.assigned_courses.map((course: any, index: number) => (
                      <div key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{course.course || course.code} - {course.title || course.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No teacher information available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default MyCourses;
