import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  FileIcon, 
  Download, 
  CheckCircle2, 
  Clock, 
  XCircle,
  FileText,
  Award,
  MessageSquare,
  Save,
  Eye,
  Calendar,
  Users
} from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";

interface Student {
  id: number;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Submission {
  student_id: number;
  student_name: string;
  student_number: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  submission_type: 'file' | 'text' | 'link' | 'none';
  submission_text: string | null;
  submission_url: string | null;
  submitted_at: string | null;
  grade: number | null;
  feedback: string | null;
  status: 'submitted' | 'graded' | 'not_submitted' | 'late';
}

interface Activity {
  id: number;
  title: string;
  type: string;
  max_score: number;
  due_at: string | null;
  description: string | null;
  allow_late_submission: boolean;
}

const ActivityOutputs = () => {
  const { courseId, activityId } = useParams();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('section_id');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingGrades, setSavingGrades] = useState<Set<number>>(new Set());

  // Local state for grade inputs
  const [gradeInputs, setGradeInputs] = useState<{ [studentId: number]: { grade: string; feedback: string } }>({});

  useEffect(() => {
    loadData();
  }, [activityId, courseId, sectionId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch activity details
      const activityRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}`);
      if (activityRes.success && activityRes.data) {
        setActivity(activityRes.data);
      }

      // Fetch students using query parameters
      let studentList: any[] = [];
      if (sectionId) {
        try {
          const params = new URLSearchParams();
          params.set('section_id', String(sectionId));
          const studentsRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?${params.toString()}`);
          studentList = studentsRes.data ?? studentsRes.students ?? studentsRes ?? [];
        } catch (e) {
          console.error('Error fetching students:', e);
          studentList = [];
        }
      }
      
      setStudents(Array.isArray(studentList) ? studentList : []);

      // Fetch submissions
      const submissionsRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/submissions`);
      if (submissionsRes.success && submissionsRes.data) {
        const submissionsList = Array.isArray(submissionsRes.data) ? submissionsRes.data : [];
        setSubmissions(submissionsList);

        // Initialize grade inputs from existing submissions
        const initialGrades: { [studentId: number]: { grade: string; feedback: string } } = {};
        submissionsList.forEach((sub: Submission) => {
          initialGrades[sub.student_id] = {
            grade: sub.grade !== null ? String(sub.grade) : '',
            feedback: sub.feedback || ''
          };
        });
        setGradeInputs(initialGrades);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setAlert({ type: 'error', message: 'Failed to load activity data' });
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (studentId: number, field: 'grade' | 'feedback', value: string) => {
    setGradeInputs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const saveGrade = async (studentId: number) => {
    const gradeData = gradeInputs[studentId];
    if (!gradeData || !gradeData.grade.trim()) {
      setAlert({ type: 'error', message: 'Please enter a grade' });
      return;
    }

    const gradeValue = Number(gradeData.grade);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > (activity?.max_score || 100)) {
      setAlert({ type: 'error', message: `Grade must be between 0 and ${activity?.max_score || 100}` });
      return;
    }

    try {
      setSavingGrades(prev => new Set(prev).add(studentId));
      
      const res = await apiPost(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/grade`, {
        student_id: studentId,
        grade: gradeValue,
        feedback: gradeData.feedback || null,
        status: 'graded'
      });

      if (res.success) {
        // Update submissions list
        setSubmissions(prev => prev.map(sub => 
          sub.student_id === studentId 
            ? { ...sub, grade: gradeValue, feedback: gradeData.feedback, status: 'graded' }
            : sub
        ));
        setAlert({ type: 'success', message: 'Grade saved successfully' });
      } else {
        setAlert({ type: 'error', message: res.message || 'Failed to save grade' });
      }
    } catch (error) {
      console.error('Error saving grade:', error);
      setAlert({ type: 'error', message: 'Error saving grade' });
    } finally {
      setSavingGrades(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getSubmissionForStudent = (studentId: number): Submission | null => {
    return submissions.find(sub => sub.student_id === studentId) || null;
  };

  const getStatusBadge = (submission: Submission | null) => {
    if (!submission || !submission.submitted_at) {
      return (
        <Badge className="bg-gray-100 text-gray-600 border border-gray-300">
          <XCircle className="h-3 w-3 mr-1" />
          Not Submitted
        </Badge>
      );
    }

    if (submission.status === 'graded') {
      return (
        <Badge className="bg-green-100 text-green-700 border border-green-300">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Graded
        </Badge>
      );
    }

    if (submission.status === 'late') {
      return (
        <Badge className="bg-amber-100 text-amber-700 border border-amber-300">
          <Clock className="h-3 w-3 mr-1" />
          Late Submission
        </Badge>
      );
    }

    return (
      <Badge className="bg-blue-100 text-blue-700 border border-blue-300">
        <FileIcon className="h-3 w-3 mr-1" />
        Submitted
      </Badge>
    );
  };

  const stats = {
    total: students.length,
    submitted: submissions.filter(s => s.submitted_at).length,
    graded: submissions.filter(s => s.status === 'graded').length,
    pending: submissions.filter(s => s.submitted_at && s.status !== 'graded').length
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading activity outputs...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/teacher/courses/${courseId}`)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Course
              </Button>
            </div>
            
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{activity?.title}</h1>
                <p className="text-gray-600 mt-1">Review and grade student submissions</p>
                <div className="flex items-center gap-3 mt-3">
                  <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    {activity?.type}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    <Award className="h-4 w-4 inline mr-1" />
                    {activity?.max_score} points
                  </span>
                  {activity?.due_at && (
                    <span className="text-sm text-gray-600">
                      <Calendar className="h-4 w-4 inline mr-1" />
                      Due: {new Date(activity.due_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <div className="text-xs text-blue-600 font-semibold">Total Students</div>
                  <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                  <div className="text-xs text-purple-600 font-semibold">Submitted</div>
                  <div className="text-2xl font-bold text-purple-700">{stats.submitted}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-600 font-semibold">Graded</div>
                  <div className="text-2xl font-bold text-green-700">{stats.graded}</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                  <div className="text-xs text-amber-600 font-semibold">Pending</div>
                  <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Submissions */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="space-y-4">
            {students
              .sort((a, b) => {
                const submissionA = getSubmissionForStudent(a.id);
                const submissionB = getSubmissionForStudent(b.id);
                
                // Students with submissions come first
                if (submissionA?.submitted_at && !submissionB?.submitted_at) return -1;
                if (!submissionA?.submitted_at && submissionB?.submitted_at) return 1;
                
                // Among submitted, graded ones come first
                if (submissionA?.submitted_at && submissionB?.submitted_at) {
                  if (submissionA.status === 'graded' && submissionB.status !== 'graded') return 1;
                  if (submissionA.status !== 'graded' && submissionB.status === 'graded') return -1;
                }
                
                return 0;
              })
              .map((student) => {
              const submission = getSubmissionForStudent(student.id);
              const gradeData = gradeInputs[student.id] || { grade: '', feedback: '' };
              const isSaving = savingGrades.has(student.id);

              return (
                <Card key={student.id} className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                  <div className="bg-gradient-to-r from-gray-50 to-blue-50/50 border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {student.first_name[0]}{student.last_name[0]}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {student.first_name} {student.last_name}
                          </h3>
                          <p className="text-sm text-gray-600">{student.student_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(submission)}
                        {submission?.submitted_at && (
                          <span className="text-xs text-gray-500">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {new Date(submission.submitted_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left Column - Submission Content */}
                      <div>
                        <Label className="text-sm font-medium text-gray-600 mb-4 block">
                          Submission Content
                        </Label>
                        
                        {!submission || !submission.submitted_at ? (
                          <div className="border border-dashed border-gray-300 rounded-lg p-12 text-center">
                            <FileIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500">No submission</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Text Submission Content */}
                            {submission.submission_text && submission.submission_type !== 'link' && (
                              <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
                                    <span className="text-xs font-medium text-gray-600">Text</span>
                                  </div>
                                </div>
                                <div className="p-3 bg-white max-h-48 overflow-y-auto text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                                  {submission.submission_text}
                                </div>
                              </div>
                            )}

                            {/* File Submissions */}
                            {submission.file_url && (() => {
                              try {
                                const fileUrls = JSON.parse(submission.file_url);
                                const fileNames = submission.file_name ? JSON.parse(submission.file_name) : [];
                                const fileSizes = submission.file_size ? [submission.file_size] : [];
                                
                                return (
                                  <div className="space-y-2">
                                    {(Array.isArray(fileUrls) ? fileUrls : [submission.file_url]).map((url: string, idx: number) => (
                                      <a
                                        key={idx}
                                        href={url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                                      >
                                        <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                                          <FileText className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-gray-800 truncate">
                                            {fileNames[idx] || `File ${idx + 1}`}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {formatFileSize(fileSizes[idx] || null)}
                                          </p>
                                        </div>
                                        <Download className="h-4 w-4 text-gray-400 flex-shrink-0 group-hover:text-blue-600 transition-colors" />
                                      </a>
                                    ))}
                                  </div>
                                );
                              } catch {
                                return (
                                  <a
                                    href={submission.file_url}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                                  >
                                    <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                                      <FileText className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-800 truncate">
                                        {submission.file_name || 'Submitted File'}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {formatFileSize(submission.file_size)}
                                      </p>
                                    </div>
                                    <Download className="h-4 w-4 text-gray-400 flex-shrink-0 group-hover:text-blue-600 transition-colors" />
                                  </a>
                                );
                              }
                            })()}

                            {/* Link Submission */}
                            {(submission.submission_url || (submission.submission_type === 'link' && submission.submission_text)) && (
                              <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                                  <div className="flex items-center gap-2">
                                    <FileIcon className="h-3.5 w-3.5 text-gray-500" />
                                    <span className="text-xs font-medium text-gray-600">Link</span>
                                  </div>
                                </div>
                                <div className="p-3 bg-white">
                                  <a 
                                    href={submission.submission_url || submission.submission_text} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                  >
                                    {submission.submission_url || submission.submission_text}
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right Column - Grading */}
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                          <Award className="h-4 w-4" />
                          Grading
                        </Label>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor={`grade-${student.id}`} className="text-sm text-gray-600">
                              Grade (max: {activity?.max_score})
                            </Label>
                            <Input
                              id={`grade-${student.id}`}
                              type="number"
                              min="0"
                              max={activity?.max_score}
                              value={gradeData.grade}
                              onChange={(e) => handleGradeChange(student.id, 'grade', e.target.value)}
                              placeholder="Enter grade"
                              className="mt-1"
                              disabled={!submission || !submission.submitted_at}
                            />
                          </div>

                          <div>
                            <Label htmlFor={`feedback-${student.id}`} className="text-sm text-gray-600 flex items-center gap-2">
                              <MessageSquare className="h-3.5 w-3.5" />
                              Feedback (optional)
                            </Label>
                            <Textarea
                              id={`feedback-${student.id}`}
                              value={gradeData.feedback}
                              onChange={(e) => handleGradeChange(student.id, 'feedback', e.target.value)}
                              placeholder="Add comments or feedback for the student..."
                              className="mt-1 resize-none"
                              rows={4}
                              disabled={!submission || !submission.submitted_at}
                            />
                          </div>

                          <Button
                            onClick={() => saveGrade(student.id)}
                            disabled={!submission || !submission.submitted_at || isSaving || !gradeData.grade}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                          >
                            {isSaving ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Save Grade
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {students.length === 0 && (
              <Card className="p-12 text-center border-2 border-dashed">
                <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No students enrolled in this course</p>
              </Card>
            )}
          </div>
        </div>

        {alert && (
          <div className="fixed bottom-6 right-6 z-50">
            <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ActivityOutputs;
