import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  GripVertical, 
  Settings, 
  CheckCircle2, 
  Circle,
  FileText,
  Upload,
  Clock,
  Shuffle,
  Eye,
  Award,
  Calendar,
  Save,
  X,
  Download
} from "lucide-react";
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { API_ENDPOINTS, apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { AlertMessage } from "@/components/AlertMessage";
import { useAuth } from "@/hooks/useAuth";

// Types
type QuestionType = 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay' | 'matching' | 'fill_blank';

interface Choice {
  id: string;
  text: string;
  is_correct: boolean;
}

interface Question {
  id?: number;
  activity_id?: number;
  question_type: QuestionType;
  question_text: string;
  points: number;
  order_num: number;
  image_url?: string;
  choices?: Choice[];
  correct_answer?: string; // For true/false and short answer
  sample_answer?: string; // For short answer and essay
}

interface QuizSettings {
  time_limit?: number; // minutes
  max_attempts?: number;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  show_correct_answers: boolean;
  pass_threshold?: number; // percentage
  available_from?: string;
  available_until?: string;
  section_directions?: Record<string, string>;
  section_word_boxes?: Record<string, string>;
}

// Sortable Question Item Component
interface SortableQuestionItemProps {
  question: Question;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  getQuestionTypeLabel: (type: QuestionType) => string;
}

const SortableQuestionItem = ({ question, index, onEdit, onDelete, getQuestionTypeLabel }: SortableQuestionItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id || 0 });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 text-gray-400 cursor-move"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                Question {index + 1}
              </Badge>
              <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                {getQuestionTypeLabel(question.question_type)}
              </Badge>
              <span className="text-sm font-medium text-gray-600">{question.points} pts</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onEdit}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div dangerouslySetInnerHTML={{ __html: question.question_text }} className="text-gray-900" />
            {question.image_url && (
              <div className="mt-2">
                <img src={question.image_url} alt="Question" className="max-w-xs rounded" />
              </div>
            )}
            {(question.question_type === 'multiple_choice' || question.question_type === 'multiple_select') && question.choices && (
              <div className="ml-4 space-y-1">
                {question.choices.map((choice, i) => (
                  <div key={choice.id} className="flex items-center gap-2 text-sm">
                    {choice.is_correct ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-300" />
                    )}
                    <span className={choice.is_correct ? 'font-medium text-green-700' : 'text-gray-600'}>
                      {String.fromCharCode(65 + i)}. {choice.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {question.question_type === 'true_false' && question.correct_answer && (
              <div className="ml-4 text-sm">
                <span className="text-gray-600">Correct answer: </span>
                <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
                  {question.correct_answer}
                </Badge>
              </div>
            )}
            {question.question_type === 'short_answer' && question.correct_answer && (
              <div className="ml-4 text-sm">
                <span className="text-gray-600">Correct answer: </span>
                <span className="font-medium text-green-700">{question.correct_answer}</span>
              </div>
            )}
            {question.question_type === 'fill_blank' && question.sample_answer && (
              <div className="ml-4 text-sm">
                <span className="text-gray-600">Accepted answers: </span>
                <span className="font-medium text-green-700">{question.sample_answer}</span>
                <span className="text-xs text-gray-500 ml-2">(separate multiple answers with comma)</span>
              </div>
            )}
            {(question.question_type === 'essay' || (question.question_type === 'short_answer' && question.sample_answer)) && question.sample_answer && (
              <div className="ml-4 text-sm">
                <span className="text-gray-600">Sample answer: </span>
                <div
                  className="text-gray-700 italic inline"
                  dangerouslySetInnerHTML={{
                    __html: question.sample_answer.length > 100
                      ? question.sample_answer.substring(0, 100) + '...'
                      : question.sample_answer
                  }}
                />
              </div>
            )}
            {question.question_type === 'matching' && question.choices && (
              <div className="ml-4 space-y-1">
                {question.choices.map((choice, i) => {
                  const [left, right] = choice.text.split('::');
                  return (
                    <div key={choice.id} className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{i + 1}. {left}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium">{right}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuizBuilder = () => {
  const { courseId, activityId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  // Activity data
  const [activity, setActivity] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    shuffle_questions: false,
    shuffle_choices: false,
    show_correct_answers: true,
    max_attempts: 1,
  });

  // UI state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Question form state
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [questionPoints, setQuestionPoints] = useState('1');
  const [questionImage, setQuestionImage] = useState('');
  const [choices, setChoices] = useState<Choice[]>([
    { id: '1', text: '', is_correct: false },
    { id: '2', text: '', is_correct: false },
  ]);
  const [correctAnswer, setCorrectAnswer] = useState(''); // For true/false, short answer
  const [sampleAnswer, setSampleAnswer] = useState(''); // For essay/short answer

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    fetchActivityData();
    fetchQuestions();
    fetchQuizSettings();
  }, [isAuthenticated, activityId]);

  const fetchActivityData = async () => {
    try {
      const res = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}`);
      if (res && res.success) {
        setActivity(res.data);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions`);
      if (res && res.success) {
        // Transform backend data to match frontend structure
        const transformedQuestions = (res.data || []).map((q: any) => ({
          ...q,
          order_num: q.order_number,
          correct_answer: q.correct_answer || '',
          sample_answer: q.sample_answer || '',
          choices: q.choices?.map((c: any) => ({
            id: c.id,
            text: c.choice_text,
            is_correct: Boolean(c.is_correct)
          }))
        }));
        setQuestions(transformedQuestions);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const fetchQuizSettings = async () => {
    try {
      const res = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/settings`);
      if (res && res.success && res.data) {
        setQuizSettings(res.data);
      }
    } catch (error) {
      console.error('Error fetching quiz settings:', error);
    }
  };

  const resetQuestionForm = () => {
    setQuestionType('multiple_choice');
    setQuestionText('');
    setQuestionPoints('1');
    setQuestionImage('');
    setChoices([
      { id: '1', text: '', is_correct: false },
      { id: '2', text: '', is_correct: false },
    ]);
    setCorrectAnswer('');
    setSampleAnswer('');
    setEditingQuestionIndex(null);
  };

  const openAddQuestion = (preset: QuestionType = 'multiple_choice') => {
    resetQuestionForm();
    setQuestionType(preset);
    setIsAddingQuestion(true);
  };

  const openEditQuestion = (index: number) => {
    const question = questions[index];
    setQuestionType(question.question_type);
    setQuestionText(question.question_text);
    setQuestionPoints(String(question.points));
    setQuestionImage(question.image_url || '');
    
    if (question.question_type === 'multiple_choice' || question.question_type === 'multiple_select' || question.question_type === 'matching') {
      setChoices(question.choices || []);
    } else if (question.question_type === 'true_false' || question.question_type === 'short_answer') {
      setCorrectAnswer(question.correct_answer || '');
    } else if (question.question_type === 'fill_blank') {
      setSampleAnswer(question.sample_answer || ''); // Load from sample_answer for fill_blank
    }
    
    if (question.question_type === 'short_answer' || question.question_type === 'essay') {
      setSampleAnswer(question.sample_answer || '');
    }
    
    setEditingQuestionIndex(index);
    setIsAddingQuestion(true);
  };

  const saveQuestion = async () => {
    if (!questionText.trim()) {
      setAlert({ type: 'error', message: 'Question text is required' });
      return;
    }

    if (!questionPoints || Number(questionPoints) <= 0) {
      setAlert({ type: 'error', message: 'Points must be greater than 0' });
      return;
    }

    // Validate based on question type
    if (questionType === 'multiple_choice' || questionType === 'multiple_select') {
      const validChoices = choices.filter(c => c.text.trim());
      if (validChoices.length < 2) {
        setAlert({ type: 'error', message: 'At least 2 choices are required' });
        return;
      }
      const hasCorrect = choices.some(c => c.is_correct);
      if (!hasCorrect) {
        setAlert({ type: 'error', message: 'Please mark at least one correct answer' });
        return;
      }
    } else if (questionType === 'true_false') {
      if (!correctAnswer) {
        setAlert({ type: 'error', message: 'Please select the correct answer (True or False)' });
        return;
      }
    }

    const questionData: Question = {
      activity_id: Number(activityId),
      question_type: questionType,
      question_text: questionText,
      points: Number(questionPoints),
      order_num: editingQuestionIndex !== null ? questions[editingQuestionIndex].order_num : questions.length + 1,
      image_url: questionImage || undefined,
    };

    // Add type-specific data
    if (questionType === 'multiple_choice' || questionType === 'multiple_select' || questionType === 'matching') {
      questionData.choices = choices.filter(c => c.text.trim());
    } else if (questionType === 'true_false' || questionType === 'short_answer') {
      questionData.correct_answer = correctAnswer;
    } else if (questionType === 'fill_blank') {
      questionData.sample_answer = sampleAnswer; // Store multiple answers here
    }
    
    if (questionType === 'short_answer' || questionType === 'essay') {
      questionData.sample_answer = sampleAnswer;
    }

    // Transform frontend data to backend format
    const backendData: any = {
      activity_id: questionData.activity_id,
      question_type: questionData.question_type,
      question_text: questionData.question_text,
      points: questionData.points,
      order_number: questionData.order_num,
      image_url: questionData.image_url,
      correct_answer: questionData.correct_answer || null,
      sample_answer: questionData.sample_answer || null,
    };

    // Add choices for multiple choice/select/matching
    if (questionData.choices) {
      backendData.choices = questionData.choices.map(c => ({
        text: c.text,
        is_correct: c.is_correct || false
      }));
    }

    setIsSaving(true);
    try {
      let res;
      if (editingQuestionIndex !== null && questions[editingQuestionIndex].id) {
        // Update existing question
        res = await apiPut(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions/${questions[editingQuestionIndex].id}`, backendData);
      } else {
        // Create new question
        res = await apiPost(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions`, backendData);
      }

      if (res && res.success) {
        setAlert({ type: 'success', message: editingQuestionIndex !== null ? 'Question updated' : 'Question added' });
        await fetchQuestions();
        
        // Update activity max_score if returned from backend
        if (res.activity_total_points !== undefined && activity) {
          setActivity({ ...activity, max_score: res.activity_total_points });
        }
        
        setIsAddingQuestion(false);
        resetQuestionForm();
      } else {
        setAlert({ type: 'error', message: res?.message || 'Failed to save question' });
      }
    } catch (error: any) {
      setAlert({ type: 'error', message: error.message || 'Error saving question' });
    } finally {
      setIsSaving(false);
    }
  };

  const promptDeleteQuestion = (question: Question) => {
    setDeleteTarget(question);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const question = deleteTarget;
    setIsDeleting(true);
    try {
      if (!question.id) {
        setQuestions(prev => prev.filter(q => q !== question));
        setAlert({ type: 'success', message: 'Question deleted' });
        return;
      }
      const res = await apiDelete(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions/${question.id}`);
      if (res && res.success) {
        setAlert({ type: 'success', message: 'Question deleted' });
        await fetchQuestions();
        if (res.activity_total_points !== undefined && activity) {
          setActivity({ ...activity, max_score: res.activity_total_points });
        }
      } else {
        setAlert({ type: 'error', message: 'Failed to delete question' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Error deleting question' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const addChoice = () => {
    setChoices([...choices, { id: String(Date.now()), text: '', is_correct: false }]);
  };

  const removeChoice = (id: string) => {
    if (choices.length <= 2) {
      setAlert({ type: 'error', message: 'At least 2 choices are required' });
      return;
    }
    setChoices(choices.filter(c => c.id !== id));
  };

  const updateChoice = (id: string, text: string) => {
    setChoices(choices.map(c => c.id === id ? { ...c, text } : c));
  };

  const toggleCorrectChoice = (id: string) => {
    if (questionType === 'multiple_choice') {
      // Single selection - only one can be correct
      setChoices(choices.map(c => ({ ...c, is_correct: c.id === id })));
    } else {
      // Multiple selection - toggle
      setChoices(choices.map(c => c.id === id ? { ...c, is_correct: !c.is_correct } : c));
    }
  };

  const saveQuizSettings = async () => {
    setIsSaving(true);
    try {
      const res = await apiPost(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/settings`, quizSettings);
      if (res && res.success) {
        setAlert({ type: 'success', message: 'Quiz settings saved' });
        setIsSettingsOpen(false);
      } else {
        setAlert({ type: 'error', message: 'Failed to save settings' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: 'Error saving settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
    const labels = {
      multiple_choice: 'Multiple Choice',
      multiple_select: 'Multiple Select',
      true_false: 'True/False',
      short_answer: 'Short Answer',
      essay: 'Essay',
      matching: 'Matching',
      fill_blank: 'Fill in the Blank',
    };
    return labels[type] || type;
  };

  const toRoman = (n: number): string => {
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
    let result = '';
    let num = n;
    for (let i = 0; i < vals.length; i++) {
      while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
    }
    return result;
  };

  const TYPE_ORDER: QuestionType[] = [
    'multiple_choice', 'multiple_select', 'true_false',
    'short_answer', 'fill_blank', 'matching', 'essay',
  ];

  const questionGroups = TYPE_ORDER
    .map(type => ({ type, questions: questions.filter(q => q.question_type === type) }))
    .filter(g => g.questions.length > 0);

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  const stripHtmlTags = (html: string): string => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const exportQuizSheet = () => {
    if (questions.length === 0) {
      setAlert({ type: 'error', message: 'No questions to export' });
      return;
    }

    let exportText = `${activity?.title || 'Quiz'}\n`;
    exportText += `Total Points: ${totalPoints}\n`;
    exportText += `Number of Questions: ${questions.length}\n`;
    exportText += `${'='.repeat(60)}\n\n`;

    const exportGroups = TYPE_ORDER
      .map(type => ({ type, questions: questions.filter(q => q.question_type === type) }))
      .filter(g => g.questions.length > 0);

    let globalNum = 1;

    exportGroups.forEach((group, groupIndex) => {
      const direction = quizSettings.section_directions?.[group.type];
      const wordBox = group.type === 'fill_blank' ? quizSettings.section_word_boxes?.[group.type] : undefined;
      exportText += `${toRoman(groupIndex + 1)}. ${getQuestionTypeLabel(group.type).toUpperCase()}\n`;
      if (direction) exportText += `   ${direction}\n`;
      if (wordBox) {
        const words = wordBox.split(',').map(w => w.trim()).filter(Boolean);
        const boxLine = words.map(w => `[ ${w} ]`).join('  ');
        exportText += `\n   Word Box:  ${boxLine}\n`;
      }
      exportText += `\n`;

      group.questions.forEach((question) => {
        const index = globalNum - 1;
        exportText += `${globalNum}. ${stripHtmlTags(question.question_text)}\n`;
        exportText += `   (${question.points} point${question.points !== 1 ? 's' : ''})\n\n`;

        if (question.question_type === 'multiple_choice' || question.question_type === 'multiple_select') {
          question.choices?.forEach((choice, ci) => {
            exportText += `   ${String.fromCharCode(65 + ci)}. ${choice.text}\n`;
          });
          exportText += '\n';
        }
        if (question.question_type === 'matching' && question.choices) {
          question.choices.forEach((choice, pi) => {
            const [left] = choice.text.split('::');
            exportText += `   ${pi + 1}. ${left}\n`;
          });
          exportText += '\n';
        }
        if (question.question_type === 'true_false') {
          exportText += `   ○ True     ○ False\n\n`;
        }
        if (question.question_type === 'short_answer') {
          exportText += `   Answer: _________________________________\n\n`;
        }
        if (question.question_type === 'essay') {
          exportText += `   Answer:\n   _____________________________________________\n`;
          exportText += `   _____________________________________________\n`;
          exportText += `   _____________________________________________\n\n`;
        }
        if (question.question_type === 'fill_blank') {
          exportText += `   (Fill in the blank)\n\n`;
        }

        exportText += `${'-'.repeat(60)}\n\n`;
        globalNum++;
      });

      exportText += '\n';
    });

    exportText += `\n${'='.repeat(60)}\n`;
    exportText += `ANSWER KEY\n`;
    exportText += `${'='.repeat(60)}\n\n`;

    let answerNum = 1;
    exportGroups.forEach((group) => {
      group.questions.forEach((question) => {
        exportText += `${answerNum}. `;

        if (question.question_type === 'multiple_choice' && question.choices) {
          const correct = question.choices
            .map((c, i) => c.is_correct ? String.fromCharCode(65 + i) : null)
            .filter(Boolean);
          exportText += correct.join(', ') || 'No correct answer set';
        } else if (question.question_type === 'multiple_select' && question.choices) {
          const correct = question.choices
            .map((c, i) => c.is_correct ? String.fromCharCode(65 + i) : null)
            .filter(Boolean);
          exportText += correct.join(', ') || 'No correct answers set';
        } else if (question.question_type === 'true_false') {
          exportText += question.correct_answer || 'No correct answer set';
        } else if (question.question_type === 'short_answer') {
          exportText += question.correct_answer || (question.sample_answer ? stripHtmlTags(question.sample_answer) : 'No answer provided');
        } else if (question.question_type === 'fill_blank') {
          exportText += question.sample_answer || 'No answers provided';
        } else if (question.question_type === 'essay') {
          exportText += question.sample_answer ? stripHtmlTags(question.sample_answer) : 'Sample answer not provided';
        } else if (question.question_type === 'matching' && question.choices) {
          exportText += '\n';
          question.choices.forEach((choice, pi) => {
            const [left, right] = choice.text.split('::');
            exportText += `      ${pi + 1}. ${left} → ${right}\n`;
          });
          exportText = exportText.trimEnd();
        }

        exportText += '\n';
        answerNum++;
      });
    });

    exportText += `\nEnd of Quiz\n`;

    // Create download
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activity?.title || 'Quiz'}_Sheet.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setAlert({ type: 'success', message: 'Quiz sheet exported successfully' });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = questions.findIndex(q => q.id === active.id);
    const newIndex = questions.findIndex(q => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reorder questions in state
    const reorderedQuestions = arrayMove(questions, oldIndex, newIndex);
    
    // Update order_num for all questions and track which ones changed
    const updatedQuestions = reorderedQuestions.map((q, index) => ({
      ...q,
      order_num: index + 1
    }));

    setQuestions(updatedQuestions);

    // Only update questions whose order actually changed
    try {
      const promises = updatedQuestions
        .filter((q, index) => {
          const originalQuestion = questions.find(orig => orig.id === q.id);
          return originalQuestion && originalQuestion.order_num !== q.order_num;
        })
        .map(async (question) => {
          if (question.id) {
            await apiPut(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/questions/${question.id}`, {
              order_number: question.order_num
            });
          }
        });

      await Promise.all(promises);
      
      setAlert({ type: 'success', message: 'Questions reordered successfully' });
      setTimeout(() => setAlert(null), 3000);
    } catch (error) {
      console.error('Error updating question order:', error);
      setAlert({ type: 'error', message: 'Failed to update question order' });
      // Revert to original order on error
      fetchQuestions();
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate(`/teacher/courses/${courseId}`)} className="text-gray-600">
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Course
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Quiz Builder</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {activity?.title} • {questions.length} question{questions.length !== 1 ? 's' : ''} • {totalPoints} total points
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportQuizSheet} disabled={questions.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export Quiz Sheet
              </Button>
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Quiz Settings
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl" aria-describedby={undefined}>
                  <DialogHeader>
                    <DialogTitle>Quiz Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="time-limit">Time Limit (minutes)</Label>
                        <Input
                          id="time-limit"
                          type="number"
                          value={quizSettings.time_limit || ''}
                          onChange={(e) => setQuizSettings({ ...quizSettings, time_limit: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="No limit"
                        />
                      </div>
                      <div>
                        <Label htmlFor="max-attempts">Maximum Attempts</Label>
                        <Select
                          value={String(quizSettings.max_attempts || 1)}
                          onValueChange={(v) => setQuizSettings({ ...quizSettings, max_attempts: v === 'unlimited' ? undefined : Number(v) })}
                        >
                          <SelectTrigger id="max-attempts">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 attempt</SelectItem>
                            <SelectItem value="2">2 attempts</SelectItem>
                            <SelectItem value="3">3 attempts</SelectItem>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="pass-threshold">Pass Threshold (%)</Label>
                        <Input
                          id="pass-threshold"
                          type="number"
                          min="0"
                          max="100"
                          value={quizSettings.pass_threshold || ''}
                          onChange={(e) => setQuizSettings({ ...quizSettings, pass_threshold: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="e.g., 75"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Shuffle className="h-5 w-5 text-gray-600" />
                          <div>
                            <p className="font-medium text-sm">Shuffle Questions</p>
                            <p className="text-xs text-gray-500">Randomize question order for each student</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={quizSettings.shuffle_questions}
                          onChange={(e) => setQuizSettings({ ...quizSettings, shuffle_questions: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Shuffle className="h-5 w-5 text-gray-600" />
                          <div>
                            <p className="font-medium text-sm">Shuffle Choices</p>
                            <p className="text-xs text-gray-500">Randomize answer choices</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={quizSettings.shuffle_choices}
                          onChange={(e) => setQuizSettings({ ...quizSettings, shuffle_choices: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Eye className="h-5 w-5 text-gray-600" />
                          <div>
                            <p className="font-medium text-sm">Show Correct Answers</p>
                            <p className="text-xs text-gray-500">Display correct answers after submission</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={quizSettings.show_correct_answers}
                          onChange={(e) => setQuizSettings({ ...quizSettings, show_correct_answers: e.target.checked })}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="available-from">Available From</Label>
                        <Input
                          id="available-from"
                          type="datetime-local"
                          value={quizSettings.available_from || ''}
                          onChange={(e) => setQuizSettings({ ...quizSettings, available_from: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="available-until">Available Until</Label>
                        <Input
                          id="available-until"
                          type="datetime-local"
                          value={quizSettings.available_until || ''}
                          onChange={(e) => setQuizSettings({ ...quizSettings, available_until: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveQuizSettings} disabled={isSaving}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Settings
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full max-w-5xl mx-auto">
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Questions</CardTitle>
                    <CardDescription>Add and manage quiz questions</CardDescription>
                  </div>
                  <Button onClick={() => openAddQuestion()} className="bg-gradient-to-r from-blue-600 to-cyan-500">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-6">
                {questions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FileText className="h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No questions yet</h3>
                    <p className="text-gray-500 mb-4">Start building your quiz by adding questions</p>
                    <Button onClick={() => openAddQuestion()} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Question
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {questionGroups.map((group, groupIndex) => (
                      <div key={group.type}>
                        {/* Section header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-bold text-gray-800">
                            {toRoman(groupIndex + 1)}.
                          </span>
                          <span className="text-sm font-semibold text-gray-700">
                            {getQuestionTypeLabel(group.type)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {group.questions.length} item{group.questions.length !== 1 ? 's' : ''}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {group.questions.reduce((s, q) => s + q.points, 0)} pts
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => openAddQuestion(group.type)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>

                        {/* Directions input */}
                        <div className="mb-3">
                          <input
                            type="text"
                            className="w-full text-sm border border-dashed border-gray-300 rounded px-3 py-1.5 text-gray-600 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-gray-50"
                            placeholder={`Directions for ${getQuestionTypeLabel(group.type)} (e.g. "Choose the best answer.")…`}
                            value={quizSettings.section_directions?.[group.type] ?? ''}
                            onChange={(e) => {
                              const newDirs = { ...(quizSettings.section_directions ?? {}), [group.type]: e.target.value };
                              setQuizSettings(prev => ({ ...prev, section_directions: newDirs }));
                            }}
                            onBlur={async (e) => {
                              const newDirs = { ...(quizSettings.section_directions ?? {}), [group.type]: e.target.value };
                              try {
                                await apiPost(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/settings`, {
                                  ...quizSettings,
                                  section_directions: newDirs,
                                });
                              } catch (_) {}
                            }}
                          />
                        </div>

                        {/* Word Box — only for fill_blank */}
                        {group.type === 'fill_blank' && (
                          <div className="mb-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Word Box</span>
                              <span className="text-xs text-gray-400">(comma-separated words students can pick from)</span>
                            </div>
                            <input
                              type="text"
                              title="Word Box"
                              className="w-full text-sm border border-dashed border-amber-300 rounded px-3 py-1.5 text-gray-600 placeholder:text-gray-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-amber-50"
                              placeholder={`e.g. is, am, the, a, my`}
                              value={quizSettings.section_word_boxes?.[group.type] ?? ''}
                              onChange={(e) => {
                                const newBoxes = { ...(quizSettings.section_word_boxes ?? {}), [group.type]: e.target.value };
                                setQuizSettings(prev => ({ ...prev, section_word_boxes: newBoxes }));
                              }}
                              onBlur={async (e) => {
                                const newBoxes = { ...(quizSettings.section_word_boxes ?? {}), [group.type]: e.target.value };
                                try {
                                  await apiPost(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/settings`, {
                                    ...quizSettings,
                                    section_word_boxes: newBoxes,
                                  });
                                } catch (_) {}
                              }}
                            />
                            {/* Preview chips */}
                            {(quizSettings.section_word_boxes?.[group.type] ?? '').trim() && (
                              <div className="mt-2 flex flex-wrap gap-1.5 p-2 border border-amber-200 rounded bg-amber-50">
                                <span className="text-xs font-semibold text-amber-700 mr-1 self-center">Word Box:</span>
                                {(quizSettings.section_word_boxes?.[group.type] ?? '')
                                  .split(',')
                                  .map(w => w.trim())
                                  .filter(Boolean)
                                  .map((word, wi) => (
                                    <span key={wi} className="inline-block text-xs px-2 py-0.5 rounded border border-amber-300 bg-white text-amber-800 font-medium">
                                      {word}
                                    </span>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Questions in this group */}
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={group.questions.map(q => q.id || 0)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-3">
                              {group.questions.map((question) => {
                                const globalIndex = questions.findIndex(q => q.id === question.id);
                                return (
                                  <SortableQuestionItem
                                    key={question.id ?? question.order_num}
                                    question={question}
                                    index={globalIndex}
                                    onEdit={() => openEditQuestion(globalIndex)}
                                    onDelete={() => promptDeleteQuestion(question)}
                                    getQuestionTypeLabel={getQuestionTypeLabel}
                                  />
                                );
                              })}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add/Edit Question Dialog */}
        <Dialog open={isAddingQuestion} onOpenChange={setIsAddingQuestion}>
          {isAddingQuestion && <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editingQuestionIndex !== null ? 'Edit Question' : 'Add New Question'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Question Type */}
              <div>
                <Label>Question Type</Label>
                <Select value={questionType} onValueChange={(v) => setQuestionType(v as QuestionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice (Single Answer)</SelectItem>
                    <SelectItem value="multiple_select">Multiple Select (Multiple Answers)</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                    <SelectItem value="essay">Essay</SelectItem>
                    <SelectItem value="matching">Matching</SelectItem>
                    <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Question Text */}
              <div>
                <Label>Question Text</Label>
                <div className="mt-2">
                  <ReactQuill
                    theme="snow"
                    value={questionText}
                    onChange={setQuestionText}
                    placeholder="Enter your question..."
                    style={{ height: '150px', marginBottom: '50px' }}
                  />
                </div>
              </div>

              {/* Answer Configuration */}
              {(questionType === 'multiple_choice' || questionType === 'multiple_select') && (
                <div>
                  <Label>Answer Choices</Label>
                  <div className="space-y-3 mt-2">
                    {choices.map((choice, index) => (
                      <div key={choice.id} className="flex items-center gap-3">
                        <input
                          type={questionType === 'multiple_choice' ? 'radio' : 'checkbox'}
                          checked={choice.is_correct}
                          onChange={() => toggleCorrectChoice(choice.id)}
                          className="w-4 h-4 text-green-600"
                        />
                        <span className="text-sm font-medium text-gray-700 w-6">{String.fromCharCode(65 + index)}.</span>
                        <Input
                          value={choice.text}
                          onChange={(e) => updateChoice(choice.id, e.target.value)}
                          placeholder={`Choice ${String.fromCharCode(65 + index)}`}
                          className="flex-1"
                        />
                        {choices.length > 2 && (
                          <Button variant="ghost" size="sm" onClick={() => removeChoice(choice.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addChoice} className="mt-3">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Choice
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    {questionType === 'multiple_choice' 
                      ? 'Select the radio button for the correct answer'
                      : 'Check all correct answers'}
                  </p>
                </div>
              )}

              {questionType === 'true_false' && (
                <div>
                  <Label>Correct Answer</Label>
                  <div className="flex gap-4 mt-2">
                    <Button
                      variant={correctAnswer === 'True' ? 'default' : 'outline'}
                      onClick={() => setCorrectAnswer('True')}
                      className="flex-1"
                    >
                      True
                    </Button>
                    <Button
                      variant={correctAnswer === 'False' ? 'default' : 'outline'}
                      onClick={() => setCorrectAnswer('False')}
                      className="flex-1"
                    >
                      False
                    </Button>
                  </div>
                </div>
              )}

              {(questionType === 'short_answer' || questionType === 'essay') && (
                <div>
                  <Label>Sample Answer (Optional)</Label>
                  <p className="text-xs text-gray-500 mb-2">For your reference when grading{questionType === 'short_answer' ? ' (case-insensitive matching)' : ''}</p>
                  {questionType === 'essay' ? (
                    <ReactQuill
                      theme="snow"
                      value={sampleAnswer}
                      onChange={setSampleAnswer}
                      placeholder="Enter a sample answer..."
                      style={{ height: '120px', marginBottom: '50px' }}
                    />
                  ) : (
                    <Input
                      value={sampleAnswer}
                      onChange={(e) => setSampleAnswer(e.target.value)}
                      placeholder="Enter a sample answer..."
                    />
                  )}
                </div>
              )}

              {questionType === 'fill_blank' && (
                <div>
                  <Label>Accepted Answers</Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Enter multiple correct answers separated by comma (e.g., "answer1, answer2, answer3")
                  </p>
                  <Input
                    value={sampleAnswer}
                    onChange={(e) => setSampleAnswer(e.target.value)}
                    placeholder="Enter accepted answers (comma-separated for multiple)..."
                  />
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs font-semibold text-blue-900 mb-1">💡 How to create blanks:</p>
                    <p className="text-xs text-blue-800">
                      In your question text above, use <code className="bg-blue-100 px-1 py-0.5 rounded">_____</code> (five underscores) to mark where students should fill in answers.
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Example: "The capital of France is _____" (Answer: Paris)
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Case-insensitive matching will be used for grading</p>
                </div>
              )}

              {questionType === 'matching' && (
                <div>
                  <Label>Matching Pairs</Label>
                  <p className="text-xs text-gray-500 mb-2">Create pairs - students will match left items to right items</p>
                  <div className="space-y-3">
                    {choices.map((choice, index) => (
                      <div key={choice.id} className="grid grid-cols-2 gap-3 items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700 w-6">{index + 1}.</span>
                          <Input
                            value={choice.text.split('::')[0] || ''}
                            onChange={(e) => {
                              const rightSide = choice.text.split('::')[1] || '';
                              updateChoice(choice.id, `${e.target.value}::${rightSide}`);
                            }}
                            placeholder="Left side"
                            className="flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">→</span>
                          <Input
                            value={choice.text.split('::')[1] || ''}
                            onChange={(e) => {
                              const leftSide = choice.text.split('::')[0] || '';
                              updateChoice(choice.id, `${leftSide}::${e.target.value}`);
                            }}
                            placeholder="Right side (match)"
                            className="flex-1"
                          />
                          {choices.length > 2 && (
                            <Button variant="ghost" size="sm" onClick={() => removeChoice(choice.id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addChoice} className="mt-3">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Matching Pair
                  </Button>
                </div>
              )}

              {/* Points and Image */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Points</Label>
                  <Input
                    type="number"
                    min="1"
                    value={questionPoints}
                    onChange={(e) => setQuestionPoints(e.target.value)}
                    placeholder="Points"
                  />
                </div>
                <div>
                  <Label>Image URL (Optional)</Label>
                  <Input
                    value={questionImage}
                    onChange={(e) => setQuestionImage(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsAddingQuestion(false)}>
                  Cancel
                </Button>
                <Button onClick={saveQuestion} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingQuestionIndex !== null ? 'Update Question' : 'Add Question'}
                </Button>
              </div>
            </div>
          </DialogContent>}
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Question?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the question and all its choices. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Alert */}
        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      </div>
    </DashboardLayout>
  );
};

export default QuizBuilder;
