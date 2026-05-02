import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ClipboardList, Calendar, FileText, Eye, Target, Megaphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { useNotificationContext } from "@/context/NotificationContext";
import { useAnnouncements, useUnreadCount } from "@/hooks/useNotifications";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import readingSubjectImage from "@/assets/images/subjects/reading.png";
import mathSubjectImage from "@/assets/images/subjects/math.png";
import mapehSubjectImage from "@/assets/images/subjects/mapeh.png";
import makabansaSubjectImage from "@/assets/images/subjects/makabansa.png";
import languageSubjectImage from "@/assets/images/subjects/language.png";
import gmrcSubjectImage from "@/assets/images/subjects/gmrc.png";
import filipinoSubjectImage from "@/assets/images/subjects/filipino.png";
import ethicsSubjectImage from "@/assets/images/subjects/ethics.png";
import eppSubjectImage from "@/assets/images/subjects/epp.png";
import englishSubjectImage from "@/assets/images/subjects/english.png";
import basicScienceSubjectImage from "@/assets/images/subjects/basicscience.png";
import basicMathSubjectImage from "@/assets/images/subjects/basicmath.png";

import { useEffect, useState } from "react";

type EnrollmentStatus = 'Pending' | 'Under Review' | 'Incomplete' | 'Verified' | 'Approved' | 'Rejected' | 'Unknown';

const normalizeSubjectText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isPreschoolLevel = (level: unknown, code: unknown) => {
  const normalizedLevel = normalizeSubjectText(level);
  const normalizedCode = normalizeSubjectText(code);
  return (
    normalizedLevel.includes("nursery") ||
    normalizedLevel.includes("kinder") ||
    /(^|\s)(n1|n2|kn)(\s|$)/.test(normalizedCode)
  );
};

const getSubjectImage = (subject: any) => {
  const code = normalizeSubjectText(subject?.course_code ?? subject?.code);
  const name = normalizeSubjectText(subject?.name ?? subject?.course_name ?? subject?.title);
  const level = normalizeSubjectText(subject?.level ?? subject?.year_level);
  const preschool = isPreschoolLevel(level, code);

  if (code.includes("read") || name.includes("reading")) return readingSubjectImage;
  if (code.includes("lang") || name.includes("language development")) return languageSubjectImage;
  if (code.includes("engl") || name.includes("english")) return englishSubjectImage;
  if (code.includes("fili") || name.includes("filipino")) return filipinoSubjectImage;
  if (code.includes("gmrc") || name.includes("good manners")) return gmrcSubjectImage;
  if (code.includes("esp") || name.includes("ethics")) return ethicsSubjectImage;
  if (code.includes("mapeh") || name.includes("music") || name.includes("arts") || name.includes("pe") || name.includes("health")) return mapehSubjectImage;
  if (code.includes("epp") || name.includes("livelihood") || name.includes("entrepreneurship")) return eppSubjectImage;
  if (code.includes("maka") || code.startsWith("ap") || name.includes("makabansa") || name.includes("araling panlipunan") || name.includes("patriotism")) return makabansaSubjectImage;
  if (code.includes("sci") || name.includes("science")) return basicScienceSubjectImage;
  if (code.includes("math") || name.includes("math")) return preschool || name.includes("basic math") ? basicMathSubjectImage : mathSubjectImage;

  if (preschool) return languageSubjectImage;
  return mathSubjectImage;
};

const normalizeEnrollmentStatus = (status: unknown): EnrollmentStatus => {
  const value = String(status ?? '').trim().toLowerCase();

  switch (value) {
    case 'pending':
      return 'Pending';
    case 'under review':
      return 'Under Review';
    case 'incomplete':
      return 'Incomplete';
    case 'verified':
      return 'Verified';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Unknown';
  }
};

