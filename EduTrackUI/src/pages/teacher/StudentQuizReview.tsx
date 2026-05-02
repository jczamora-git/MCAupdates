import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Award,
  Save,
  User,
  FileText,
  Clock
} from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  points: number;
  order_number: number;
  image_url?: string;
  correct_answer?: string;
  sample_answer?: string;
  choices?: Array<{
    id: number;
    choice_text: string;
    is_correct: boolean;
    order_number: number;
  }>;
}

interface StudentAnswer {
  question_id: number;
  choice_id?: number;
  answer_text?: string;
  is_correct?: boolean;
  points_earned?: number;
  selected_choices?: string;
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

const StudentQuizReview = () => {
  const { courseId, activityId, studentId } = useParams();
  const [searchParams] = useSearchParams();
  const sectionId = searchParams.get('section_id');
  const navigate = useNavigate();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [matchingOrderMap, setMatchingOrderMap] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [manualGrades, setManualGrades] = useState<{ [key: string]: { points: number; feedback: string } }>({});
  const [savingGrades, setSavingGrades] = useState<Set<string>>(new Set());
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const applyAnswersPayload = (payload: any) => {
    if (Array.isArray(payload)) {
      setAnswers(payload);
      setMatchingOrderMap({});
      return;
    }

    const normalizedAnswers = Array.isArray(payload?.answers) ? payload.answers : [];
    const normalizedMatchingOrder = payload?.matching_order && typeof payload.matching_order === 'object'
      ? payload.matching_order
      : {};

    setAnswers(normalizedAnswers);
    setMatchingOrderMap(normalizedMatchingOrder);
  };

  useEffect(() => {
    loadData();
  }, [activityId, studentId]);

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

      // Fetch student info
      const studentRes = await apiGet(`${API_ENDPOINTS.STUDENTS}/${studentId}`);
      if (studentRes.success && studentRes.data) {
        setStudent(studentRes.data);
      }

      // Fetch student answers
      const answersRes = await apiGet(`/api/activities/${activityId}/student-answers?student_id=${studentId}`);
      if (answersRes.success && answersRes.data) {
        applyAnswersPayload(answersRes.data);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setAlert({ type: 'error', message: 'Failed to load quiz data' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualGrade = (questionId: number, field: 'points' | 'feedback', value: string | number) => {
    const key = `${studentId}-${questionId}`;
    setManualGrades(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const saveManualGrade = async (questionId: number, customPoints?: number, customFeedback?: string) => {
    const key = `${studentId}-${questionId}`;
    const gradeData = customPoints !== undefined 
      ? { points: customPoints, feedback: customFeedback || '' }
      : manualGrades[key];

    if (!gradeData || gradeData.points === undefined) {
      setAlert({ type: 'error', message: 'Please enter points for this question' });
      return;
    }

    const question = questions.find(q => q.id === questionId);
    if (!question) return;

    if (gradeData.points < 0 || gradeData.points > question.points) {
      setAlert({ type: 'error', message: `Points must be between 0 and ${question.points}` });
      return;
    }

    try {
      setSavingGrades(prev => new Set(prev).add(key));

      const res = await apiPost(`/api/activities/${activityId}/grade-answer`, {
        student_id: Number(studentId),
        question_id: questionId,
        points_earned: gradeData.points,
        feedback: gradeData.feedback || null
      });

      if (res.success) {
        // Reload the answers to get updated totals
        const answersRes = await apiGet(`/api/activities/${activityId}/student-answers?student_id=${studentId}`);
        if (answersRes.success && answersRes.data) {
          applyAnswersPayload(answersRes.data);
        }
        
        // Clear the manual grade input after saving
        setManualGrades(prev => {
          const newGrades = { ...prev };
          delete newGrades[key];
          return newGrades;
        });
        
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
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const getStudentAnswer = (questionId: number): StudentAnswer | undefined => {
    return answers.find(a => a.question_id === questionId);
  };

  const renderStudentAnswer = (question: Question) => {
    const answer = getStudentAnswer(question.id);
    const key = `${studentId}-${question.id}`;
    const manualGrade = manualGrades[key] || { points: answer?.points_earned || 0, feedback: '' };

    if (!answer) {
      return (
        <div className="text-gray-500 italic p-4 bg-gray-50 rounded-lg">
          No answer submitted
        </div>
      );
    }

    const isAutoGraded = ['multiple_choice', 'true_false', 'multiple_select', 'matching', 'fill_blank'].includes(question.question_type);
    const needsManualGrading = ['essay', 'short_answer'].includes(question.question_type);

    return (
      <div className="space-y-4">
        {/* Student's Answer Display */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <Label className="text-sm font-semibold text-gray-700 mb-2 block">Student's Answer:</Label>
          
          {question.question_type === 'multiple_choice' && (
            <div className="space-y-2">
              {question.choices?.map(choice => {
                const isSelected = answer.choice_id === choice.id;
                const isCorrect = choice.is_correct;
                return (
                  <div
                    key={choice.id}
                    className={`p-3 rounded-lg border-2 ${
                      isSelected && isCorrect
                        ? 'border-green-500 bg-green-50'
                        : isSelected && !isCorrect
                        ? 'border-red-500 bg-red-50'
                        : isCorrect
                        ? 'border-green-300 bg-green-50/50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <Badge className={isCorrect ? 'bg-green-600' : 'bg-red-600'}>
                          {isCorrect ? 'Selected ✓' : 'Selected ✗'}
                        </Badge>
                      )}
                      {!isSelected && isCorrect && (
                        <Badge variant="outline" className="border-green-500 text-green-700">
                          Correct Answer
                        </Badge>
                      )}
                      <span className="text-gray-800">{choice.choice_text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {question.question_type === 'multiple_select' && (
            <div className="space-y-2">
              {question.choices?.map(choice => {
                let selectedChoices: number[] = [];
                try {
                  selectedChoices = answer.selected_choices ? JSON.parse(answer.selected_choices) : [];
                } catch (e) {
                  selectedChoices = [];
                }
                const isSelected = selectedChoices.includes(choice.id);
                const isCorrect = choice.is_correct;
                return (
                  <div
                    key={choice.id}
                    className={`p-3 rounded-lg border-2 ${
                      isSelected && isCorrect
                        ? 'border-green-500 bg-green-50'
                        : isSelected && !isCorrect
                        ? 'border-red-500 bg-red-50'
                        : !isSelected && isCorrect
                        ? 'border-amber-300 bg-amber-50/50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <Badge className={isCorrect ? 'bg-green-600' : 'bg-red-600'}>
                          {isCorrect ? 'Selected ✓' : 'Wrong ✗'}
                        </Badge>
                      )}
                      {!isSelected && isCorrect && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          Missed
                        </Badge>
                      )}
                      <span className="text-gray-800">{choice.choice_text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {question.question_type === 'true_false' && (
            <div className="space-y-2">
              {['True', 'False'].map(option => {
                const isSelected = answer.answer_text === option;
                const isCorrect = question.correct_answer === option;
                return (
                  <div
                    key={option}
                    className={`p-3 rounded-lg border-2 ${
                      isSelected && isCorrect
                        ? 'border-green-500 bg-green-50'
                        : isSelected && !isCorrect
                        ? 'border-red-500 bg-red-50'
                        : isCorrect
                        ? 'border-green-300 bg-green-50/50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSelected && (
                        <Badge className={isCorrect ? 'bg-green-600' : 'bg-red-600'}>
                          {isCorrect ? 'Selected ✓' : 'Selected ✗'}
                        </Badge>
                      )}
                      {!isSelected && isCorrect && (
                        <Badge variant="outline" className="border-green-500 text-green-700">
                          Correct Answer
                        </Badge>
                      )}
                      <span className="text-gray-800 font-medium">{option}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(question.question_type === 'short_answer' || question.question_type === 'essay' || question.question_type === 'fill_blank') && (
            <div className="p-3 bg-white border border-gray-200 rounded-lg">
              <p className="text-gray-800 whitespace-pre-wrap">{answer.answer_text || 'No answer provided'}</p>
            </div>
          )}

          {question.question_type === 'matching' && (
            <div className="space-y-2">
              {(() => {
                let matchingPairs: { [key: string]: number } = {};
                try {
                  matchingPairs = answer.answer_text ? JSON.parse(answer.answer_text) : {};
                } catch (e) {
                  matchingPairs = {};
                }

                const leftItems: any[] = [];
                const rightItems: any[] = [];
                
                question.choices?.forEach((choice, index) => {
                  const [left, right] = choice.choice_text.split('::');
                  leftItems.push({ index, text: left.trim(), originalIndex: index });
                  rightItems.push({ index, text: right.trim(), originalIndex: index });
                });

                // matching_order stores: displayRightIndex -> originalRightIndex
                const orderForQuestion: number[] = matchingOrderMap[String(question.id)] || [];
                const rightItemsDisplayed = (orderForQuestion.length === rightItems.length)
                  ? orderForQuestion.map((originalIdx, displayIdx) => ({
                      ...rightItems[originalIdx],
                      displayIndex: displayIdx,
                    }))
                  : rightItems.map((item, idx) => ({ ...item, displayIndex: idx }));

                return leftItems.map((leftItem, idx) => {
                  const studentRightDisplayIdx = matchingPairs[idx];
                  const correctRightIdx = leftItem.originalIndex;
                  const studentRightOriginalIdx = orderForQuestion.length === rightItems.length
                    ? orderForQuestion[studentRightDisplayIdx]
                    : studentRightDisplayIdx;
                  const isCorrect = studentRightOriginalIdx === correctRightIdx;
                  const studentAnswer = rightItemsDisplayed.find(r => r.displayIndex === studentRightDisplayIdx);
                  const correctAnswer = rightItems.find(r => r.index === correctRightIdx);

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border-2 ${
                        isCorrect
                          ? 'border-green-500 bg-green-50'
                          : 'border-red-500 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Badge className={isCorrect ? 'bg-green-600' : 'bg-red-600'}>
                          {isCorrect ? '✓' : '✗'}
                        </Badge>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{leftItem.text}</div>
                          <div className="mt-1 text-sm">
                            <span className="text-gray-600">Student matched: </span>
                            <span className={isCorrect ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                              {studentAnswer?.text || 'Not matched'}
                            </span>
                          </div>
                          {!isCorrect && correctAnswer && (
                            <div className="mt-1 text-sm">
                              <span className="text-gray-600">Correct match: </span>
                              <span className="text-green-700 font-medium">{correctAnswer.text}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Correct Answer / Sample Answer */}
        {(question.correct_answer || question.sample_answer) && question.question_type !== 'matching' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Label className="text-sm font-semibold text-blue-700 mb-2 block">
              {question.question_type === 'essay' ? 'Sample Answer:' : 'Correct Answer:'}
            </Label>
            <div 
              className="text-gray-800"
              dangerouslySetInnerHTML={{ __html: question.sample_answer || question.correct_answer || '' }}
            />
          </div>
        )}

        {/* Auto-graded Result */}
        {isAutoGraded && (
          <div className="flex items-center gap-2">
            {answer.is_correct ? (
              <Badge className="bg-green-600 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Correct - {answer.points_earned} / {question.points} points
              </Badge>
            ) : (
              <Badge className="bg-red-600 text-white">
                <XCircle className="h-3 w-3 mr-1" />
                Incorrect - {answer.points_earned || 0} / {question.points} points
              </Badge>
            )}
          </div>
        )}

        {/* Manual Grading */}
        {needsManualGrading && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-4">
            <Label className="text-sm font-semibold text-amber-800">Manual Grading Required</Label>
            
            {/* Quick Mark Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => saveManualGrade(question.id, question.points)}
                disabled={savingGrades.has(key)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Correct ({question.points} pts)
              </Button>
              <Button
                onClick={() => saveManualGrade(question.id, 0)}
                disabled={savingGrades.has(key)}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Mark Incorrect (0 pts)
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-amber-50 px-2 text-gray-500">or enter custom points</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`points-${key}`} className="text-sm text-gray-700">
                  Points (max: {question.points})
                </Label>
                <Input
                  id={`points-${key}`}
                  type="number"
                  min="0"
                  max={question.points}
                  step="0.01"
                  value={manualGrade.points}
                  onChange={(e) => handleManualGrade(question.id, 'points', Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => saveManualGrade(question.id)}
                  disabled={savingGrades.has(key)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                >
                  {savingGrades.has(key) ? (
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

            <div>
              <Label htmlFor={`feedback-${key}`} className="text-sm text-gray-700">
                Feedback (optional)
              </Label>
              <Textarea
                id={`feedback-${key}`}
                value={manualGrade.feedback}
                onChange={(e) => handleManualGrade(question.id, 'feedback', e.target.value)}
                placeholder="Add feedback for the student..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const safeAnswers = Array.isArray(answers) ? answers : [];
  const totalPoints = safeAnswers.reduce((sum, ans) => sum + (Number(ans.points_earned) || 0), 0);
  const maxScore = Number(activity?.max_score || 0);
  const percentage = maxScore > 0 ? Math.round((totalPoints / maxScore) * 100) : 0;

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading quiz submission...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/teacher/courses/${courseId}/activities/${activityId}/review?section_id=${sectionId}`)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to All Submissions
              </Button>

              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg px-6 py-3 border-2 border-blue-200">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-600">Total Score</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {totalPoints.toFixed(2)} / {maxScore}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-600">Percentage</div>
                    <div className="text-2xl font-bold text-gray-900">{percentage}%</div>
                  </div>
                  <Badge className={`${percentage >= 75 ? 'bg-green-600' : percentage >= 50 ? 'bg-amber-600' : 'bg-red-600'}`}>
                    {percentage >= 60 ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Student Info */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                {student?.first_name[0]}{student?.last_name[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {student?.first_name} {student?.last_name}
                </h1>
                <p className="text-sm text-gray-600">
                  {student?.student_id} • Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-0">
              <div className="p-6">
                {/* Question Header */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white">Question {currentQuestionIndex + 1}</Badge>
                      <Badge variant="outline">{currentQuestion?.points} points</Badge>
                      <Badge variant="outline" className="capitalize">
                        {currentQuestion?.question_type?.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div
                    className="text-lg text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: currentQuestion?.question_text || '' }}
                  />
                  {currentQuestion?.image_url && (
                    <img
                      src={currentQuestion.image_url}
                      alt="Question"
                      className="mt-4 max-w-md rounded-lg border shadow-sm"
                    />
                  )}
                </div>

                {/* Student Answer */}
                {renderStudentAnswer(currentQuestion)}

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={isFirstQuestion}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>

                  <span className="text-sm text-gray-600">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>

                  <Button
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    disabled={isLastQuestion}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question Navigator */}
          <Card className="mt-6 border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Question Navigator</h3>
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1">
                {questions.map((q, idx) => {
                  const answer = getStudentAnswer(q.id);
                  const hasAnswer = answer !== undefined;
                  const isCurrent = idx === currentQuestionIndex;
                  const isCorrect = answer?.is_correct;
                  const isGraded = answer?.points_earned !== undefined && answer?.points_earned !== null;
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`
                        aspect-square rounded-lg font-semibold text-xs transition-all flex items-center justify-center
                        ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                        ${hasAnswer && isGraded
                          ? isCorrect || (answer.points_earned && answer.points_earned > 0)
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }
                      `}
                      title={`Question ${idx + 1}${hasAnswer ? ` - ${answer.points_earned || 0}/${q.points} pts` : ''}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
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

export default StudentQuizReview;
