import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { API_ENDPOINTS, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Check, X, History, Calendar, Clock } from 'lucide-react';

const AttendanceDashboard: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseLevel, setCourseLevel] = useState<number | string | null>(null);
  const [showSessionOptions, setShowSessionOptions] = useState(false);
  
  // Session states
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(false);
  
  // Attendance tracking
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewingAttendance, setReviewingAttendance] = useState(false);
  
  // Today's attendance data
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [loadingTodayAttendance, setLoadingTodayAttendance] = useState(false);
  
  // Dashboard mode states
  const [showDashboard, setShowDashboard] = useState(true);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [selectedSubjectForModal, setSelectedSubjectForModal] = useState<any | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [allSubjectsAttendance, setAllSubjectsAttendance] = useState<Record<string, any[]>>({});
  const [viewingMonth, setViewingMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const notify = useNotification();
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Fetch courses on mount
  useEffect(() => {
    if (user) {
      fetchTeacherCourses().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all subjects attendance when courses are loaded
  useEffect(() => {
    if (courses.length > 0 && showDashboard) {
      fetchAllSubjectsAttendance(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, showDashboard, selectedDate]);

  // Keyboard event listener for arrow keys
  useEffect(() => {
    if (!sessionStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        markStudent('present');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        markStudent('absent');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionStarted, currentStudentIndex, students]);

  const fetchTeacherCourses = async () => {
    if (!user) return;
    try {
      let teacherId: string | null = null;
      try {
        const teacherRes = await apiGet(`/api/teachers/by-user/${user.id}`);
        if (teacherRes && teacherRes.teacher && teacherRes.teacher.id) {
          teacherId = teacherRes.teacher.id;
        }
      } catch (err) {
        console.error('Failed to get teacher by user_id:', err);
      }

      if (!teacherId) {
        console.error('Could not find teacher record for user:', user.id);
        return;
      }

      const assignmentRes = await apiGet(`/api/teachers/${teacherId}/assignment`);
      if (!assignmentRes || !assignmentRes.success) {
        console.error('Failed to fetch teacher assignment');
        return;
      }

      const teacherLevel = assignmentRes.assignment?.level;
      if (assignmentRes.assignment && assignmentRes.subjects && Array.isArray(assignmentRes.subjects)) {
        const mapped = assignmentRes.subjects.map((s: any, idx: number) => ({
          id: s.id ?? idx,
          title: s.name || '',
          code: s.code || '',
          level: teacherLevel
        }));
        setCourses(mapped);
        return;
      }
    } catch (e) {
      console.error('fetchTeacherCourses error:', e);
    }
  };

  const fetchTodayAttendance = async () => {
    if (!selectedCourseId) return;
    
    try {
      setLoadingTodayAttendance(true);
      const res = await apiGet(`${API_ENDPOINTS.ATTENDANCE_COURSE(parseInt(selectedCourseId))}`);
      const records = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
      
      // Filter for today's records only
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = records.filter((r: any) => {
        const recordDate = new Date(r.created_at).toISOString().split('T')[0];
        return recordDate === today;
      });
      
      setTodayAttendance(todayRecords);
    } catch (e) {
      console.error('Error fetching today\'s attendance:', e);
      setTodayAttendance([]);
    } finally {
      setLoadingTodayAttendance(false);
    }
  };

  const toLocalYmd = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const fetchAllSubjectsAttendance = async (date: Date) => {
    const dayKey = toLocalYmd(date);
    const attendanceMap: Record<string, any[]> = {};

    for (const course of courses) {
      try {
        const res = await apiGet(`${API_ENDPOINTS.ATTENDANCE_COURSE(parseInt(course.id))}`);
        const records = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
        
        const todayRecords = records.filter((r: any) => {
          const recordDate = new Date(r.created_at).toISOString().split('T')[0];
          return recordDate === dayKey;
        });
        
        attendanceMap[course.id] = todayRecords;
      } catch (e) {
        attendanceMap[course.id] = [];
      }
    }

    setAllSubjectsAttendance(attendanceMap);
  };

  const fetchStudentsByLevel = async () => {
    if (!courseLevel) return;
    try {
      setLoadingStudents(true);
      const params = new URLSearchParams();
      params.set('year_level', String(courseLevel));
      
      const stuRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?${params.toString()}`);
      const list = stuRes.data ?? stuRes.students ?? stuRes ?? [];
      
      if (Array.isArray(list)) {
        const normalized = list.map((st: any) => ({
          dbId: st.id ?? null,
          userId: st.user_id ?? null,
          studentId: st.student_id ?? null,
          id: st.student_id ?? st.id ?? st.user_id ?? String(st.id),
          name: (st.first_name && st.last_name) ? `${st.first_name} ${st.last_name}` : (st.name ?? `${st.firstName ?? ''} ${st.lastName ?? ''}`),
          email: st.email ?? st.user_email ?? '',
          status: st.status ?? st.user_status ?? 'active',
          raw: st
        }));
        setStudents(normalized);
        setCurrentStudentIndex(0);
        setAttendance({});
        setSessionComplete(false);
      } else {
        setStudents([]);
      }
    } catch (e) {
      console.error('Error fetching students:', e);
      notify.error('Failed to fetch students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const startSession = async () => {
    if (!selectedCourseId || courseLevel === null) {
      notify.error('Please select a subject first');
      return;
    }
    setCourseLevel(courseLevel);
    // Generate session ID with format: MCA-YYYYMMDD-randomstring
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = Math.random().toString(36).substr(2, 8).toUpperCase();
    const newSessionId = `MCA-${dateStr}-${randomStr}`;
    setSessionId(newSessionId);
    await fetchStudentsByLevel();
    setSessionStarted(true);
  };

  const markStudent = async (status: 'present' | 'absent') => {
    if (currentStudentIndex >= students.length) return;

    const currentStudent = students[currentStudentIndex];
    const studentId = currentStudent.studentId || currentStudent.userId || currentStudent.id;
    
    // Update local attendance
    setAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));

    // Move to next student or complete session
    if (currentStudentIndex + 1 >= students.length) {
      // Session complete - submit all attendance
      submitAllAttendance({
        ...attendance,
        [studentId]: status
      });
    } else {
      setCurrentStudentIndex(prev => prev + 1);
    }

    // Reset card position
    setDragOffset(0);
  };

  const submitAllAttendance = async (finalAttendance: Record<string, 'present' | 'absent'>) => {
    setSubmitting(true);
    try {
      const promises = Object.entries(finalAttendance).map(([studentId, status]) =>
        apiPost(API_ENDPOINTS.ATTENDANCE_MARK, {
          session_id: sessionId,
          student_id: studentId,
          teacher_id: user?.id,
          course_id: parseInt(selectedCourseId),
          status: status
        })
      );

      await Promise.all(promises);
      notify.success(`Attendance marked for ${Object.keys(finalAttendance).length} students`);
      setSessionComplete(true);
    } catch (e: any) {
      notify.error('Failed to submit attendance: ' + (e.message || String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart === null) return;
    setDragOffset(e.clientX - dragStart);
  };

  const handleMouseUp = () => {
    if (dragStart === null) return;

    if (Math.abs(dragOffset) > 50) {
      if (dragOffset > 0) {
        markStudent('present');
      } else {
        markStudent('absent');
      }
    }

    setDragStart(null);
    setDragOffset(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart === null) return;
    setDragOffset(e.touches[0].clientX - dragStart);
  };

  const handleTouchEnd = () => {
    if (dragStart === null) return;

    if (Math.abs(dragOffset) > 50) {
      if (dragOffset > 0) {
        markStudent('present');
      } else {
        markStudent('absent');
      }
    }

    setDragStart(null);
    setDragOffset(0);
  };

  const currentStudent = students[currentStudentIndex];
  const selectedCourse = courses.find(c => String(c.id) === String(selectedCourseId));
  const markedCount = Object.keys(attendance).length;
  const totalCount = students.length;
  const progress = totalCount > 0 ? Math.round((markedCount / totalCount) * 100) : 0;

  // Dashboard View
  if (showDashboard && !sessionStarted) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              Attendance Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage and track attendance for all your subjects
            </p>
          </div>

          {/* Widgets Row - 3 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Calendar Widget */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white hidden md:block">
              <CardHeader className="text-center pt-6 pb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const newMonth = new Date(viewingMonth);
                      newMonth.setMonth(newMonth.getMonth() - 1);
                      setViewingMonth(newMonth);
                    }}
                    className="h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </Button>
                  <CardTitle className="text-base font-semibold text-blue-600">
                    {viewingMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const newMonth = new Date(viewingMonth);
                      newMonth.setMonth(newMonth.getMonth() + 1);
                      setViewingMonth(newMonth);
                    }}
                    className="h-6 w-6 p-0 hover:bg-gray-100 rounded-full"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-blue-400">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {(() => {
                    const year = viewingMonth.getFullYear();
                    const month = viewingMonth.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const prevMonthDays = new Date(year, month, 0).getDate();
                    const today = new Date();
                    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
                    
                    const days = [];
                    // Previous month's days (Sun-based: 0=Sun, 1=Mon, etc.)
                    const startDay = firstDay;
                    for (let i = startDay - 1; i >= 0; i--) {
                      days.push(
                        <div key={`prev-${i}`} className="aspect-square flex items-center justify-center text-sm text-gray-300">
                          {prevMonthDays - i}
                        </div>
                      );
                    }
                    // Current month days
                    for (let day = 1; day <= daysInMonth; day++) {
                      const isToday = isCurrentMonth && day === today.getDate();
                      const dayOfWeek = new Date(year, month, day).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isSelected = selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;
                      const isSelectable = !isWeekend;

                      // Build class string so weekends always render as muted gray
                      let dayClass = 'aspect-square flex items-center justify-center text-sm rounded-full transition-all';
                      if (isWeekend) {
                        dayClass += ' text-gray-300 cursor-not-allowed';
                      } else if (isSelected) {
                        dayClass += ' bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow';
                      } else if (isToday) {
                        dayClass += ' bg-blue-100 text-blue-700 font-semibold';
                      } else {
                        dayClass += ' text-gray-700 hover:bg-gray-50';
                      }

                      days.push(
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelectable) {
                              setSelectedDate(new Date(year, month, day));
                            }
                          }}
                          disabled={!isSelectable}
                          className={dayClass}
                          aria-label={`Select date ${year}-${month + 1}-${day}`}
                        >
                          {day}
                        </button>
                      );
                    }
                    // Next month's days
                    const remainingCells = 42 - days.length;
                    for (let day = 1; day <= remainingCells; day++) {
                      days.push(
                        <div key={`next-${day}`} className="aspect-square flex items-center justify-center text-sm text-gray-300">
                          {day}
                        </div>
                      );
                    }
                    return days;
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Real-Time Clock Widget */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white">
              <CardContent className="p-8 flex flex-col items-center justify-center">
                {/* Digital Clock Display */}
                <div className="flex items-center gap-4 mb-6">
                  {/* Time Stack */}
                  <div className="flex flex-col text-right">
                    {/* Hours */}
                    <div className="text-8xl font-black leading-none text-black" style={{ fontFamily: 'Montserrat ExtraBold, sans-serif' }}>
                      {(currentTime.getHours() % 12 || 12).toString().padStart(2, '0')}
                    </div>
                    {/* Minutes */}
                    <div className="text-8xl font-black leading-none text-black" style={{ fontFamily: 'Montserrat ExtraBold, sans-serif' }}>
                      {currentTime.getMinutes().toString().padStart(2, '0')}
                    </div>
                  </div>
                  {/* AM/PM */}
                  <div 
                    className="leading-none self-center bg-gradient-to-r from-[hsl(220,80%,45%)] to-[hsl(180,70%,50%)] bg-clip-text text-transparent"
                    style={{ fontFamily: 'The Last Of Us, sans-serif', fontSize: '13rem' }}
                  >
                    {currentTime.getHours() >= 12 ? 'PM' : 'AM'}
                  </div>
                </div>
                {/* Date label */}
                <div className="flex items-center gap-3">
                  <span 
                    className="text-3xl font-black bg-gradient-to-r from-[hsl(220,80%,45%)] to-[hsl(180,70%,50%)] bg-clip-text text-transparent"
                    style={{ fontFamily: 'Montserrat ExtraBold, sans-serif' }}
                  >
                    {currentTime.getDate()}, {currentTime.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                  </span>
                  <span 
                    className="text-2xl font-black text-white px-6 py-2 rounded-full bg-gradient-to-r from-[hsl(220,80%,45%)] to-[hsl(180,70%,50%)]"
                    style={{ fontFamily: 'Montserrat ExtraBold, sans-serif' }}
                  >
                    {currentTime.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Subjects Widget */}
            <Card className="border-0 shadow-lg rounded-2xl bg-white overflow-hidden">
              <CardHeader className="text-left pt-6 pb-4 px-6 bg-gradient-to-r from-blue-50 via-white to-cyan-50 border-b">
                <CardTitle className="text-base font-semibold text-blue-700 flex items-center gap-2">
                  📚 My Subjects
                </CardTitle>
                <p className="text-xs text-blue-600/80">Quick access to your class attendance</p>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {courses.length > 0 ? (
                    courses.map((course) => {
                      const records = allSubjectsAttendance[course.id] || [];
                      const hasRecords = records.length > 0;
                      const presentCount = records.filter((r) => r.status === 'present').length;
                      const totalCount = records.length;

                      return (
                        <button
                          key={course.id}
                          onClick={() => {
                            setSelectedSubjectForModal(course);
                            setSubjectModalOpen(true);
                          }}
                          className={`group p-3 sm:p-4 rounded-2xl border transition-all text-left relative min-w-0 ${
                            hasRecords
                              ? 'bg-gradient-to-br from-blue-50 via-white to-cyan-50 border-blue-200 hover:border-blue-300 hover:shadow-md'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className={`text-[11px] sm:text-xs font-semibold px-2 py-1 rounded-full ${
                              hasRecords
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                            >
                              {course.code}
                            </div>
                            {hasRecords ? (
                              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-cyan-600">
                                Recorded
                              </span>
                            ) : (
                              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Pending
                              </span>
                            )}
                          </div>
                          <div className={`font-semibold text-[13px] sm:text-sm mb-2 line-clamp-2 ${hasRecords ? 'text-blue-900' : 'text-slate-700'}`}>
                            {course.title}
                          </div>
                          <div className="flex items-center justify-between text-[11px] sm:text-xs">
                            <span className={hasRecords ? 'text-cyan-700' : 'text-slate-500'}>
                              Today: {totalCount}
                            </span>
                            <span className={hasRecords ? 'text-blue-700' : 'text-slate-400'}>
                              Present: {presentCount}
                            </span>
                          </div>
                          <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                              style={{ width: totalCount > 0 ? `${Math.min(100, Math.round((presentCount / totalCount) * 100))}%` : '0%' }}
                            />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-2 text-center py-8 text-slate-400 text-sm">
                      No subjects assigned
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Logs Table */}
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 via-white to-cyan-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl text-blue-900">Attendance Logs</CardTitle>
                <div className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                  {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <p className="text-sm text-blue-700/80">Per-subject snapshot for the selected date</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-100 border-b">
                      <th className="px-6 py-4 text-left font-semibold text-slate-700">Subject</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-700">Present</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-700">Late</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-700">Absent</th>
                      <th className="px-6 py-4 text-center font-semibold text-slate-700">Excused</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.length > 0 ? (
                      courses.map((course, idx) => {
                        const attendanceRecords = allSubjectsAttendance[course.id] || [];
                        const hasRecords = attendanceRecords.length > 0;

                        const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
                        const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
                        const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
                        const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
                        const totalCount = attendanceRecords.length;
                        const presentPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                        return (
                          <tr
                            key={course.id}
                            className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b hover:bg-blue-50/60 transition-colors`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                  {course.code?.slice(0, 3) || 'SUB'}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900">{course.code}</div>
                                  <div className="text-sm text-slate-600">{course.title}</div>
                                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                                      style={{ width: `${presentPct}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>
                            {hasRecords ? (
                              <>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                                    {presentCount}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 font-bold">
                                    {lateCount}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 text-rose-700 font-bold">
                                    {absentCount}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold">
                                    {excusedCount}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <td colSpan={4} className="px-6 py-4 text-center">
                                <span className="text-slate-500 italic font-medium">No input yet</span>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                          No subjects available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-4 p-4">
                {courses.length > 0 ? (
                  courses.map((course) => {
                    const attendanceRecords = allSubjectsAttendance[course.id] || [];
                    const hasRecords = attendanceRecords.length > 0;
                    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
                    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
                    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
                    const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
                    const totalCount = attendanceRecords.length;
                    const presentPct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                    return (
                      <div key={course.id} className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                              {course.code?.slice(0, 3) || 'SUB'}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{course.code}</div>
                              <div className="text-sm text-slate-600 line-clamp-2">{course.title}</div>
                            </div>
                          </div>
                          <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                              style={{ width: `${presentPct}%` }}
                            />
                          </div>
                        </div>
                        {hasRecords ? (
                          <div className="grid grid-cols-4 gap-2 p-4 text-center text-xs">
                            <div className="rounded-xl bg-emerald-50 py-3">
                              <div className="text-emerald-700 font-bold text-lg">{presentCount}</div>
                              <div className="text-emerald-700/80">Present</div>
                            </div>
                            <div className="rounded-xl bg-amber-50 py-3">
                              <div className="text-amber-700 font-bold text-lg">{lateCount}</div>
                              <div className="text-amber-700/80">Late</div>
                            </div>
                            <div className="rounded-xl bg-rose-50 py-3">
                              <div className="text-rose-700 font-bold text-lg">{absentCount}</div>
                              <div className="text-rose-700/80">Absent</div>
                            </div>
                            <div className="rounded-xl bg-blue-50 py-3">
                              <div className="text-blue-700 font-bold text-lg">{excusedCount}</div>
                              <div className="text-blue-700/80">Excused</div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 text-center text-slate-500 italic font-medium">
                            No input yet
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    No subjects available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subject Action Modal */}
          <Dialog open={subjectModalOpen} onOpenChange={setSubjectModalOpen}>
            <DialogContent className="max-w-md border-0 shadow-2xl">
              <DialogHeader className="bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-8 -mx-6 -mt-6 mb-6 rounded-t-lg">
                <div className="text-center space-y-3">
                  
                  <div>
                    <DialogTitle className="text-2xl font-bold text-white mb-1">
                     Manage {selectedSubjectForModal?.title} Attendance
                    </DialogTitle>
                   
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-3 px-6 pb-6">
                <Button
                  onClick={() => {
                    const course = selectedSubjectForModal;
                    setSubjectModalOpen(false);
                    navigate('/teacher/attendance-session', {
                      state: {
                        courseId: String(course.id),
                        courseCode: course.code,
                        courseTitle: course.title,
                        courseLevel: course.level
                      }
                    });
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold py-4 rounded-xl text-base shadow-lg hover:shadow-xl transition-all"
                >
                  Start New Session
                </Button>
                <Button
                  onClick={() => {
                    setSubjectModalOpen(false);
                    navigate(`/teacher/attendance-history?course=${selectedSubjectForModal.id}`);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 rounded-xl text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <History className="w-5 h-5" />
                  View Attendance History
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // Screen 1.5: Subject Selected - Show Options
  if (!sessionStarted && selectedCourseId && showSessionOptions) {
    const selectedCourse = courses.find(c => String(c.id) === String(selectedCourseId));
    
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-2xl mx-auto">
          <Button
            onClick={() => {
              setShowSessionOptions(false);
              setSelectedCourseId('');
            }}
            variant="ghost"
            className="mb-6"
          >
            ← Back
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedCourse?.code}</h1>
            <p className="text-gray-600">{selectedCourse?.title}</p>
          </div>

          {/* Today's Attendance Summary */}
          <Card className="border-0 shadow-lg mb-6">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                📅 Today's Attendance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {loadingTodayAttendance ? (
                <div className="text-center py-8 text-gray-500">
                  Loading today's records...
                </div>
              ) : todayAttendance.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium">No attendance recorded yet today</p>
                  <p className="text-sm text-gray-500 mt-1">Start a new session to mark attendance</p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {todayAttendance.length}
                      </div>
                      <div className="text-xs text-gray-600 font-medium mt-1">Total Marked</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {todayAttendance.filter(r => r.status === 'present').length}
                      </div>
                      <div className="text-xs text-gray-600 font-medium mt-1">Present</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {todayAttendance.filter(r => r.status === 'absent').length}
                      </div>
                      <div className="text-xs text-gray-600 font-medium mt-1">Absent</div>
                    </div>
                  </div>
                  
                  {/* Latest session info */}
                  {todayAttendance.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Last recorded:</span>
                        <span>
                          {new Date(todayAttendance[0].created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-12">
              <div className="space-y-4">
                <Button
                  onClick={startSession}
                  disabled={loadingStudents}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold py-4 rounded-lg text-lg"
                >
                  {loadingStudents ? 'Loading Students...' : 'Start New Session'}
                </Button>
                
                <Button
                  onClick={() => navigate(`/teacher/attendance-history?course=${selectedCourseId}`)}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-4 rounded-lg text-lg flex items-center justify-center gap-2"
                >
                  <History className="w-5 h-5" />
                  View Attendance History
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Screen 1: Subject Selection
  if (!sessionStarted) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-2xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              Attendance Session
            </h1>
            <p className="text-muted-foreground">
              Select a subject to begin marking attendance
            </p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b">
              <CardTitle>Select Subject</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {courses.length > 0 ? (
                  <>
                    <div className="grid gap-3">
                      {courses.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => {
                            setSelectedCourseId(String(course.id));
                            setCourseLevel(course.level);
                            setShowSessionOptions(true);
                            // Fetch today's attendance for this course
                            setTimeout(() => {
                              fetchTodayAttendance();
                            }, 100);
                          }}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            String(selectedCourseId) === String(course.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="font-semibold text-gray-900">{course.code}</div>
                          <div className="text-sm text-gray-600">{course.title}</div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No subjects assigned</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Screen 2: Session Complete
  if (sessionComplete) {
    // Review mode: show full student list with attendance
    if (reviewingAttendance) {
      const presentStudents = students.filter(s => attendance[s.studentId || s.userId || s.id] === 'present');
      const absentStudents = students.filter(s => attendance[s.studentId || s.userId || s.id] === 'absent');
      const unmarkedStudents = students.filter(s => !attendance[s.studentId || s.userId || s.id]);

      return (
        <DashboardLayout>
          <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-3xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Attendance Review</CardTitle>
                <p className="text-sm text-gray-600 mt-2">
                  {selectedCourse?.code} - {new Date().toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Present</div>
                    <div className="text-2xl font-bold text-green-600">{presentStudents.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Absent</div>
                    <div className="text-2xl font-bold text-red-600">{absentStudents.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Unmarked</div>
                    <div className="text-2xl font-bold text-gray-600">{unmarkedStudents.length}</div>
                  </div>
                </div>

                {/* Present Students */}
                {presentStudents.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                      <Check className="w-4 h-4" /> Present ({presentStudents.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {presentStudents.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800">{student.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">{student.studentId || student.userId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Absent Students */}
                {absentStudents.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                      <X className="w-4 h-4" /> Absent ({absentStudents.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {absentStudents.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                          <X className="w-4 h-4 text-red-600 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800">{student.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">{student.studentId || student.userId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmarked Students */}
                {unmarkedStudents.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-3">Not Marked ({unmarkedStudents.length})</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {unmarkedStudents.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg">
                          <div className="w-4 h-4 rounded border border-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{student.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">{student.studentId || student.userId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                  <Button
                    onClick={() => setReviewingAttendance(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      setSessionStarted(false);
                      setSelectedCourseId('');
                      setCourseLevel(null);
                      setAttendance({});
                      setReviewingAttendance(false);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold"
                  >
                    Start New Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      );
    }

    // Completion summary
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-2xl mx-auto">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="mb-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Attendance Complete!</h2>
                <p className="text-lg text-gray-600 mb-6">
                  Marked {markedCount} out of {totalCount} students
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Present</div>
                    <div className="text-2xl font-bold text-green-600">
                      {Object.values(attendance).filter(v => v === 'present').length}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Absent</div>
                    <div className="text-2xl font-bold text-red-600">
                      {Object.values(attendance).filter(v => v === 'absent').length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => setReviewingAttendance(true)}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 rounded-lg"
                >
                  Review Attendance
                </Button>
                <Button
                  onClick={() => {
                    setSessionStarted(false);
                    setSelectedCourseId('');
                    setCourseLevel(null);
                    setAttendance({});
                  }}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold py-3 rounded-lg"
                >
                  Start New Session
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Screen 3: Swipe Attendance
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {selectedCourse?.code}
          </h1>
          <p className="text-muted-foreground mb-4">{selectedCourse?.title}</p>
          
          {/* Progress Bar */}
          <div className="bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` } as React.CSSProperties}
            />
          </div>
          <div className="text-sm text-gray-600">
            {markedCount} of {totalCount} students ({progress}%)
          </div>
        </div>

        {/* Instructions for Desktop */}
        <div className="hidden md:block bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            💡 Use <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-xs font-semibold">←</kbd> for <strong>Absent</strong> or <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-xs font-semibold">→</kbd> for <strong>Present</strong>
          </p>
        </div>

        {/* Student Card - Swipeable */}
        {currentStudent && (
          <div
            ref={cardRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="cursor-grab active:cursor-grabbing mb-8 select-none"
            style={{
              transform: `translateX(${dragOffset}px) rotateZ(${dragOffset * 0.05}deg)`,
              transition: dragStart === null ? 'transform 0.3s ease-out' : 'none',
              opacity: Math.max(0.5, 1 - Math.abs(dragOffset) / 300)
            } as React.CSSProperties}
          >
            <Card className="border-0 shadow-2xl overflow-hidden">
              <CardContent className="p-8 text-center bg-gradient-to-br from-slate-50 to-slate-100">
                {/* Avatar */}
                <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6">
                  {currentStudent.name.charAt(0).toUpperCase()}
                </div>

                {/* Student Info */}
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentStudent.name}
                </h2>
                <p className="text-gray-600 mb-6">
                  ID: {currentStudent.id}
                </p>

                {/* Status Indicator */}
                <div className="mb-8">
                  <div className="text-sm text-gray-600 mb-3">Swipe to mark attendance</div>
                  <div className="flex gap-4 justify-center">
                    {dragOffset < -20 && (
                      <div className="flex items-center gap-2 text-red-600 font-semibold">
                        <X className="w-5 h-5" /> Absent
                      </div>
                    )}
                    {dragOffset > 20 && (
                      <div className="flex items-center gap-2 text-green-600 font-semibold">
                        <Check className="w-5 h-5" /> Present
                      </div>
                    )}
                  </div>
                </div>

                {/* Button Controls */}
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => markStudent('absent')}
                    disabled={submitting}
                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-lg py-3 flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Absent
                  </Button>
                  <Button
                    onClick={() => markStudent('present')}
                    disabled={submitting}
                    className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 font-semibold rounded-lg py-3 flex items-center justify-center gap-2"
                  >
                    Present
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* End Session Button */}
        <Button
          onClick={() => {
            if (markedCount > 0) {
              submitAllAttendance(attendance);
            } else {
              notify.error('Please mark at least one student');
            }
          }}
          disabled={submitting || markedCount === 0}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold"
        >
          {submitting ? 'Submitting...' : `End Session (${markedCount}/${totalCount} marked)`}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default AttendanceDashboard;
