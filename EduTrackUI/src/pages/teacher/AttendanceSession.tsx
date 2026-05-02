import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { API_ENDPOINTS, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

interface LocationState {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseLevel: string | number;
}

const AttendanceSession: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotification();
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);

  const state = location.state as LocationState;

  // Session states
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  
  // Attendance tracking
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'late' | 'absent' | 'excused'>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [reviewingAttendance, setReviewingAttendance] = useState(false);

  // Swipe/drag states
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [markedStatus, setMarkedStatus] = useState<'present' | 'late' | 'absent' | 'excused' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Redirect if no state passed
  useEffect(() => {
    if (!state || !state.courseId) {
      navigate('/teacher/attendance');
    }
  }, [state, navigate]);

  // Fetch teacher ID on mount
  useEffect(() => {
    const fetchTeacherId = async () => {
      if (!user?.id) return;
      
      try {
        const teacherRes = await apiGet(`/api/teachers/by-user/${user.id}`);
        if (teacherRes && teacherRes.teacher && teacherRes.teacher.id) {
          setTeacherId(teacherRes.teacher.id);
          console.log('Teacher ID fetched:', teacherRes.teacher.id);
        } else {
          console.error('Could not find teacher record for user:', user.id);
          notify.error('Could not load teacher information');
        }
      } catch (err) {
        console.error('Failed to get teacher by user_id:', err);
        notify.error('Failed to load teacher information');
      }
    };

    fetchTeacherId();
  }, [user]);

  // Auto-start session on mount
  useEffect(() => {
    if (state && state.courseId && !sessionStarted && students.length === 0) {
      startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        markStudent('excused');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        markStudent('late');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionStarted, currentStudentIndex, students]);

  const fetchStudentsByLevel = async (level: string | number) => {
    setLoadingStudents(true);
    try {
      const params = new URLSearchParams();
      params.set('year_level', String(level));
      
      const res = await apiGet(`${API_ENDPOINTS.STUDENTS}?${params.toString()}`);
      const list = res.data ?? res.students ?? res ?? [];
      
      if (Array.isArray(list) && list.length > 0) {
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
        
        const shuffled = normalized.sort(() => Math.random() - 0.5);
        setStudents(shuffled);
        return true;
      }
      notify.error('No students found for this level');
      return false;
    } catch (err) {
      console.error('Error fetching students:', err);
      notify.error('Error fetching students');
      return false;
    } finally {
      setLoadingStudents(false);
    }
  };

  const startSession = async () => {
    if (!state) return;

    const success = await fetchStudentsByLevel(state.courseLevel);
    if (!success) {
      navigate('/teacher/attendance');
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newSessionId = `MCA-${dateStr}-${randomStr}`;
    
    setSessionId(newSessionId);
    setSessionStarted(true);
    setCurrentStudentIndex(0);
    setAttendance({});
  };

  const markStudent = (status: 'present' | 'late' | 'absent' | 'excused') => {
    const currentStudent = students[currentStudentIndex];
    if (!currentStudent || isAnimating) return;

    const studentKey = currentStudent.studentId || currentStudent.userId || currentStudent.id;
    
    // Show visual feedback
    setMarkedStatus(status);
    setIsAnimating(true);

    setAttendance(prev => ({
      ...prev,
      [studentKey]: status
    }));

    // Wait for animation - longer delay for better feedback
    setTimeout(() => {
      setMarkedStatus(null);
      setIsAnimating(false);
      setDragStart(null); // Reset drag state
      setDragOffset({ x: 0, y: 0 });

      if (currentStudentIndex < students.length - 1) {
        setCurrentStudentIndex(prev => prev + 1);
      } else {
        setReviewingAttendance(false);
        setSessionComplete(true);
      }
    }, 800); // Reduced slightly since we removed card feedback
  };

  const submitAllAttendance = async () => {
    if (!state) return;

    // Debug: Check if user exists and has an id
    console.log('Current user from useAuth:', user);
    console.log('User ID (for teacher_id):', user?.id);

    if (!user?.id) {
      notify.error('User not authenticated. Please refresh the page.');
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      const records = students
        .filter(student => {
          const studentKey = student.studentId || student.userId || student.id;
          return attendance[studentKey];
        })
        .map(student => {
          const studentKey = student.studentId || student.userId || student.id;
          return {
            course_id: state.courseId,
            student_id: student.studentId, // Use student_id VARCHAR (e.g., "STU-2024-001")
            teacher_id: user.id, // Use user_id (52) which matches teachers.user_id foreign key
            status: attendance[studentKey],
            session_id: sessionId,
            attendance_date: new Date().toISOString().split('T')[0]
          };
        });

      if (records.length === 0) {
        notify.error('No attendance records to submit');
        setSubmitting(false);
        return;
      }

      console.log('Submitting attendance records:', { records });
      console.log('First record sample:', records[0]);

      const res = await apiPost(API_ENDPOINTS.ATTENDANCE_BULK, { records });

      console.log('Attendance submission response:', res);
      console.log('Full errors array:', res.errors);

      // Check for errors even if success is true
      if (res.errors && res.errors.length > 0) {
        console.error('Attendance submission errors:', res.errors);
        // Log each error individually for clarity
        res.errors.forEach((err: string, idx: number) => {
          console.error(`Error ${idx}:`, err);
        });
      }

      if (res.success || res.data?.success) {
        const insertedCount = res.inserted_count || res.data?.inserted_count || records.length;
        
        if (insertedCount === 0 && res.errors && res.errors.length > 0) {
          // All records failed - show first few errors
          const errorSummary = res.errors.slice(0, 3).join('; ');
          notify.error(`Failed to insert records: ${errorSummary}`);
        } else if (insertedCount < records.length) {
          // Partial success
          notify.success(`Submitted ${insertedCount} of ${records.length} records. Check console for errors.`);
          setTimeout(() => navigate('/teacher/attendance'), 2000);
        } else {
          // Full success
          notify.success(`Successfully submitted ${insertedCount} attendance records`);
          navigate('/teacher/attendance');
        }
      } else {
        const errorMsg = res.message || res.data?.message || 'Failed to submit attendance';
        console.error('Submission failed:', res);
        notify.error(errorMsg);
      }
    } catch (err: any) {
      console.error('Error submitting attendance:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Error submitting attendance';
      notify.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Swipe handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAnimating) return;
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart === null || isAnimating) return;
    setDragOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    if (dragStart === null || isAnimating) return;

    const horizontalSwipe = Math.abs(dragOffset.x);
    const verticalSwipe = Math.abs(dragOffset.y);
    const threshold = 80;

    // Horizontal swipe (Tinder-style) for Present/Absent
    if (horizontalSwipe > verticalSwipe && horizontalSwipe > threshold) {
      if (dragOffset.x > 0) {
        markStudent('present');
      } else {
        markStudent('absent');
      }
    }
    // Vertical swipe (TikTok-style) for Excused/Late
    else if (verticalSwipe > horizontalSwipe && verticalSwipe > threshold) {
      if (dragOffset.y < 0) {
        markStudent('excused'); // Swipe up
      } else {
        markStudent('late'); // Swipe down
      }
    } else {
      // Not enough distance, reset
      setDragStart(null);
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return;
    e.preventDefault(); // Prevent scrolling when touching the card
    setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart === null || isAnimating) return;
    e.preventDefault(); // Prevent scrolling while dragging the card
    setDragOffset({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    if (dragStart === null || isAnimating) return;

    const horizontalSwipe = Math.abs(dragOffset.x);
    const verticalSwipe = Math.abs(dragOffset.y);
    const threshold = 80;

    // Horizontal swipe (Tinder-style) for Present/Absent
    if (horizontalSwipe > verticalSwipe && horizontalSwipe > threshold) {
      if (dragOffset.x > 0) {
        markStudent('present');
      } else {
        markStudent('absent');
      }
    }
    // Vertical swipe (TikTok-style) for Excused/Late
    else if (verticalSwipe > horizontalSwipe && verticalSwipe > threshold) {
      if (dragOffset.y < 0) {
        markStudent('excused'); // Swipe up
      } else {
        markStudent('late'); // Swipe down
      }
    } else {
      // Not enough distance, reset
      setDragStart(null);
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Calculate full-screen edge glow effect (FPS low-HP style)
  const getScreenGlow = () => {
    if (isAnimating || !dragStart) return { color: '', intensity: 0 };
    
    const horizontalSwipe = Math.abs(dragOffset.x);
    const verticalSwipe = Math.abs(dragOffset.y);
    const intensity = Math.min((horizontalSwipe + verticalSwipe) / 100, 1); // 0 to 1

    let color = '';
    if (horizontalSwipe > verticalSwipe) {
      if (dragOffset.x > 30) {
        color = '34, 197, 94'; // Green RGB for present
      } else if (dragOffset.x < -30) {
        color = '239, 68, 68'; // Red RGB for absent
      }
    } else {
      if (dragOffset.y < -30) {
        color = '59, 130, 246'; // Blue RGB for excused
      } else if (dragOffset.y > 30) {
        color = '234, 179, 8'; // Yellow RGB for late
      }
    }
    
    return { color, intensity };
  };

  if (!state) {
    return null;
  }

  const currentStudent = students[currentStudentIndex];
  const markedCount = Object.keys(attendance).length;
  const totalCount = students.length;
  const progress = totalCount > 0 ? Math.round((markedCount / totalCount) * 100) : 0;
  const screenGlow = getScreenGlow();

  // Screen 2: Session Complete
  if (sessionComplete) {
    // Review mode: show full student list with attendance
    if (reviewingAttendance) {
      const presentStudents = students.filter(s => attendance[s.studentId || s.userId || s.id] === 'present');
      const lateStudents = students.filter(s => attendance[s.studentId || s.userId || s.id] === 'late');
      const absentStudents = students.filter(s => attendance[s.studentId || s.userId || s.id] === 'absent');
      const excusedStudents = students.filter(s => attendance[s.studentId || s.userId || s.id] === 'excused');
      const unmarkedStudents = students.filter(s => !attendance[s.studentId || s.userId || s.id]);

      return (
        <DashboardLayout>
          <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-3xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Attendance Review</CardTitle>
                <p className="text-sm text-gray-600 mt-2">
                  {state.courseCode} - {new Date().toLocaleDateString()}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-5 gap-3 bg-gray-50 p-4 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Present</div>
                    <div className="text-2xl font-bold text-green-600">{presentStudents.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Late</div>
                    <div className="text-2xl font-bold text-yellow-600">{lateStudents.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Absent</div>
                    <div className="text-2xl font-bold text-red-600">{absentStudents.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 font-medium">Excused</div>
                    <div className="text-2xl font-bold text-blue-600">{excusedStudents.length}</div>
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

                {/* Late Students */}
                {lateStudents.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                      <ChevronLeft className="w-4 h-4 -rotate-90" /> Late ({lateStudents.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {lateStudents.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                          <ChevronLeft className="w-4 h-4 text-yellow-600 flex-shrink-0 -rotate-90" />
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

                {/* Excused Students */}
                {excusedStudents.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                      <ChevronLeft className="w-4 h-4 rotate-90" /> Excused ({excusedStudents.length})
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {excusedStudents.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <ChevronLeft className="w-4 h-4 text-blue-600 flex-shrink-0 rotate-90" />
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
                    onClick={() => navigate('/teacher/attendance')}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold"
                  >
                    Return to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      );
    }

    // Completion summary screen
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-2xl mx-auto">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl text-green-800">Session Complete!</CardTitle>
                <p className="text-sm text-gray-600 mt-2">
                  {state.courseCode} - {new Date().toLocaleDateString()}
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-6 bg-green-50 rounded-xl border-2 border-green-200">
                    <div className="text-4xl font-bold text-green-600 mb-2">
                      {students.filter(s => attendance[s.studentId || s.userId || s.id] === 'present').length}
                    </div>
                    <div className="text-sm text-green-700 font-medium">Present</div>
                  </div>
                  <div className="text-center p-6 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                    <div className="text-4xl font-bold text-yellow-600 mb-2">
                      {students.filter(s => attendance[s.studentId || s.userId || s.id] === 'late').length}
                    </div>
                    <div className="text-sm text-yellow-700 font-medium">Late</div>
                  </div>
                  <div className="text-center p-6 bg-red-50 rounded-xl border-2 border-red-200">
                    <div className="text-4xl font-bold text-red-600 mb-2">
                      {students.filter(s => attendance[s.studentId || s.userId || s.id] === 'absent').length}
                    </div>
                    <div className="text-sm text-red-700 font-medium">Absent</div>
                  </div>
                  <div className="text-center p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {students.filter(s => attendance[s.studentId || s.userId || s.id] === 'excused').length}
                    </div>
                    <div className="text-sm text-blue-700 font-medium">Excused</div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600">Session ID</div>
                  <div className="text-lg font-mono font-bold text-gray-900 mt-1">{sessionId}</div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <Button
                    onClick={() => setReviewingAttendance(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4"
                  >
                    Review Attendance
                  </Button>
                  
                  <Button
                    onClick={submitAllAttendance}
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-semibold py-4"
                  >
                    {submitting ? 'Submitting...' : 'Submit Attendance'}
                  </Button>

                  <Button
                    onClick={() => navigate('/teacher/attendance')}
                    variant="outline"
                    className="w-full font-semibold py-4"
                  >
                    Return to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Main session screen - Swipe cards
  if (!sessionStarted || !currentStudent) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-2xl mx-auto">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading session...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Full-Screen Edge Glow Overlay (FPS low-HP style) */}
      {screenGlow.color && (
        <div
          className="fixed inset-0 pointer-events-none z-50 transition-all duration-200"
          style={{
            boxShadow: `inset 0 0 ${100 + screenGlow.intensity * 150}px ${30 + screenGlow.intensity * 70}px rgba(${screenGlow.color}, ${0.2 + screenGlow.intensity * 0.3})`,
            background: `radial-gradient(circle at center, transparent 40%, rgba(${screenGlow.color}, ${screenGlow.intensity * 0.15}) 100%)`
          }}
        />
      )}
      
      <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent mb-2">
                {state.courseTitle}
              </h1>
              <p className="text-gray-600">Attendance session for {new Date().toLocaleDateString()}</p>
            </div>
            <Button
              onClick={() => {
                if (confirm('Are you sure you want to exit? Progress will be lost.')) {
                  navigate('/teacher/attendance');
                }
              }}
              variant="outline"
              size="sm"
            >
              Exit
            </Button>
          </div>

          {/* Progress bar */}
          <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            {markedCount} of {totalCount} students marked ({progress}%)
          </p>
        </div>

        {/* Swipe Card */}
        <div className="relative h-[480px] flex items-center justify-center mb-8">
          <Card
            ref={cardRef}
            className="absolute w-full max-w-md min-h-[420px] border-0 shadow-2xl cursor-grab active:cursor-grabbing transition-all duration-300 flex items-center"
            style={{
              transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${dragOffset.x / 20}deg)`,
              transition: dragStart === null || isAnimating ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'none',
              opacity: isAnimating ? 0 : Math.max(0.5, 1 - (Math.abs(dragOffset.x) + Math.abs(dragOffset.y)) / 400),
              touchAction: 'none' // Prevent all touch gestures including scrolling
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <CardContent className="py-16 px-12 bg-white w-full">
              <div className="text-center space-y-8">
                {/* Student Avatar */}
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center">
                  <span className="text-5xl font-bold text-white">
                    {currentStudent.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>

                {/* Student Info */}
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentStudent.name}</h2>
                  <p className="text-lg text-gray-600">{currentStudent.studentId || currentStudent.userId}</p>
                </div>

                {/* Swipe hint for mobile - only shown on touch devices */}
                {!markedStatus && (
                  <div className="md:hidden pt-4">
                    <p className="text-sm text-gray-500 italic">Swipe in any direction to mark</p>
                  </div>
                )}

                {/* Status feedback when marked */}
                {markedStatus && (
                  <div className={`text-center text-2xl font-bold animate-pulse pt-8 ${
                    markedStatus === 'present' ? 'text-green-600' :
                    markedStatus === 'absent' ? 'text-red-600' :
                    markedStatus === 'late' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {markedStatus === 'present' && <><Check className="w-8 h-8 inline mr-2" />Present!</>}
                    {markedStatus === 'absent' && <><X className="w-8 h-8 inline mr-2" />Absent!</>}
                    {markedStatus === 'late' && <>⏰ Late!</>}
                    {markedStatus === 'excused' && <>✓ Excused!</>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Swipe hint overlay */}
          {dragOffset.x === 0 && dragOffset.y === 0 && currentStudentIndex === 0 && markedCount === 0 && !markedStatus && (
            <div className="absolute top-0 left-0 right-0 text-center pointer-events-none">
              <div className="bg-blue-600 text-white text-sm px-4 py-2 rounded-full inline-block shadow-lg animate-bounce">
                Swipe or use buttons below
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-4">
          <Button
            onClick={() => markStudent('absent')}
            disabled={isAnimating}
            className="bg-red-100 hover:bg-red-200 text-red-700 font-semibold rounded-xl py-6 transition-all hover:scale-105"
          >
            Absent
          </Button>
          <Button
            onClick={() => markStudent('present')}
            disabled={isAnimating}
            className="bg-green-100 hover:bg-green-200 text-green-700 font-semibold rounded-xl py-6 transition-all hover:scale-105"
          >
            Present
          </Button>
          <Button
            onClick={() => markStudent('excused')}
            disabled={isAnimating}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold rounded-xl py-6 transition-all hover:scale-105"
          >
            Excused
          </Button>
          <Button
            onClick={() => markStudent('late')}
            disabled={isAnimating}
            className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 font-semibold rounded-xl py-6 transition-all hover:scale-105"
          >
            Late
          </Button>
        </div>

        {/* Undo Button */}
        {currentStudentIndex > 0 && !isAnimating && (
          <div className="max-w-md mx-auto mb-4">
            <Button
              onClick={() => {
                const prevIndex = currentStudentIndex - 1;
                const prevStudent = students[prevIndex];
                const prevKey = prevStudent?.studentId || prevStudent?.userId || prevStudent?.id;
                
                // Remove previous student's attendance record
                setAttendance(prev => {
                  const newAttendance = { ...prev };
                  delete newAttendance[prevKey];
                  return newAttendance;
                });
                
                // Go back to previous student
                setCurrentStudentIndex(prevIndex);
                notify.success('Went back to previous student');
              }}
              variant="outline"
              className="w-full py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-xl"
            >
              ↺ Undo Last Entry
            </Button>
          </div>
        )}

        {/* Submit Button */}
        <div className="max-w-md mx-auto">
          <Button
            onClick={() => {
              if (markedCount > 0) {
                submitAllAttendance();
              } else {
                notify.error('Please mark at least one student');
              }
            }}
            disabled={submitting || markedCount === 0 || isAnimating}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold rounded-xl shadow-lg"
          >
            {submitting ? 'Submitting...' : `Submit Attendance (${markedCount}/${totalCount})`}
          </Button>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Use arrow keys: → Present | ← Absent | ↑ Excused | ↓ Late</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AttendanceSession;
