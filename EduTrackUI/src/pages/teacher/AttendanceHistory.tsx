import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { API_ENDPOINTS, apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';
import { Check, X, Clock, ChevronLeft } from 'lucide-react';

interface AttendanceRecord {
  student_id: string;
  student_name: string;
  created_at: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  session_id: string;
}

interface Student {
  studentId: string;
  name: string;
}

const AttendanceHistory: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [uniqueDates, setUniqueDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ studentId: string; date: string } | null>(null);

  const { user } = useAuth();
  const notify = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get course from URL or state
  useEffect(() => {
    const courseFromUrl = searchParams.get('course');
    if (courseFromUrl) {
      setSelectedCourseId(courseFromUrl);
    }
    // Always load courses for reference data
    fetchTeacherCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

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
        notify.error('Could not find teacher record');
        return;
      }

      const assignmentRes = await apiGet(`/api/teachers/${teacherId}/assignment`);
      if (!assignmentRes || !assignmentRes.success) {
        notify.error('Failed to fetch teacher assignment');
        return;
      }

      if (assignmentRes.assignment && assignmentRes.subjects && Array.isArray(assignmentRes.subjects)) {
        const mapped = assignmentRes.subjects.map((s: any) => ({
          id: s.id,
          code: s.code || '',
          title: s.name || '',
          level: s.level || s.year_level || null
        }));
        setCourses(mapped);
        if (mapped.length > 0) {
          setSelectedCourseId(String(mapped[0].id));
        }
      }
    } catch (e) {
      console.error('fetchTeacherCourses error:', e);
      notify.error('Failed to load courses');
    }
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const course = courses.find(c => String(c.id) === String(selectedCourseId));
      
      // Fetch all attendance records for this course
      const res = await apiGet(`${API_ENDPOINTS.ATTENDANCE_COURSE(parseInt(selectedCourseId))}`);
      const records = Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];

      // Fetch all students for this course level using year_level (same as AttendanceQR)
      let studentsList: Student[] = [];
      
      // Try multiple ways to get the year_level/level
      let yearLevel = course?.level || course?.year_level;
      console.log('Course from array:', course, 'Year Level:', yearLevel);
      
      // If not found in courses array, fetch subject directly
      if (!yearLevel && selectedCourseId) {
        try {
          console.log('Fetching subject info for course_id:', selectedCourseId);
          const subjectRes = await apiGet(`/api/subjects/${selectedCourseId}`);
          const subject = subjectRes?.subject || subjectRes?.data;
          console.log('Subject data:', subject);
          yearLevel = subject?.year_level || subject?.level;
          console.log('Year level from subject:', yearLevel);
        } catch (err) {
          console.error('Error fetching subject:', err);
        }
      }
      
      try {
        if (yearLevel) {
          const params = new URLSearchParams();
          params.set('year_level', String(yearLevel));
          console.log('Fetching students with params:', params.toString());
          
          const stuRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?${params.toString()}`);
          console.log('Students response:', stuRes);
          
          // Handle different response formats
          const stuList = Array.isArray(stuRes.data) 
            ? stuRes.data 
            : Array.isArray(stuRes) 
            ? stuRes 
            : stuRes?.students || [];
          
          console.log('Students list count:', stuList.length);
          
          studentsList = stuList
            .map((st: any) => ({
              studentId: st.student_id || st.id,
              name: (st.first_name && st.last_name) ? `${st.first_name} ${st.last_name}` : st.name || st.student_id
            }))
            .sort((a: Student, b: Student) => a.name.localeCompare(b.name));
        } else {
          console.warn('Could not determine year_level from course or subject');
        }
      } catch (stuErr) {
        console.error('Error fetching students list:', stuErr);
        notify.warning('Could not fetch full student list');
      }

      // If no students fetched from API, extract from attendance records as fallback
      if (studentsList.length === 0 && records.length > 0) {
        console.log('Using fallback: extracting students from attendance records');
        const studentsMap = new Map<string, string>();
        records.forEach((r: any) => {
          if (!studentsMap.has(r.student_id)) {
            studentsMap.set(r.student_id, r.student_name || r.student_id);
          }
        });

        studentsList = Array.from(studentsMap).map(([id, name]) => ({
          studentId: id,
          name: name
        }));
        studentsList.sort((a, b) => a.name.localeCompare(b.name));
      }

      setStudents(studentsList);

      // Extract unique dates and sort
      if (records.length > 0) {
        const datesSet = new Set<string>();
        records.forEach((r: any) => {
          const date = new Date(r.created_at).toISOString().split('T')[0];
          datesSet.add(date);
        });

        const datesList = Array.from(datesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        setUniqueDates(datesList);
      } else {
        setUniqueDates([]);
      }

      setAttendanceData(records);

      if (records.length === 0 && studentsList.length === 0) {
        notify.info('No attendance records or students found for this course');
      }
    } catch (e: any) {
      console.error('Error fetching attendance data:', e);
      notify.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceStatus = (studentId: string, date: string): AttendanceRecord | null => {
    const record = attendanceData.find(
      r =>
        r.student_id === studentId &&
        new Date(r.created_at).toISOString().split('T')[0] === date
    );
    return record || null;
  };

  const updateAttendanceStatus = async (
    studentId: string,
    date: string,
    newStatus: 'present' | 'late' | 'absent' | 'excused'
  ) => {
    try {
      const recordsForDate = attendanceData.filter(
        r => new Date(r.created_at).toISOString().split('T')[0] === date
      );

      const sessionId = recordsForDate[0]?.session_id || `MCA-${date.replace(/-/g, '')}-manual`;

      // Submit new record
      await apiPost(API_ENDPOINTS.ATTENDANCE_MARK, {
        session_id: sessionId,
        student_id: studentId,
        teacher_id: user?.id,
        course_id: parseInt(selectedCourseId),
        status: newStatus
      });

      notify.success(`Updated to ${newStatus}`);
      
      // Refresh data
      fetchAttendanceData();
      setEditingCell(null);
    } catch (e: any) {
      console.error('Error updating attendance:', e);
      notify.error('Failed to update attendance');
    }
  };

  const getStatusColor = (status: string | null): string => {
    switch (status) {
      case 'present':
        return 'bg-green-100';
      case 'late':
        return 'bg-orange-100';
      case 'absent':
        return 'bg-red-100';
      case 'excused':
        return 'bg-blue-100';
      case 'not-recorded':
        return 'bg-gray-100';
      default:
        return 'bg-gray-50';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'present':
        return <Check className="w-5 h-5 text-green-600" />;
      case 'late':
        return <Clock className="w-5 h-5 text-orange-600" />;
      case 'absent':
        return <X className="w-5 h-5 text-red-600" />;
      case 'excused':
        return <ChevronLeft className="w-5 h-5 text-blue-600 rotate-90" />;
      default:
        return null;
    }
  };

  if (!selectedCourseId) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Attendance History</h1>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg mb-6">Select a course to view attendance history</p>
              {courses.length > 0 ? (
                <div className="space-y-3">
                  {courses.map(course => (
                    <Button
                      key={course.id}
                      onClick={() => setSelectedCourseId(String(course.id))}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                    >
                      {course.code} - {course.title}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No courses available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const selectedCourse = courses.find(c => String(c.id) === String(selectedCourseId));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8">
          <p className="text-center text-gray-500">Loading attendance data...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 md:p-8 pt-20 md:pt-8 max-w-7xl mx-auto">
        <Button
          onClick={() => navigate('/teacher/attendance')}
          variant="ghost"
          className="mb-6"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Attendance
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Attendance History</h1>
          <p className="text-gray-600">
            {selectedCourse?.code} - {selectedCourse?.title}
          </p>
        </div>

        {students.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg">No attendance records found</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
                      <th className="px-6 py-4 text-left font-semibold border-b border-gray-200 sticky left-0 bg-blue-600 z-10 min-w-48">
                        Student Name
                      </th>
                      {uniqueDates.map(date => (
                        <th
                          key={date}
                          className="px-4 py-4 text-center font-semibold border-b border-gray-200 min-w-24 whitespace-nowrap"
                        >
                          <div className="text-sm">
                            {new Date(date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, idx) => (
                      <tr
                        key={student.studentId}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-6 py-4 border-b border-gray-200 sticky left-0 bg-inherit z-10 font-medium text-gray-900">
                          <div>{student.name}</div>
                          <div className="text-sm text-gray-500">{student.studentId}</div>
                        </td>
                        {uniqueDates.map(date => {
                          const record = getAttendanceStatus(student.studentId, date);
                          const status = record?.status || null;
                          const isEditing = editingCell?.studentId === student.studentId && editingCell?.date === date;

                          return (
                            <td
                              key={`${student.studentId}-${date}`}
                              className={`px-4 py-4 border-b border-gray-200 text-center ${getStatusColor(status)}`}
                            >
                              {isEditing ? (
                                <div className="flex flex-col gap-2">
                                  <Button
                                    onClick={() => updateAttendanceStatus(student.studentId, date, 'present')}
                                    size="sm"
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={() => updateAttendanceStatus(student.studentId, date, 'late')}
                                    size="sm"
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                                  >
                                    <Clock className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={() => updateAttendanceStatus(student.studentId, date, 'absent')}
                                    size="sm"
                                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={() => updateAttendanceStatus(student.studentId, date, 'excused')}
                                    size="sm"
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    <ChevronLeft className="w-4 h-4 rotate-90" />
                                  </Button>
                                  <Button
                                    onClick={() => setEditingCell(null)}
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => setEditingCell({ studentId: student.studentId, date })}
                                  className="cursor-pointer flex items-center justify-center hover:opacity-75 transition-opacity min-h-10"
                                >
                                  {status ? (
                                    <>
                                      {getStatusIcon(status)}
                                      <span className="ml-1 text-sm font-medium capitalize">{status}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-gray-600 font-medium">Not Recorded</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AttendanceHistory;
