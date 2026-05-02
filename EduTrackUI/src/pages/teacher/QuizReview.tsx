import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Clock,
  Award,
  FileText,
  Eye
} from "lucide-react";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  points: number;
  order_number: number;
}

interface StudentAnswer {
  question_id: number;
  choice_id?: number;
  answer_text?: string;
  is_correct?: boolean;
  points_earned?: number;
}

interface Student {
  id: number;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Activity {
  id: number;
  title: string;
  type: string;
  max_score: number;
  description: string;
}

interface StudentSubmission {
  student_id: number;
  student_name: string;
  student_number: string;
  submitted_at: string;
  grade: number;
  total_points_earned: number;
  answers: StudentAnswer[];
}

const QuizReview = () => {
  const { courseId, activityId } = useParams();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('section_id');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

      // Fetch questions
      const questionsRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions`);
      if (questionsRes.success && questionsRes.data) {
        setQuestions(questionsRes.data);
      }

      // Fetch students
      let studentList: any[] = [];
      if (sectionId) {
        try {
          const params = new URLSearchParams();
          params.set('section_id', String(sectionId));
          const studentsRes = await apiGet(`${API_ENDPOINTS.STUDENTS}?${params.toString()}`);
          studentList = studentsRes.data ?? studentsRes.students ?? studentsRes ?? [];
        } catch (e) {
          console.error('Error fetching students:', e);
        }
      }
      setStudents(Array.isArray(studentList) ? studentList : []);

      // Fetch student answers
      await loadStudentAnswers(studentList);

    } catch (error) {
      console.error('Error loading data:', error);
      setAlert({ type: 'error', message: 'Failed to load quiz data' });
    } finally {
      setLoading(false);
    }
  };

  const loadStudentAnswers = async (studentList: any[]) => {
    try {
      const submissionsList: StudentSubmission[] = [];

      for (const student of studentList) {
        try {
          // Fetch student's answers for this activity
          const answersRes = await apiGet(
            `${API_ENDPOINTS.ACTIVITY_GRADES(activityId)}?student_id=${student.id}`
          );

          // Fetch activity_student_answers
          const studentAnswersRes = await apiGet(
            `/api/activities/${activityId}/student-answers?student_id=${student.id}`
          );

          const payload = studentAnswersRes.data;
          const answers = Array.isArray(payload) ? payload : (payload?.answers || []);

          if (studentAnswersRes.success && answers.length > 0) {
            const totalPointsEarned = answers.reduce((sum: number, ans: any) => {
              const points = parseFloat(ans.points_earned) || 0;
              return sum + points;
            }, 0);
            
            submissionsList.push({
              student_id: student.id,
              student_name: `${student.first_name} ${student.last_name}`,
              student_number: student.student_id,
              submitted_at: answers[0]?.answered_at || null,
              grade: parseFloat(answersRes.data?.[0]?.grade) || totalPointsEarned,
              total_points_earned: totalPointsEarned,
              answers: answers
            });
          }
        } catch (e) {
          console.error(`Error fetching answers for student ${student.id}:`, e);
        }
      }

      setSubmissions(submissionsList);
    } catch (error) {
      console.error('Error loading student answers:', error);
    }
  };

  const stats = {
    total: students.length,
    submitted: submissions.filter(s => s.submitted_at).length,
    averageScore: submissions.length > 0 
      ? (submissions.reduce((sum, s) => sum + (Number(s.total_points_earned) || 0), 0) / submissions.length).toFixed(1)
      : '0'
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading quiz submissions...</p>
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
                <p className="text-gray-600 mt-1">Review student quiz submissions</p>
                <div className="flex items-center gap-3 mt-3">
                  <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    {activity?.type}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    <Award className="h-4 w-4 inline mr-1" />
                    {activity?.max_score} points
                  </span>
                  <span className="text-sm text-gray-600">
                    <FileText className="h-4 w-4 inline mr-1" />
                    {questions.length} questions
                  </span>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <div className="text-xs text-blue-600 font-semibold">Total Students</div>
                  <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                  <div className="text-xs text-purple-600 font-semibold">Submitted</div>
                  <div className="text-2xl font-bold text-purple-700">{stats.submitted}</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-600 font-semibold">Avg Score</div>
                  <div className="text-2xl font-bold text-green-700">{stats.averageScore}</div>
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
                const submissionA = submissions.find(s => s.student_id === a.id);
                const submissionB = submissions.find(s => s.student_id === b.id);
                
                // Students with submissions come first
                if (submissionA?.submitted_at && !submissionB?.submitted_at) return -1;
                if (!submissionA?.submitted_at && submissionB?.submitted_at) return 1;
                
                return 0;
              })
              .map((student) => {
              const submission = submissions.find(s => s.student_id === student.id);
              const pointsEarned = Number(submission?.total_points_earned || 0);
              const maxScore = Number(activity?.max_score || 0);
              const percentage = maxScore > 0 ? Math.round((pointsEarned / maxScore) * 100) : 0;

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

                      <div className="flex items-center gap-4">
                        {submission?.submitted_at ? (
                          <>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Score</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {pointsEarned.toFixed(2)} / {maxScore}
                              </p>
                              <p className="text-xs text-gray-500">{percentage}%</p>
                            </div>
                            <Badge className={percentage >= 75 ? 'bg-green-600' : percentage >= 50 ? 'bg-amber-600' : 'bg-red-600'}>
                              <Clock className="h-3 w-3 mr-1" />
                              Submitted
                            </Badge>
                            <Button
                              onClick={() => navigate(`/teacher/courses/${courseId}/activities/${activityId}/review/${student.id}?section_id=${sectionId}`)}
                              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Review
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="border-gray-400 text-gray-600">
                            Not Submitted
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {students.length === 0 && (
              <Card className="p-12 text-center border-2 border-dashed">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
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

export default QuizReview;