const getEnrollmentStatusUi = (status: EnrollmentStatus) => {
  if (status === 'Approved') {
    return {
      card: 'border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50',
      iconBg: 'bg-blue-100',
      iconText: 'text-blue-600',
      title: 'text-blue-900',
      description: 'text-blue-700',
      body: 'text-blue-800',
      mobile: 'Approved for this school year.',
      desktopShort: 'Your enrollment has been approved for the upcoming academic year.',
      desktopBody: 'Your enrollment has been approved. You are all set for the upcoming academic year. You can now view your class schedule.',
      summaryBorder: 'border-indigo-100/70',
      summaryBar: 'from-indigo-500 to-blue-500',
      summaryIconBg: 'bg-blue-100',
      summaryIconText: 'text-blue-600',
      summaryValueText: 'text-blue-700',
    };
  }

  if (status === 'Verified') {
    return {
      card: 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50',
      iconBg: 'bg-emerald-100',
      iconText: 'text-emerald-600',
      title: 'text-emerald-900',
      description: 'text-emerald-700',
      body: 'text-emerald-800',
      mobile: 'Verified and ready for final approval.',
      desktopShort: 'Your enrollment documents have been verified and are ready for final approval.',
      desktopBody: 'Your enrollment is verified. Please wait for final confirmation from the registrar.',
      summaryBorder: 'border-emerald-100/70',
      summaryBar: 'from-emerald-500 to-green-500',
      summaryIconBg: 'bg-emerald-100',
      summaryIconText: 'text-emerald-600',
      summaryValueText: 'text-emerald-700',
    };
  }

  if (status === 'Pending') {
    return {
      card: 'border-violet-300 bg-gradient-to-r from-violet-50 to-indigo-50',
      iconBg: 'bg-violet-100',
      iconText: 'text-violet-600',
      title: 'text-violet-900',
      description: 'text-violet-700',
      body: 'text-violet-800',
      mobile: 'Your request is queued for processing.',
      desktopShort: 'Your enrollment request has been submitted and is waiting in the queue for initial processing.',
      desktopBody: 'Your submission is in line for processing. Please check your enrollment page for updates and any additional requirements.',
      summaryBorder: 'border-violet-100/70',
      summaryBar: 'from-violet-500 to-indigo-500',
      summaryIconBg: 'bg-violet-100',
      summaryIconText: 'text-violet-600',
      summaryValueText: 'text-violet-700',
    };
  }

  if (status === 'Under Review') {
    return {
      card: 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50',
      iconBg: 'bg-yellow-100',
      iconText: 'text-yellow-600',
      title: 'text-yellow-900',
      description: 'text-yellow-700',
      body: 'text-yellow-800',
      mobile: 'Your enrollment is under review.',
      desktopShort: 'Your enrollment is currently being reviewed. Please wait for approval.',
      desktopBody: 'Your enrollment documents are being reviewed. This may take a few days. Please check back soon.',
      summaryBorder: 'border-amber-100/70',
      summaryBar: 'from-yellow-500 to-amber-500',
      summaryIconBg: 'bg-yellow-100',
      summaryIconText: 'text-yellow-600',
      summaryValueText: 'text-yellow-700',
    };
  }

  if (status === 'Incomplete') {
    return {
      card: 'border-orange-300 bg-gradient-to-r from-orange-50 to-red-50',
      iconBg: 'bg-orange-100',
      iconText: 'text-orange-600',
      title: 'text-orange-900',
      description: 'text-orange-700',
      body: 'text-orange-800',
      mobile: 'Please complete your enrollment requirements.',
      desktopShort: 'Please complete your enrollment application to proceed.',
      desktopBody: 'Complete your enrollment by providing all required documents and information.',
      summaryBorder: 'border-orange-100/70',
      summaryBar: 'from-orange-500 to-red-500',
      summaryIconBg: 'bg-orange-100',
      summaryIconText: 'text-orange-600',
      summaryValueText: 'text-orange-700',
    };
  }

  if (status === 'Rejected') {
    return {
      card: 'border-rose-300 bg-gradient-to-r from-rose-50 to-red-50',
      iconBg: 'bg-rose-100',
      iconText: 'text-rose-600',
      title: 'text-rose-900',
      description: 'text-rose-700',
      body: 'text-rose-800',
      mobile: 'Your enrollment was rejected. Please review and re-apply.',
      desktopShort: 'Your enrollment request was rejected after review.',
      desktopBody: 'Please review feedback, update your requirements, and submit a new enrollment request.',
      summaryBorder: 'border-rose-100/70',
      summaryBar: 'from-rose-500 to-red-500',
      summaryIconBg: 'bg-rose-100',
      summaryIconText: 'text-rose-600',
      summaryValueText: 'text-rose-700',
    };
  }

  return {
    card: 'border-gray-300 bg-gradient-to-r from-gray-50 to-slate-50',
    iconBg: 'bg-gray-200',
    iconText: 'text-gray-600',
    title: 'text-gray-800',
    description: 'text-gray-600',
    body: 'text-gray-700',
    mobile: 'Enrollment recorded.',
    desktopShort: 'Your enrollment has been recorded.',
    desktopBody: 'Your enrollment has been recorded in our system.',
    summaryBorder: 'border-indigo-100/70',
    summaryBar: 'from-indigo-500 to-blue-500',
    summaryIconBg: 'bg-blue-100',
    summaryIconText: 'text-blue-600',
    summaryValueText: 'text-gray-700',
  };
};

