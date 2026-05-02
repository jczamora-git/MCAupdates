import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  ArrowRight,
  Clock, 
  Send,
  CheckCircle2,
  AlertCircle,
  Timer,
  BookOpen,
  Save
} from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  points: number;
  order_num: number;
  image_url?: string;
  choices?: Array<{
    id: number;
    choice_text: string;
    order_num: number;
  }>;
}

interface Activity {
  id: number;
  title: string;
  description: string;
  max_score: number;
  due_at: string;
  type: string;
}

interface QuizSettings {
  time_limit?: number;
  max_attempts?: number;
  shuffle_questions?: boolean;
  shuffle_choices?: boolean;
  show_correct_answers?: boolean;
  pass_threshold?: number;
  section_directions?: Record<string, string>;
  section_word_boxes?: Record<string, string>;
}

interface StudentAnswer {
  question_id: number;
  choice_id?: number;
  answer_text?: string;
  selected_choices?: number[]; // For multiple_select
  matching_pairs?: { [leftIndex: number]: number }; // For matching type
}

const QuizTaker = () => {
  const { courseId, activityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<QuizSettings>({});
  const [answers, setAnswers] = useState<{ [questionId: number]: StudentAnswer }>({});
  const [matchingData, setMatchingData] = useState<{ [questionId: number]: { leftItems: any[]; rightItems: any[] } }>({});
  const [selectedLeftItems, setSelectedLeftItems] = useState<{ [questionId: number]: number | null }>({});
  const [dragState, setDragState] = useState<{ questionId: number; leftIndex: number; mouseX: number; mouseY: number } | null>(null);
  const [blockedLinkHover, setBlockedLinkHover] = useState<{ questionId: number; rightIndex: number; existingLeftIndex: number } | null>(null);
  const [linePositions, setLinePositions] = useState<{ [key: string]: { x1: number; y1: number; x2: number; y2: number } }>({});
  const [errorAnimation, setErrorAnimation] = useState<{ questionId: number } | null>(null);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [unansweredList, setUnansweredList] = useState<number[]>([]);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Always-current snapshot of answers so setInterval/setTimeout closures never go stale
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // ── Build matchingData from a session's matching_order + questions list ──
  const buildMatchingData = (
    qList: Question[],
    matchingOrder: Record<string, number[]>
  ) => {
    const map: typeof matchingData = {};
    qList.forEach((q) => {
      if (q.question_type === 'matching' && q.choices) {
        const rightOrig = q.choices.map((c, i) => {
          const [, right] = c.choice_text.split('::');
          return { index: i, text: right?.trim() ?? '', originalIndex: i };
        });
        const leftItems = q.choices.map((c, i) => {
          const [left] = c.choice_text.split('::');
          return { index: i, text: left?.trim() ?? '', originalIndex: i };
        });
        const order: number[] = matchingOrder[q.id]
          ?? [...Array(q.choices.length).keys()].sort(() => Math.random() - 0.5);
        const rightItems = order.map((origIdx) => rightOrig[origIdx]);
        map[q.id] = { leftItems, rightItems };
      }
    });
    return map;
  };

  // ── Convert raw DB answers → frontend answers map ──
  const buildAnswersFromDB = (rawAnswers: any[], qList: Question[]) => {
    const typeMap: Record<number, string> = {};
    qList.forEach(q => { typeMap[q.id] = q.question_type; });

    const result: typeof answers = {};
    rawAnswers.forEach((row: any) => {
      const qType = typeMap[row.question_id];
      const ans: any = { question_id: row.question_id };
      if (qType === 'multiple_choice') {
        ans.choice_id = row.choice_id ? Number(row.choice_id) : undefined;
      } else if (qType === 'multiple_select') {
        try { ans.selected_choices = row.answer_text ? JSON.parse(row.answer_text) : []; } catch { ans.selected_choices = []; }
      } else if (qType === 'matching') {
        try { ans.matching_pairs = row.answer_text ? JSON.parse(row.answer_text) : {}; } catch { ans.matching_pairs = {}; }
      } else {
        ans.answer_text = row.answer_text ?? '';
      }
      result[row.question_id] = ans;
    });
    return result;
  };

  // Update line positions for matching questions
  useEffect(() => {
    if (!quizStarted || !questions[currentQuestionIndex]) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion.question_type !== 'matching') return;
    
    const updateLinePositions = () => {
      const newPositions: { [key: string]: { x1: number; y1: number; x2: number; y2: number } } = {};
      const gridContainer = document.querySelector('.matching-grid');
      if (!gridContainer) return;
      
      const gridRect = gridContainer.getBoundingClientRect();
      const answer = answers[currentQuestion.id];
      const pairs = answer?.matching_pairs || {};
      
      Object.entries(pairs).forEach(([leftIdx, rightIdx]) => {
        const leftCircle = document.getElementById(`match-left-${currentQuestion.id}-${leftIdx}`);
        const rightCircle = document.getElementById(`match-right-${currentQuestion.id}-${rightIdx}`);
        
        if (leftCircle && rightCircle) {
          const leftRect = leftCircle.getBoundingClientRect();
          const rightRect = rightCircle.getBoundingClientRect();
          
          const x1 = leftRect.left + leftRect.width  / 2 - gridRect.left;
          const y1 = leftRect.top + leftRect.height / 2 - gridRect.top;
          const x2 = rightRect.left + rightRect.width / 2 - gridRect.left;
          const y2 = rightRect.top + rightRect.height / 2 - gridRect.top;
          
          newPositions[`${leftIdx}-${rightIdx}`] = { x1, y1, x2, y2 };
        }
      });
      
      setLinePositions(newPositions);
    };
    
    const timer = setTimeout(updateLinePositions, 50);
    
    // Also update on window resize
    window.addEventListener('resize', updateLinePositions);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateLinePositions);
    };
  }, [answers, currentQuestionIndex, questions, quizStarted]);

  useEffect(() => {
    loadQuizData();
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [activityId]);

  const loadQuizData = async () => {
    try {
      setLoading(true);

      // Fetch activity + settings (needed for the Start Quiz preview screen regardless)
      const [activityRes, settingsRes] = await Promise.all([
        apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}`),
        apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/settings`),
      ]);
      if (activityRes.success && activityRes.data) setActivity(activityRes.data);
      const fetchedSettings: QuizSettings = (settingsRes.success && settingsRes.data) ? settingsRes.data : {};
      setSettings(fetchedSettings);

      // ── Check for an active DB session (survives refresh) ─────────────────
      const sessionRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/quiz/session`);
      const session = sessionRes.success ? sessionRes.data : null;

      if (session) {
        // ── RESUME: load questions and restore session state ──────────────
        const questionsRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions`);
        if (!questionsRes.success) throw new Error('Failed to load questions');

        // Reorder questions according to the session's stored shuffle
        const allQuestions: Question[] = questionsRes.data ?? [];
        const qOrder: number[] = session.question_order ?? allQuestions.map((q: Question) => q.id);
        const qMap: Record<number, Question> = {};
        allQuestions.forEach((q: Question) => { qMap[q.id] = q; });
        const orderedQuestions = qOrder.map((id: number) => qMap[id]).filter(Boolean) as Question[];

        setQuestions(orderedQuestions);
        setMatchingData(buildMatchingData(orderedQuestions, session.matching_order ?? {}));
        setAnswers(buildAnswersFromDB(session.saved_answers ?? [], allQuestions));
        answersRef.current = buildAnswersFromDB(session.saved_answers ?? [], allQuestions);

        if (session.expired) {
          // Time ran out while offline — auto-submit without confirmation
          setQuizStarted(true);
          setLoading(false);
          await handleSubmitQuiz();
          return;
        }

        if (session.seconds_remaining !== null) {
          setTimeRemaining(session.seconds_remaining);
          timerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
              if (prev === null || prev <= 1) { handleSubmitQuiz(); return 0; }
              return prev - 1;
            });
          }, 1000);
        }

        autoSaveTimerRef.current = setInterval(() => { autoSaveAnswers(); }, 30000);
        setQuizStarted(true);
        setLoading(false);
        return;
      }

      // ── FRESH: no session yet — just load questions for the preview count ─
      const questionsRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions`);
      if (questionsRes.success && questionsRes.data) {
        setQuestions(questionsRes.data);
      }

    } catch (error) {
      console.error('Error loading quiz:', error);
      setAlert({ type: 'error', message: 'Failed to load quiz' });
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    try {
      // api_start_quiz creates the session row (with shuffled order stored)
      await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/quiz/start`);

      // Now fetch the persisted session to get question_order & matching_order
      const sessionRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/quiz/session`);
      const session = sessionRes.success ? sessionRes.data : null;

      // Load all questions then reorder per session
      const questionsRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions`);
      const allQuestions: Question[] = questionsRes.success ? (questionsRes.data ?? []) : [];

      const qOrder: number[] = session?.question_order ?? allQuestions.map((q: Question) => q.id);
      const qMap: Record<number, Question> = {};
      allQuestions.forEach((q: Question) => { qMap[q.id] = q; });
      const orderedQuestions = qOrder.map((id: number) => qMap[id]).filter(Boolean) as Question[];

      setQuestions(orderedQuestions);
      setMatchingData(buildMatchingData(orderedQuestions, session?.matching_order ?? {}));
      setAnswers({});

      setQuizStarted(true);

      // Start countdown timer if the session has an expiry
      if (session?.seconds_remaining !== null && session?.seconds_remaining > 0) {
        setTimeRemaining(session.seconds_remaining);
        timerRef.current = setInterval(() => {
          setTimeRemaining((prev) => {
            if (prev === null || prev <= 1) { handleSubmitQuiz(); return 0; }
            return prev - 1;
          });
        }, 1000);
      } else if (session?.seconds_remaining === 0) {
        await handleSubmitQuiz();
        return;
      }

      autoSaveTimerRef.current = setInterval(() => { autoSaveAnswers(); }, 30000);

    } catch (error) {
      console.error('Error starting quiz:', error);
      setAlert({ type: 'error', message: 'Failed to start quiz' });
    }
  };

  const autoSaveAnswers = async () => {
    const currentAnswers = answersRef.current;
    if (Object.keys(currentAnswers).length === 0) return;

    try {
      setAutoSaveStatus('saving');
      
      for (const [questionId, answer] of Object.entries(currentAnswers)) {
        await apiPost(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/quiz/save-answer`, {
          question_id: Number(questionId),
          choice_id: answer.choice_id,
          answer_text: answer.answer_text,
          selected_choices: answer.selected_choices,
          matching_pairs: answer.matching_pairs
        });
      }

      setAutoSaveStatus('saved');
    } catch (error) {
      console.error('Auto-save error:', error);
      setAutoSaveStatus('unsaved');
    }
  };

  const handleAnswerChange = (questionId: number, answer: Partial<StudentAnswer>) => {
    setAnswers(prev => {
      const updated = {
        ...prev,
        [questionId]: { question_id: questionId, ...prev[questionId], ...answer }
      };
      answersRef.current = updated;
      return updated;
    });
    setAutoSaveStatus('unsaved');

    // Debounced backend save — fires 5 s after last keystroke/tap
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => { autoSaveAnswers(); }, 5000);
  };

  const openSubmitModal = () => {
    const unanswered = questions
      .map((q, idx) => ({ idx, q }))
      .filter(({ q }) => {
        const a = answers[q.id];
        if (!a) return true;
        if (q.question_type === 'multiple_choice') return !a.choice_id;
        if (q.question_type === 'multiple_select') return !a.selected_choices?.length;
        if (q.question_type === 'matching') return Object.keys(a.matching_pairs || {}).length < (matchingData[q.id]?.leftItems.length ?? 1);
        return !a.answer_text?.trim();
      })
      .map(({ idx }) => idx + 1);
    setUnansweredList(unanswered);
    setSubmitModalOpen(true);
  };

  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);

      // Clear all timers
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);

      // (Session is marked submitted by the backend via api_submit_quiz)

      // Submit quiz
      const res = await apiPost(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/quiz/submit`, {
        answers: Object.values(answers)
      });

      if (res.success) {
        setQuizSubmitted(true);
        setAlert({ type: 'success', message: 'Quiz submitted successfully!' });
      } else {
        setAlert({ type: 'error', message: res.message || 'Failed to submit quiz' });
      }

    } catch (error) {
      console.error('Submit error:', error);
      setAlert({ type: 'error', message: 'Error submitting quiz' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionInput = (question: Question) => {
    const answer = answers[question.id];

    switch (question.question_type) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {question.choices?.map((choice) => (
              <div
                key={choice.id}
                onClick={() => handleAnswerChange(question.id, { choice_id: choice.id })}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  answer?.choice_id === choice.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      answer?.choice_id === choice.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {answer?.choice_id === choice.id && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="text-gray-800">{choice.choice_text}</span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'multiple_select':
        return (
          <div className="space-y-3">
            {question.choices?.map((choice) => {
              const isSelected = answer?.selected_choices?.includes(choice.id) || false;
              return (
                <div
                  key={choice.id}
                  onClick={() => {
                    const currentSelections = answer?.selected_choices || [];
                    const newSelections = isSelected
                      ? currentSelections.filter(id => id !== choice.id)
                      : [...currentSelections, choice.id];
                    handleAnswerChange(question.id, { selected_choices: newSelections });
                  }}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isSelected} />
                    <span className="text-gray-800">{choice.choice_text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'true_false':
        return (
          <div className="space-y-3">
            {['True', 'False'].map((option) => (
              <div
                key={option}
                onClick={() => handleAnswerChange(question.id, { answer_text: option })}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  answer?.answer_text === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      answer?.answer_text === option
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {answer?.answer_text === option && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="text-gray-800 font-medium">{option}</span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'short_answer':
        return (
          <Input
            value={answer?.answer_text || ''}
            onChange={(e) => handleAnswerChange(question.id, { answer_text: e.target.value })}
            placeholder="Type your answer here..."
            className="w-full"
          />
        );

      case 'essay':
        return (
          <Textarea
            value={answer?.answer_text || ''}
            onChange={(e) => handleAnswerChange(question.id, { answer_text: e.target.value })}
            placeholder="Write your essay answer here..."
            rows={10}
            className="w-full resize-none"
          />
        );

      case 'matching':
        const matchData = matchingData[question.id];
        if (!matchData) return <p className="text-gray-500">Loading matching question...</p>;
        
        const pairs = answer?.matching_pairs || {};
        const colors = [
          { bg: 'bg-green-100', border: 'border-green-500', line: '#10b981', text: 'text-green-700' },
          { bg: 'bg-blue-100', border: 'border-blue-500', line: '#3b82f6', text: 'text-blue-700' },
          { bg: 'bg-purple-100', border: 'border-purple-500', line: '#a855f7', text: 'text-purple-700' },
          { bg: 'bg-pink-100', border: 'border-pink-500', line: '#ec4899', text: 'text-pink-700' },
          { bg: 'bg-orange-100', border: 'border-orange-500', line: '#f97316', text: 'text-orange-700' },
          { bg: 'bg-cyan-100', border: 'border-cyan-500', line: '#06b6d4', text: 'text-cyan-700' },
          { bg: 'bg-amber-100', border: 'border-amber-500', line: '#f59e0b', text: 'text-amber-700' },
          { bg: 'bg-rose-100', border: 'border-rose-500', line: '#f43f5e', text: 'text-rose-700' },
        ];
        
        const selectedLeft = selectedLeftItems[question.id] || null;
        
        const handleDragStart = (leftIndex: number, e: React.MouseEvent) => {
          const gridContainer = e.currentTarget.closest('.matching-grid');
          if (!gridContainer) return;
          
          const gridRect = gridContainer.getBoundingClientRect();
          
          setDragState({
            questionId: question.id,
            leftIndex,
            mouseX: e.clientX - gridRect.left,
            mouseY: e.clientY - gridRect.top
          });
          setBlockedLinkHover(null);
        };
        
        const handleDragMove = (e: React.MouseEvent) => {
          if (dragState && dragState.questionId === question.id) {
            const gridContainer = document.querySelector('.matching-grid');
            if (!gridContainer) return;
            
            const gridRect = gridContainer.getBoundingClientRect();
            setDragState({
              ...dragState,
              mouseX: e.clientX - gridRect.left,
              mouseY: e.clientY - gridRect.top
            });
          }
        };
        
        const handleDragEnd = (rightIndex?: number) => {
          if (dragState && dragState.questionId === question.id) {
            if (rightIndex !== undefined) {
              // Check if this right item is already matched to a DIFFERENT left item
              const existingLeftIndex = Object.keys(pairs).find(k => pairs[parseInt(k)] === rightIndex);
              
              if (existingLeftIndex !== undefined && parseInt(existingLeftIndex) !== dragState.leftIndex) {
                // Show error animation instead of linking
                setErrorAnimation({ questionId: question.id });
                setTimeout(() => setErrorAnimation(null), 600);
                setBlockedLinkHover(null);
                setDragState(null);
                return;
              }
              
              const newPairs = { ...pairs };
              
              // Remove any existing match for this left item
              if (newPairs[dragState.leftIndex] !== undefined) {
                delete newPairs[dragState.leftIndex];
              }
              
              // Add new match
              newPairs[dragState.leftIndex] = rightIndex;
              
              handleAnswerChange(question.id, { matching_pairs: newPairs });
            }
            
            setBlockedLinkHover(null);
            setDragState(null);
          }
        };
        
        const getColorForPair = (leftIndex: number) => {
          const pairIndex = Object.keys(pairs).indexOf(String(leftIndex));
          return colors[pairIndex % colors.length];
        };
        
        const handleUnlinkPair = (rightIndex: number, e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Find the left index that's matched to this right index
          const leftIndex = Object.keys(pairs).find(k => pairs[parseInt(k)] === rightIndex);
          if (leftIndex === undefined) return;
          
          const leftIndexNum = parseInt(leftIndex);
          
          // Get the circle position to start dragging from it
          const leftCircle = document.getElementById(`match-left-${question.id}-${leftIndexNum}`);
          if (!leftCircle) return;
          
          const gridContainer = e.currentTarget.closest('.matching-grid');
          if (!gridContainer) return;
          
          const gridRect = gridContainer.getBoundingClientRect();
          
          // Remove the pairing
          const newPairs = { ...pairs };
          delete newPairs[leftIndexNum];
          handleAnswerChange(question.id, { matching_pairs: newPairs });
          
          // Start dragging from the left item
          setDragState({
            questionId: question.id,
            leftIndex: leftIndexNum,
            mouseX: e.clientX - gridRect.left,
            mouseY: e.clientY - gridRect.top
          });
        };
        
        return (
          <div 
            className={`space-y-4 matching-container relative select-none transition-all ${
              errorAnimation?.questionId === question.id 
                ? 'animate-shake ring-4 ring-red-500 ring-opacity-50 rounded-lg' 
                : ''
            }`}
            onMouseMove={handleDragMove}
            onMouseUp={() => handleDragEnd()}
            onMouseLeave={() => { setDragState(null); setBlockedLinkHover(null); }}
            style={{ userSelect: 'none' }}
          >
            <p className="text-sm text-gray-600 mb-4">Click and drag from a circle on the left to a circle on the right to create matches. Click on a matched circle on the right to unlink and re-match.</p>
            
            <div className="matching-grid grid grid-cols-[1fr_auto_1fr] gap-4 relative items-start">
              {/* Left Column */}
              <div className="space-y-3">
                {matchData.leftItems.map((item, idx) => {
                  const isMatched = pairs[idx] !== undefined;
                  const color = isMatched ? getColorForPair(idx) : null;
                  const isConflictLinkedLeft = blockedLinkHover?.questionId === question.id && blockedLinkHover.existingLeftIndex === idx;
                  const isDraggingConflictSource = blockedLinkHover?.questionId === question.id && dragState?.leftIndex === idx;
                  
                  return (
                    <div
                      key={idx}
                      className={`
                        relative w-full px-4 py-3 rounded-xl text-left font-medium transition-all
                        border-2 flex items-center justify-between
                        ${
                          isConflictLinkedLeft || isDraggingConflictSource
                            ? 'bg-red-100 border-red-500'
                            : isMatched
                            ? `${color?.bg} ${color?.border}`
                            : 'bg-white border-gray-200'
                        }
                      `}
                    >
                      <span className={isConflictLinkedLeft || isDraggingConflictSource ? 'text-red-700' : (isMatched ? color?.text : '')}>{item.text}</span>
                      <div
                        id={`match-left-${question.id}-${idx}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleDragStart(idx, e);
                        }}
                        className={`
                          w-6 h-6 rounded-full border-3 cursor-grab active:cursor-grabbing
                          flex items-center justify-center transition-all flex-shrink-0 ml-2
                          ${isConflictLinkedLeft || isDraggingConflictSource ? 'border-red-500 bg-white' : (isMatched ? `${color?.border} bg-white` : 'border-gray-400 bg-white hover:border-blue-500')}
                        `}
                        style={{ borderWidth: '3px' }}
                      >
                        <div className={`w-3 h-3 rounded-full ${isConflictLinkedLeft || isDraggingConflictSource ? 'bg-red-500' : (isMatched ? color?.border.replace('border-', 'bg-') : '')}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Center Gap */}
              <div className="w-16" style={{ pointerEvents: 'none' }} />
              
              {/* Right Column */}
              <div className="space-y-3">
                {matchData.rightItems.map((item, idx) => {
                  const leftIndex = Object.keys(pairs).find(k => pairs[parseInt(k)] === idx);
                  const isMatched = leftIndex !== undefined;
                  const color = isMatched ? getColorForPair(parseInt(leftIndex)) : null;
                  const isConflictRight = blockedLinkHover?.questionId === question.id && blockedLinkHover.rightIndex === idx;
                  
                  return (
                    <div
                      key={idx}
                      className={`
                        relative w-full px-4 py-3 rounded-xl text-left font-medium transition-all
                        border-2 flex items-center justify-between
                        ${
                          isConflictRight
                            ? 'bg-red-100 border-red-500'
                            : isMatched
                            ? `${color?.bg} ${color?.border}`
                            : dragState && dragState.questionId === question.id
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200'
                        }
                      `}
                    >
                      <div
                        id={`match-right-${question.id}-${idx}`}
                        onMouseUp={(e) => {
                          e.preventDefault();
                          handleDragEnd(idx);
                        }}
                        onMouseDown={(e) => {
                          if (isMatched) {
                            handleUnlinkPair(idx, e);
                          }
                        }}
                        onMouseEnter={() => {
                          if (!dragState || dragState.questionId !== question.id) return;
                          if (!isMatched || leftIndex === undefined) {
                            setBlockedLinkHover(null);
                            return;
                          }
                          const existingLeftNum = parseInt(leftIndex);
                          if (existingLeftNum !== dragState.leftIndex) {
                            setBlockedLinkHover({ questionId: question.id, rightIndex: idx, existingLeftIndex: existingLeftNum });
                          } else {
                            setBlockedLinkHover(null);
                          }
                        }}
                        onMouseLeave={() => {
                          if (blockedLinkHover?.questionId === question.id && blockedLinkHover.rightIndex === idx) {
                            setBlockedLinkHover(null);
                          }
                        }}
                        className={`
                          w-6 h-6 rounded-full border-3 transition-all
                          flex items-center justify-center flex-shrink-0 mr-2
                          ${isConflictRight ? 'border-red-500 bg-white ring-2 ring-red-400 ring-offset-1' : (isMatched ? `${color?.border} bg-white cursor-pointer hover:scale-110 hover:ring-2 hover:ring-offset-1 ${color?.border.replace('border-', 'hover:ring-')}` : 'border-gray-400 bg-white')}
                          ${dragState && dragState.questionId === question.id && !isConflictRight ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
                        `}
                        style={{ borderWidth: '3px' }}
                      >
                        <div className={`w-3 h-3 rounded-full ${isConflictRight ? 'bg-red-500' : (isMatched ? color?.border.replace('border-', 'bg-') : '')}`} />
                      </div>
                      <span className={isConflictRight ? 'text-red-700' : (isMatched ? color?.text : '')}>{item.text}</span>
                    </div>
                  );
                })}
              </div>
              
              {/* SVG Overlay for lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
                {/* Draw existing matches using cached positions */}
                {Object.entries(linePositions).map(([key, pos]) => {
                  const [leftIdx, rightIdx] = key.split('-').map(Number);
                  
                  // Only draw if this pair still exists
                  if (pairs[leftIdx] !== rightIdx) return null;
                  
                  const color = getColorForPair(leftIdx);
                  if (!color) return null;
                  const isConflictLine = blockedLinkHover?.questionId === question.id
                    && blockedLinkHover.existingLeftIndex === leftIdx
                    && blockedLinkHover.rightIndex === rightIdx;
                  
                  return (
                    <line
                      key={`line-${key}`}
                      x1={pos.x1}
                      y1={pos.y1}
                      x2={pos.x2}
                      y2={pos.y2}
                      stroke={isConflictLine ? '#ef4444' : color.line}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  );
                })}
                
                {/* Draw dragging line */}
                {dragState && dragState.questionId === question.id && (() => {
                  const leftCircle = document.getElementById(`match-left-${question.id}-${dragState.leftIndex}`);
                  if (leftCircle) {
                    const gridContainer = document.querySelector('.matching-grid');
                    if (!gridContainer) return null;
                    
                    const gridRect = gridContainer.getBoundingClientRect();
                    const leftRect = leftCircle.getBoundingClientRect();
                    
                    const x1 = leftRect.left + leftRect.width / 2 - gridRect.left;
                    const y1 = leftRect.top + leftRect.height / 2 - gridRect.top;

                    return (
                      <line
                        x1={x1}
                        y1={y1}
                        x2={dragState.mouseX}
                        y2={dragState.mouseY}
                        stroke={blockedLinkHover?.questionId === question.id ? '#ef4444' : '#3b82f6'}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="8,4"
                        opacity="0.7"
                      />
                    );
                  }
                  return null;
                })()}
              </svg>
            </div>
            
            {Object.keys(pairs).length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  Matches: {Object.keys(pairs).length} / {matchData.leftItems.length}
                </p>
              </div>
            )}
          </div>
        );

      case 'fill_blank':
        return (
          <div className="space-y-3">
            <Textarea
              value={answer?.answer_text || ''}
              onChange={(e) => handleAnswerChange(question.id, { answer_text: e.target.value })}
              placeholder="Fill in the blanks (separate multiple answers with commas)..."
              rows={4}
              className="w-full resize-none"
            />
          </div>
        );

      default:
        return <p className="text-gray-500">Unknown question type</p>;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  // Section/grouping helpers — derived from the loaded questions order
  const toRoman = (n: number): string => {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
    let result = ''; let num = n;
    for (let i = 0; i < vals.length; i++) while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
    return result;
  };
  const TYPE_LABELS: Record<string, string> = {
    multiple_choice: 'Multiple Choice', multiple_select: 'Multiple Select',
    true_false: 'True / False', short_answer: 'Short Answer',
    fill_blank: 'Fill in the Blank', matching: 'Matching', essay: 'Essay',
  };
  // Unique types in the order they first appear in the (possibly shuffled) question list
  const sectionTypes = questions.reduce((acc: string[], q) => {
    if (!acc.includes(q.question_type)) acc.push(q.question_type);
    return acc;
  }, []);
  const currentSectionIdx = currentQuestion ? sectionTypes.indexOf(currentQuestion.question_type) : -1;
  const currentDirection = currentQuestion ? (settings.section_directions?.[currentQuestion.question_type] ?? '') : '';
  const currentWordBox = currentQuestion?.question_type === 'fill_blank'
    ? (settings.section_word_boxes?.['fill_blank'] ?? '')
    : '';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading quiz...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (quizSubmitted) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
          <Card className="max-w-2xl w-full border-0 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-8 py-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-9 w-9 text-white" />
              </div>
              <h2 className="text-3xl font-bold">Quiz Submitted!</h2>
              <p className="text-green-100 mt-2">
                Your answers are safely recorded.
              </p>
            </div>

            <CardContent className="p-8">
              <p className="text-gray-600 text-center mb-6">
                Your teacher will review your responses and publish your score.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Questions Answered</div>
                  <div className="mt-1 text-2xl font-bold text-blue-800">{answeredCount} / {questions.length}</div>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Possible Quiz Points</div>
                  <div className="mt-1 text-2xl font-bold text-purple-800">{activity?.max_score}</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 text-center">
                  This is the quiz&apos;s maximum possible points, not your final score yet.
                </p>
              </div>

              <div className="flex justify-center mt-7">
                <Button
                  onClick={() => navigate(`/student/courses/${courseId}`)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Course
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!quizStarted) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6">
          <Card className="max-w-3xl w-full border-0 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8">
              <CardTitle className="text-3xl font-bold">{activity?.title}</CardTitle>
              <p className="text-blue-100 mt-2">Ready to begin?</p>
            </CardHeader>
            <CardContent className="p-8">
              {activity?.description && (
                <div
                  className="prose max-w-none mb-6 text-gray-700"
                  dangerouslySetInnerHTML={{ __html: activity.description }}
                />
              )}

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-600 font-semibold">Total Questions</div>
                  <div className="text-2xl font-bold text-blue-700">{questions.length}</div>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-sm text-purple-600 font-semibold">Total Points</div>
                  <div className="text-2xl font-bold text-purple-700">{activity?.max_score}</div>
                </div>
                {settings.time_limit && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-sm text-amber-600 font-semibold">Time Limit</div>
                    <div className="text-2xl font-bold text-amber-700">{settings.time_limit} mins</div>
                  </div>
                )}
                {settings.max_attempts && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm text-green-600 font-semibold">Attempts Allowed</div>
                    <div className="text-2xl font-bold text-green-700">{settings.max_attempts}</div>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Your answers will be auto-saved every 30 seconds</li>
                      <li>Once submitted, you cannot change your answers</li>
                      {settings.time_limit && <li>The quiz will auto-submit when time runs out</li>}
                    </ul>
                  </div>
                </div>
              </div>

              <Button
                onClick={startQuiz}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-6 text-lg"
              >
                <BookOpen className="h-5 w-5 mr-2" />
                Start Quiz
              </Button>
            </CardContent>
          </Card>
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{activity?.title}</h1>
                <p className="text-sm text-gray-600">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {timeRemaining !== null && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    <Timer className="h-4 w-4" />
                    <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
                  </div>
                )}

                <Badge variant={autoSaveStatus === 'saved' ? 'default' : 'secondary'}>
                  {autoSaveStatus === 'saved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {autoSaveStatus === 'saving' && <Save className="h-3 w-3 mr-1 animate-spin" />}
                  {autoSaveStatus === 'saved' ? 'Saved' : autoSaveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
                </Badge>

                <Badge className="bg-green-100 text-green-700">
                  {answeredCount} / {questions.length} Answered
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
              {/* Section banner */}
              {currentSectionIdx >= 0 && (
                <div className="mb-3 pb-3 border-b border-blue-200">
                  <p className="text-sm font-bold text-blue-700">
                    {toRoman(currentSectionIdx + 1)}. {TYPE_LABELS[currentQuestion?.question_type] ?? currentQuestion?.question_type}
                  </p>
                  {currentDirection && (
                    <p className="text-sm text-gray-600 mt-0.5 italic">{currentDirection}</p>
                  )}
                  {currentWordBox && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs font-semibold text-amber-700">Word Box:</span>
                      {currentWordBox.split(',').map(w => w.trim()).filter(Boolean).map((word, wi) => (
                        <span key={wi} className="inline-block text-xs px-2 py-0.5 rounded border border-amber-300 bg-white text-amber-800 font-medium">
                          {word}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600 text-white">
                      {currentQuestion?.question_type?.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline">{currentQuestion?.points} points</Badge>
                  </div>
                  <div
                    className="text-lg text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: currentQuestion?.question_text || '' }}
                  />
                </div>
              </div>
              {currentQuestion?.image_url && (
                <img
                  src={currentQuestion.image_url}
                  alt="Question"
                  className="mt-4 max-w-md rounded-lg border shadow-sm"
                />
              )}
            </CardHeader>

            <CardContent className="p-8">
              {renderQuestionInput(currentQuestion)}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIndex === 0}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>

                {isLastQuestion ? (
                  <Button
                    onClick={openSubmitModal}
                    disabled={submitting}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Quiz
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Question Navigator */}
          <Card className="mt-6 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-sm">Question Navigator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-15 gap-1">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isCurrent = idx === currentQuestionIndex;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`
                        aspect-square rounded-lg font-semibold text-xs transition-all flex items-center justify-center
                        ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                        ${isAnswered 
                          ? 'bg-green-500 text-white hover:bg-green-600' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }
                      `}
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

        {/* Submit Confirmation Modal */}
        <AlertDialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit Quiz?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  {unansweredList.length === 0 ? (
                    <p>All <span className="font-semibold text-green-700">{questions.length} questions</span> are answered. Once submitted you cannot change your answers.</p>
                  ) : (
                    <>
                      <p>
                        You have <span className="font-semibold text-red-600">{unansweredList.length} unanswered question{unansweredList.length !== 1 ? 's' : ''}</span> out of {questions.length}.
                        You can still go back and answer them.
                      </p>
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs font-semibold text-red-700 mb-1.5">Unanswered questions:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {unansweredList.map(num => (
                            <button
                              key={num}
                              onClick={() => {
                                setSubmitModalOpen(false);
                                setCurrentQuestionIndex(num - 1);
                              }}
                              className="w-7 h-7 rounded bg-red-100 border border-red-300 text-red-700 text-xs font-bold hover:bg-red-200 transition-colors"
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-red-500 mt-1.5">Click a number to jump to that question.</p>
                      </div>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { setSubmitModalOpen(false); handleSubmitQuiz(); }}
                className={unansweredList.length > 0 ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600' : 'bg-green-600 hover:bg-green-700 focus:ring-green-600'}
              >
                {unansweredList.length > 0 ? 'Submit Anyway' : 'Submit Quiz'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default QuizTaker;