const getEnrollmentAction = (status: EnrollmentStatus) => {
  if (status === 'Incomplete') {
    return {
      label: 'Complete Enrollment',
      className: 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700',
      icon: FileText,
    };
  }

  if (status === 'Pending') {
    return {
      label: 'Track Enrollment Status',
      className: 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700',
      icon: ClipboardList,
    };
  }

  if (status === 'Under Review') {
    return {
      label: 'Track Enrollment Status',
      className: 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700',
      icon: ClipboardList,
    };
  }

  if (status === 'Verified') {
    return {
      label: 'View Verification Details',
      className: 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700',
      icon: ClipboardList,
    };
  }

  if (status === 'Approved') {
    return {
      label: 'View Enrollment Details',
      className: 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700',
      icon: ClipboardList,
    };
  }

  if (status === 'Rejected') {
    return {
      label: 'Review & Re-Apply',
      className: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700',
      icon: FileText,
    };
  }

  return null;
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const { notifications, addNotification } = useNotificationContext();
  const { data: unreadCountData } = useUnreadCount({ enabled: user?.role === 'student' });
  const { data: announcementsData } = useAnnouncements({ enabled: user?.role === 'student' });
  const [hasOpenEnrollmentPeriod, setHasOpenEnrollmentPeriod] = useState<boolean | null>(null);
  const [activePeriodInfo, setActivePeriodInfo] = useState<any>(null);
  const [studentEnrollment, setStudentEnrollment] = useState<any>(null);
  const [studentRecord, setStudentRecord] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [activityCounts, setActivityCounts] = useState({ upcoming: 0, overdue: 0 });
  const [vmgoCarouselApi, setVmgoCarouselApi] = useState<CarouselApi>();
  const [vmgoCurrentSlide, setVmgoCurrentSlide] = useState(0);
  const [subjectsCarouselApi, setSubjectsCarouselApi] = useState<CarouselApi>();
  const [subjectsCurrentSlide, setSubjectsCurrentSlide] = useState(0);

  const sidebarNotifications = [
    { id: 1, message: "New assignment posted in Mathematics 101", time: "2 hours ago" },
    { id: 2, message: "Grade updated for Physics Lab Report", time: "1 day ago" },
  ];

  // Fetch announcements and add to global notifications (once)
  useEffect(() => {
    let mounted = true;
    const loadAnnouncements = async () => {
      try {
        const res = await apiGet(API_ENDPOINTS.ANNOUNCEMENTS);
        const list = res.data ?? res.announcements ?? res ?? [];

        const existingMsg = new Set(sidebarNotifications.map((n: any) => n.message));
        const existingIds = new Set<string | number>();
        // Include already-added global notification sourceIds and messages
        notifications.forEach((n: any) => {
          if (n.sourceId) existingIds.add(String(n.sourceId));
          if (n.message) existingMsg.add(n.message);
        });

        const matchesAudience = (aud: string | null | undefined) => {
          const role = user?.role ?? '';
          if (!aud) return true;
          const a = String(aud).toLowerCase();
          if (a === 'all') return true;
          if (role === 'student' && (a === 'students' || a === 'student')) return true;
          if (role === 'teacher' && (a === 'teachers' || a === 'teacher')) return true;
          if (role === 'admin') return true;
          return false;
        };

        (Array.isArray(list) ? list : []).forEach((a: any) => {
          if (!mounted) return;
          if (!matchesAudience(a.audience)) return;
          const msg = a.title ? `${a.title}: ${a.message ?? ''}` : (a.message ?? '');
          const sid = a.id ?? a._id ?? null;
          if (sid && existingIds.has(String(sid))) return; // already added
          if (!sid && existingMsg.has(msg)) return; // dedupe by message if no id

          // attach full announcement as meta and keep it persistent
          addNotification({ type: 'info', message: msg, duration: 0, meta: a, sourceId: sid, displayToast: false });
          if (sid) existingIds.add(String(sid));
          existingMsg.add(msg);
        });
      } catch (e) {
        // ignore fetch errors on dashboard
      }
    };

    loadAnnouncements();
    return () => { mounted = false; };
  }, []);

  /**
   * Check if there's an open enrollment period
   */
  useEffect(() => {
    const checkEnrollmentPeriod = async () => {
      try {
        // Fetch the active enrollment period
        const response = await apiGet('/api/enrollment-periods/active');
        
        if (response.success && response.data) {
          // Check if the enrollment period status is "Open"
          const isOpen = response.data.status === 'Open' || response.data.enrollment_open === true;
          setHasOpenEnrollmentPeriod(isOpen);
          if (isOpen) {
            setActivePeriodInfo(response.data);
          }
        } else if (response.data && response.data.status === 'Open') {
          setHasOpenEnrollmentPeriod(true);
          setActivePeriodInfo(response.data);
        } else {
          setHasOpenEnrollmentPeriod(false);
        }
      } catch (error) {
        console.error('Error checking enrollment period:', error);
        setHasOpenEnrollmentPeriod(false);
      }
    };
    
    checkEnrollmentPeriod();
  }, []);

  /**
   * Check if student has already enrolled in the current period
   */
  useEffect(() => {
    const checkStudentEnrollment = async () => {
      try {
        const enrollmentResponse = await apiGet(API_ENDPOINTS.ENROLLMENTS);
        
        // Get enrollment data from response
        let enrollmentsArray: any[] = [];
        if (Array.isArray(enrollmentResponse.data)) {
          enrollmentsArray = enrollmentResponse.data;
        } else if (enrollmentResponse.data && Array.isArray(enrollmentResponse.data.data)) {
          enrollmentsArray = enrollmentResponse.data.data;
        } else if (enrollmentResponse.data && enrollmentResponse.data.data && enrollmentResponse.data.data.id) {
          enrollmentsArray = [enrollmentResponse.data.data];
        } else if (enrollmentResponse.data && enrollmentResponse.data.id) {
          enrollmentsArray = [enrollmentResponse.data];
        }

        let currentActiveEnrollment = null;

        // If there's an open enrollment period, we prioritize showing status for THAT specific period
        if (activePeriodInfo?.id) {
          currentActiveEnrollment = enrollmentsArray.find((e: any) => 
            String(e.enrollment_period_id) === String(activePeriodInfo.id)
          );
          console.log('Enrollment found for the open re-enrollment period:', currentActiveEnrollment);
          
          // Note: If currentActiveEnrollment is null here, it means the student has NOT yet 
          // applied for the open period, so the dashboard will show the "Enrollment is Open" card.
        } else {
          // If no enrollment period is currently open (regular school days), 
          // show the latest enrollment record with any status.
          currentActiveEnrollment = enrollmentsArray.find((e: any) => 
            Boolean(e?.status)
          );
          console.log('No open enrollment period. Showing last active record:', currentActiveEnrollment);
        }
        
        setStudentEnrollment(currentActiveEnrollment || null);
      } catch (error) {
        console.error('Error checking student enrollment:', error);
        setStudentEnrollment(null);
      }
    };
    
    checkStudentEnrollment();
  }, [activePeriodInfo]);

  // Load dashboard data: student profile + subjects + activity counters
  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const userId = (user as any)?.id ?? (user as any)?.user_id ?? (user as any)?.userId;
        if (!userId) return;

        // Get student record for this user
        const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_USER(userId));
        const student = (studentRes && (studentRes.data ?? studentRes.student)) || studentRes || null;
        if (mounted) setStudentRecord(student);
        const studentId = student?.id ?? student?.student_id ?? student?.studentId;

        const studentYearLevelRaw = student?.year_level ?? student?.yearLevel ?? null;
        let studentYearLevelNum: number | null = null;
        if (typeof studentYearLevelRaw === 'number') studentYearLevelNum = studentYearLevelRaw;
        else if (typeof studentYearLevelRaw === 'string') {
          const m = String(studentYearLevelRaw).match(/(\d+)/);
          studentYearLevelNum = m ? Number(m[1]) : null;
        }

        try {
          const params = new URLSearchParams();
          if (studentYearLevelNum) params.set('year_level', String(studentYearLevelNum));
          const subjectsRes = await apiGet(`${API_ENDPOINTS.SUBJECTS_FOR_STUDENT}?${params.toString()}`);
          const subjectRows = Array.isArray(subjectsRes?.data)
            ? subjectsRes.data
            : (Array.isArray(subjectsRes?.subjects) ? subjectsRes.subjects : []);

          const teacherMap = new Map<number, { first_name: string; last_name: string }>();
          try {
            const subjectIds = (Array.isArray(subjectRows) ? subjectRows : []).map((s: any) => s?.id).filter(Boolean);
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
          } catch (_err) {
            // Keep fallback teacher labels
          }

          const mappedSubjects = (Array.isArray(subjectRows) ? subjectRows : []).map((subject: any, index: number) => {
            const subjectId = Number(subject.id ?? subject.subject_id ?? 0);
            const mappedTeacher = subjectId ? teacherMap.get(subjectId) : null;
            const teacherFromMap = mappedTeacher ? `${mappedTeacher.first_name} ${mappedTeacher.last_name}`.trim() : '';

            return {
              id: subject.id ?? subject.subject_id ?? `subject-${index}`,
              title: subject.course_name ?? subject.title ?? subject.name ?? `Subject ${index + 1}`,
              code: subject.course_code ?? subject.code ?? 'N/A',
              level: subject.level ?? subject.year_level ?? null,
              teacher:
                teacherFromMap ||
                subject.teacher_name ||
                (subject.teacher && subject.teacher.name) ||
                ([subject.teacher_first_name, subject.teacher_last_name].filter(Boolean).join(' ') || 'TBA'),
              image: getSubjectImage(subject),
            };
          });

          if (mounted) setSubjects(mappedSubjects);
        } catch (error) {
          if (mounted) setSubjects([]);
        }

        if (!studentId) {
          if (mounted) setActivityCounts({ upcoming: 0, overdue: 0 });
          return;
        }

        try {
          const activitiesRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES_STUDENT_ALL}?student_id=${studentId}`);
          const allActivities = Array.isArray(activitiesRes?.data) ? activitiesRes.data : [];

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let upcoming = 0;
          let overdue = 0;

          allActivities.forEach((activity: any) => {
            const score = activity?.student_grade;
            if (score !== null && score !== undefined) return;

            const dueRaw = activity?.due_at ?? activity?.dueDate ?? activity?.due_date;
            if (!dueRaw) return;

            const dueDate = new Date(String(dueRaw).replace(' ', 'T'));
            if (Number.isNaN(dueDate.getTime())) return;

            dueDate.setHours(0, 0, 0, 0);
            if (dueDate < today) overdue += 1;
            else upcoming += 1;
          });

          if (mounted) setActivityCounts({ upcoming, overdue });
        } catch (_err) {
          if (mounted) setActivityCounts({ upcoming: 0, overdue: 0 });
        }
      } catch (e) {
        // Keep previously loaded subjects if unrelated dashboard requests fail.
        if (mounted) setActivityCounts({ upcoming: 0, overdue: 0 });
      }
    };

    loadDashboard();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!vmgoCarouselApi) return;

    const handleSelect = () => {
      setVmgoCurrentSlide(vmgoCarouselApi.selectedScrollSnap());
    };

    handleSelect();
    vmgoCarouselApi.on("select", handleSelect);
    vmgoCarouselApi.on("reInit", handleSelect);

    return () => {
      vmgoCarouselApi.off("select", handleSelect);
      vmgoCarouselApi.off("reInit", handleSelect);
    };
  }, [vmgoCarouselApi]);

  useEffect(() => {
    if (!subjectsCarouselApi) return;

    const handleSelect = () => {
      setSubjectsCurrentSlide(subjectsCarouselApi.selectedScrollSnap());
    };

    handleSelect();
    subjectsCarouselApi.on("select", handleSelect);
    subjectsCarouselApi.on("reInit", handleSelect);

    return () => {
      subjectsCarouselApi.off("select", handleSelect);
      subjectsCarouselApi.off("reInit", handleSelect);
    };
  }, [subjectsCarouselApi]);

  const matchesAudience = (aud: any, role?: string) => {
    const r = (role || '').toString().toLowerCase();
    if (!aud) return true;

    let tokens: string[] = [];
    if (Array.isArray(aud)) {
      tokens = aud.map((x: any) => String(x).toLowerCase());
    } else if (typeof aud === 'object' && aud.roles) {
      tokens = aud.roles.map((x: any) => String(x).toLowerCase());
    } else {
      const raw = String(aud).toLowerCase();
      tokens = raw.split(/[,;|]+/).map((s: string) => s.trim());
    }

    tokens = tokens.map((t: string) => t.replace(/[^a-z0-9]/g, '')).filter(Boolean);

    if (tokens.includes('all') || tokens.includes('everyone')) return true;
    if (r === 'admin') return true;
    if (r === 'student' && (tokens.includes('student') || tokens.includes('students'))) return true;
    if (r === 'teacher' && (tokens.includes('teacher') || tokens.includes('teachers'))) return true;

    return false;
  };

  const unreadSystemCount = unreadCountData?.count ?? 0;
  const unreadAnnouncementsCount = ((announcementsData?.data ?? announcementsData?.announcements ?? []) as any[])
    .filter((ann: any) => matchesAudience(ann.audience, user?.role))
    .filter((ann: any) => !ann.is_read).length;
  const dashboardNotificationCount = unreadSystemCount + unreadAnnouncementsCount;
  const schoolAnnouncements = ((announcementsData?.data ?? announcementsData?.announcements ?? []) as any[])
    .filter((ann: any) => matchesAudience(ann.audience, user?.role))
    .slice(0, 4);

  const formatAnnouncementDate = (value: any) => {
    if (!value) return "Recently posted";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Recently posted";
    return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const vmgoCards = [
    {
      key: "vision",
      title: "MCA Vision",
      icon: Eye,
      label: "Vision",
      image:
        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=80",
      text: "A school system that upholds Christian tradition of excellence in service to God and humanity, through liberating educations towards a God-fearing society.",
    },
    {
      key: "mission",
      title: "MCA Mission",
      icon: Target,
      label: "Mission",
      image:
        "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80",
      text: "Providing students with greater access to quality education that instills Christian values, ideals and competencies essential to successfully meet the demands and challenges of the 21st century.",
    },
    {
      key: "philosophy",
      title: "MCA Philosophy",
      icon: BookOpen,
      label: "Philosophy",
      image:
        "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=80",
      verse: "Proverbs 22:6",
      text: '"Train up a child in the way he should go, and when he is old, he will not depart from it."',
    },
  ];

  const normalizedEnrollmentStatus = normalizeEnrollmentStatus(studentEnrollment?.status);
  const enrollmentStatusUi = getEnrollmentStatusUi(normalizedEnrollmentStatus);
  const enrollmentAction = getEnrollmentAction(normalizedEnrollmentStatus);
  const isEnrollmentApproved = normalizedEnrollmentStatus === 'Approved';
  const showEnrollmentReminder = hasOpenEnrollmentPeriod !== null && !isEnrollmentApproved && (hasOpenEnrollmentPeriod || studentEnrollment);
  const showSubjectsSection = isEnrollmentApproved;
  const subjectsSnapCount = subjectsCarouselApi?.scrollSnapList().length ?? 0;

  return (
    <DashboardLayout>
      <div className="-mx-2 sm:-mx-4 md:-mx-6 lg:-mx-8 border-b border-blue-100 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="px-4 py-6 sm:px-6 sm:py-7 md:px-8">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Welcome back, {user?.name}!</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
            Stay informed on academic advisories and monitor your enrollment progress.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge className="bg-blue-600 text-white hover:bg-blue-600">{studentRecord?.student_id ?? studentRecord?.id ?? 'MCAF2026-0001'}</Badge>
            <Badge variant="outline" className="border-cyan-300 bg-cyan-50 text-cyan-700">
              {activityCounts.upcoming} upcoming activities
            </Badge>
            <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700">
              {activityCounts.overdue} overdue activities
            </Badge>
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
              {dashboardNotificationCount} unread updates
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-3 py-6 sm:px-4 sm:py-8 md:px-6">
        {showEnrollmentReminder && (
          <>
            {studentEnrollment ? (
              <Card className={`border-2 ${enrollmentStatusUi.card}`}>
                <CardHeader className="pb-2 sm:pb-3">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`hidden sm:flex w-12 h-12 rounded-lg items-center justify-center flex-shrink-0 ${enrollmentStatusUi.iconBg}`}>
                      <Calendar className={`h-6 w-6 ${enrollmentStatusUi.iconText}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className={`${enrollmentStatusUi.title} text-2xl sm:text-3xl leading-tight`}>
                        Enrollment Reminder: {studentEnrollment.status}
                      </CardTitle>
                      <CardDescription className={`hidden sm:block ${enrollmentStatusUi.description}`}>
                        {enrollmentStatusUi.desktopShort}
                      </CardDescription>
                      <p className={`sm:hidden mt-1 text-sm font-medium ${enrollmentStatusUi.body}`}>
                        {enrollmentStatusUi.mobile}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
                  <p className={`hidden sm:block text-sm ${enrollmentStatusUi.body}`}>
                    {enrollmentStatusUi.desktopBody}
                  </p>
                  {enrollmentAction && (
                    <Link to="/enrollment/my-enrollments">
                      <Button className={`w-full h-10 sm:h-11 text-white font-semibold ${enrollmentAction.className}`}>
                        <enrollmentAction.icon className="h-4 w-4 mr-2" />
                        {enrollmentAction.label}
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className={`border-2 ${hasOpenEnrollmentPeriod ? 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50' : 'border-gray-300 bg-gradient-to-r from-gray-50 to-slate-50'}`}>
                <CardHeader className="pb-2 sm:pb-3">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`hidden sm:flex w-12 h-12 rounded-lg items-center justify-center flex-shrink-0 ${hasOpenEnrollmentPeriod ? 'bg-green-100' : 'bg-gray-200'}`}>
                      <Calendar className={`h-6 w-6 ${hasOpenEnrollmentPeriod ? 'text-green-600' : 'text-gray-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className={`${hasOpenEnrollmentPeriod ? 'text-green-900' : 'text-gray-800'} text-2xl sm:text-3xl leading-tight`}>
                        {hasOpenEnrollmentPeriod
                          ? `Enrollment for SY. ${activePeriodInfo?.school_year || '2026-2027'} is now Open!`
                          : 'Enrollment Closed'}
                      </CardTitle>
                      <CardDescription className={`hidden sm:block ${hasOpenEnrollmentPeriod ? 'text-green-700' : 'text-gray-600'}`}>
                        {hasOpenEnrollmentPeriod
                          ? `You can now proceed with your re-enrollment for the SY. ${activePeriodInfo?.school_year || '2026-2027'} academic year.`
                          : 'The enrollment period is currently closed. Check back later.'}
                      </CardDescription>
                      <p className={`sm:hidden mt-1 text-sm font-medium ${hasOpenEnrollmentPeriod ? 'text-green-800' : 'text-gray-700'}`}>
                        {hasOpenEnrollmentPeriod
                          ? 'Re-enrollment is open. Submit now to reserve your slot.'
                          : 'Enrollment is currently closed.'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
                  <p className={`hidden sm:block text-sm ${hasOpenEnrollmentPeriod ? 'text-green-800' : 'text-gray-700'}`}>
                    {hasOpenEnrollmentPeriod
                      ? `The enrollment period for SY. ${activePeriodInfo?.school_year || '2026-2027'} is currently active. Click the button below to start your re-enrollment process and secure your spot for the next school year.`
                      : 'Please wait for the enrollment period to open. You will be notified when enrollment becomes available.'}
                  </p>
                  {hasOpenEnrollmentPeriod && (
                    <Link to="/enrollment/my-enrollments">
                      <Button className="w-full h-10 sm:h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold">
                        <Calendar className="h-4 w-4 mr-2" />
                        Start Re-Enrollment Now
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="space-y-6">
          {showSubjectsSection && (
            <Card className="border-blue-100">
              <CardHeader className="pb-4">
                <CardTitle className="text-blue-900 text-xl leading-tight sm:text-2xl">My Subjects</CardTitle>
                <CardDescription>Current enrolled subjects for this term.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subjects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-sm text-blue-800">
                    No subjects are available yet. Please check back after enrollment updates.
                  </div>
                ) : (
                  <>
                    <Carousel setApi={setSubjectsCarouselApi} opts={{ align: "start" }} className="w-full">
                      <CarouselContent className="-ml-2 md:-ml-4">
                        {subjects.map((subject) => (
                          <CarouselItem key={subject.id} className="pl-2 md:pl-4 basis-[85%] sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                            <Link to={subject.id ? `/student/courses/${subject.id}` : "/student/courses"} className="block h-full">
                              <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-blue-200 bg-slate-900">
                                <img
                                  src={subject.image}
                                  alt={subject.title}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/45 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                    <BookOpen className="h-3.5 w-3.5" />
                                    Subject
                                  </div>
                                  <p className="text-xl font-semibold text-white leading-tight">{subject.title}</p>
                                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-200">{subject.code}</p>
                                  <p className="mt-2 text-sm leading-relaxed text-white/90">Instructor: {subject.teacher}</p>
                                </div>
                              </div>
                            </Link>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                    </Carousel>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: subjectsSnapCount }).map((_, index) => (
                          <button
                            key={index}
                            type="button"
                            className={`h-2 rounded-full transition-all ${subjectsCurrentSlide === index ? 'w-6 bg-blue-600' : 'w-2 bg-blue-200'}`}
                            aria-label={`Go to subject slide ${index + 1}`}
                            onClick={() => subjectsCarouselApi?.scrollTo(index)}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => subjectsCarouselApi?.scrollPrev()}
                          disabled={!subjectsCarouselApi?.canScrollPrev()}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={() => subjectsCarouselApi?.scrollNext()}
                          disabled={!subjectsCarouselApi?.canScrollNext()}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <Card className="border-blue-100 lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-blue-900 text-xl leading-tight sm:text-2xl">MCA Vision, Mission & Philosophy</CardTitle>
              <CardDescription>Core direction and commitment of Maranatha Christian Academy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="md:hidden space-y-3">
                <Carousel setApi={setVmgoCarouselApi} opts={{ align: "start" }} className="w-full">
                  <CarouselContent className="-ml-0">
                    {vmgoCards.map((item) => {
                      const Icon = item.icon;
                      return (
                        <CarouselItem key={item.key} className="pl-0">
                          <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-slate-900 min-h-[320px]">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-4">
                              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                <Icon className="h-3.5 w-3.5" />
                                {item.label}
                              </div>
                              <p className="text-xl font-semibold text-white leading-tight">{item.title}</p>
                              {item.verse && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">{item.verse}</p>}
                              <p className="mt-2 text-sm leading-relaxed text-white/90">{item.text}</p>
                            </div>
                          </div>
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                </Carousel>
                <div className="flex items-center justify-center gap-1.5">
                  {vmgoCards.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`h-2 rounded-full transition-all ${vmgoCurrentSlide === index ? 'w-6 bg-blue-600' : 'w-2 bg-blue-200'}`}
                      aria-label={`Go to ${item.title}`}
                      onClick={() => vmgoCarouselApi?.scrollTo(index)}
                    />
                  ))}
                </div>
                <p className="text-center text-xs text-slate-500">Swipe to browse Vision, Mission, and Philosophy.</p>
              </div>

              <div className="hidden lg:grid lg:grid-cols-3 gap-4">
                {vmgoCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="relative overflow-hidden rounded-2xl border border-blue-200 bg-slate-900 min-h-[360px]">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/45 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                          <Icon className="h-3.5 w-3.5" />
                          {item.label}
                        </div>
                        <p className="text-3xl font-bold text-white leading-tight">{item.title}</p>
                        {item.verse && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">{item.verse}</p>}
                        <p className="mt-2 text-base leading-relaxed text-white/90">{item.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:grid lg:hidden md:grid-cols-2 gap-4">
                {vmgoCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className={`rounded-xl border border-blue-100 bg-blue-50/50 p-5 ${item.key === 'philosophy' ? 'md:col-span-2' : ''}`}>
                      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-100">
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </div>
                      <p className="text-xl font-semibold text-slate-900">{item.title}</p>
                      {item.verse && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">{item.verse}</p>}
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Megaphone className="h-5 w-5" />
                School Announcements
              </CardTitle>
              <CardDescription>Latest notices and updates from the academy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {schoolAnnouncements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-sm text-blue-800">
                  No new announcements right now. Check back later for school updates.
                </div>
              ) : (
                schoolAnnouncements.map((ann: any) => (
                  <div key={ann.id ?? ann._id ?? `${ann.title}-${ann.created_at}`} className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-slate-900">{ann.title || 'School Notice'}</p>
                      <Badge variant="outline" className="shrink-0 border-blue-200 bg-white text-blue-700">
                        {formatAnnouncementDate(ann.created_at ?? ann.createdAt ?? ann.date)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{ann.message || 'Please check the notifications page for full details.'}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
