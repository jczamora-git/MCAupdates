import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertMessage } from "@/components/AlertMessage";
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  BookOpen,
  X,
  Pencil
} from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";

const ActivitySubmit = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { courseId, activityId } = useParams();

  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [submissionText, setSubmissionText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [studentDbId, setStudentDbId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Course info for sidebar
  const [courseTitle, setCourseTitle] = useState<string>("Course");
  const [courseCode, setCourseCode] = useState<string>("N/A");

  const parseDateTime = (value?: string | null) => {
    if (!value) return null;
    const cleaned = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "student") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    loadActivityData();
  }, [activityId, user]);

  const loadActivityData = async () => {
    if (!user?.id || !activityId) return;

    try {
      setLoading(true);

      // Fetch activity details
      const activityRes = await apiGet(`${API_ENDPOINTS.ACTIVITIES}/${activityId}`);
      if (activityRes.success && activityRes.data) {
        setActivity(activityRes.data);
      }

      // Get student info to fetch student_id
      const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_USER(user.id));
      const student = studentRes.data || studentRes.student || studentRes || null;
      const dbId = student?.id;
      setStudentDbId(dbId);
      
      const sectionId = student?.section_id || student?.sectionId;

      // Fetch course info for sidebar
      if (courseId) {
        try {
          const taRes = await apiGet(`${API_ENDPOINTS.TEACHER_ASSIGNMENTS_FOR_STUDENT}?section_id=${sectionId}`);
          const assignments = taRes.data || taRes.assignments || taRes || [];
          const match = assignments.find(
            (a: any) => String(a.id) === String(courseId) || String(a.subject?.id) === String(courseId)
          );
          if (match) {
            const subj = match.subject || match.subject_info || {};
            setCourseTitle(subj.course_name || subj.title || subj.name || "Course");
            setCourseCode(subj.course_code || subj.code || "N/A");
          }
        } catch (err) {
          console.error('Error fetching course info:', err);
        }
        
        // Fallback: try fetching subject directly
        try {
          const subjRes = await apiGet(API_ENDPOINTS.SUBJECT_BY_ID(courseId));
          const subj = subjRes.data || subjRes.subject || subjRes || null;
          if (subj) {
            setCourseTitle(prev => prev === "Course" ? (subj.course_name || subj.title || subj.name || "Course") : prev);
            setCourseCode(prev => prev === "N/A" ? (subj.course_code || subj.code || "N/A") : prev);
          }
        } catch (err) {
          console.error('Error fetching subject:', err);
        }
      }

      // Check if there's already a submission using the new endpoint
      if (dbId) {
        try {
          const submissionRes = await apiGet(
            `${API_ENDPOINTS.ACTIVITIES}/${activityId}/my-submission`
          );
          if (submissionRes.success && submissionRes.data) {
            setExistingSubmission(submissionRes.data);
            setSubmissionText(submissionRes.data.submission_text || "");
            setIsEditing(false); // Don't edit by default when submission exists
          } else {
            setIsEditing(true); // Allow editing if no submission
          }
        } catch (err) {
          // No existing submission
          setIsEditing(true);
        }
      }

    } catch (error) {
      console.error('Error loading activity:', error);
      setAlert({ type: 'error', message: 'Failed to load activity details' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles([...selectedFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (isClosed) {
      setAlert({ type: 'error', message: 'This activity is closed. Late submissions are not allowed.' });
      return;
    }
    if (!submissionText.trim() && selectedFiles.length === 0) {
      setAlert({ type: 'error', message: 'Please provide a submission text or upload files' });
      return;
    }

    try {
      setSubmitting(true);

      if (!studentDbId) {
        setAlert({ type: 'error', message: 'Student information not loaded. Please refresh the page.' });
        setSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append('activity_id', activityId!);
      formData.append('student_id', String(studentDbId));
      formData.append('submission_text', submissionText);

      // Append files
      selectedFiles.forEach((file) => {
        formData.append('files[]', file);
      });

      const res = await apiPost(`${API_ENDPOINTS.ACTIVITIES}/${activityId}/submit`, formData);

      if (res.success) {
        setAlert({ type: 'success', message: 'Submission successful!' });
        setTimeout(() => {
          navigate(`/student/courses/${courseId}`);
        }, 2000);
      } else {
        setAlert({ type: 'error', message: res.message || 'Submission failed' });
      }

    } catch (error) {
      console.error('Submission error:', error);
      setAlert({ type: 'error', message: 'Error submitting activity' });
    } finally {
      setSubmitting(false);
    }
  };

  const deadline = parseDateTime(activity?.due_at);
  const isLate = deadline ? new Date() > deadline : false;
  const allowLate = Boolean(activity?.allow_late_submission);
  const isClosed = Boolean(deadline && isLate && !allowLate);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 mx-auto"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent mx-auto absolute inset-0"></div>
            </div>
            <p className="mt-6 text-gray-700 font-medium">Loading activity...</p>
            <p className="mt-2 text-sm text-gray-500">Please wait a moment</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-screen lg:h-screen bg-gray-50 lg:overflow-hidden">
        
        {/* Sticky top bar */}
        <div className="sticky top-0 z-10 lg:relative border-b border-gray-200 px-4 sm:px-8 py-3 sm:py-4 bg-white flex-shrink-0 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/student/courses/${courseId}`)}
              className="text-gray-500 hover:text-gray-900 -ml-2 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Back to Course</span>
              <span className="sm:hidden">Back</span>
            </Button>

            {/* Mobile title */}
            <div className="flex-1 min-w-0 lg:hidden">
              <h1 className="text-base font-bold text-gray-900 truncate">{activity?.title || "Submit Activity"}</h1>
            </div>
          </div>
        </div>

        {/* Main content (sidebar + form) */}
        <div className="flex-1 lg:overflow-hidden">
          <div className="lg:h-full max-w-6xl mx-auto flex gap-0 lg:gap-6 lg:px-6 lg:py-6">

            {/* Desktop sidebar */}
            <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 gap-4">
              
              {/* Course info card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-3 shadow-md shadow-blue-100">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{courseTitle}</h2>
                {courseCode && (
                  <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                    {courseCode}
                  </span>
                )}
              </div>

              {/* Activity info card */}
              {activity && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Activity Info</h3>
                  </div>
                  
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium capitalize">
                        {activity.type}
                      </span>
                    </div>
                    
                    {activity.due_at && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs">
                          Due: {new Date(activity.due_at).toLocaleDateString(undefined, { 
                            month: 'short', day: 'numeric', year: 'numeric' 
                          })}
                        </span>
                      </div>
                    )}
                    
                    {activity.max_score && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <CheckCircle className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs font-semibold text-blue-700">
                          {activity.max_score} points
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </aside>

            {/* Form content */}
            <div className="flex-1 lg:overflow-y-auto w-full">
              <div className="px-4 sm:px-6 py-4 lg:py-0 space-y-4 sm:space-y-6 pb-20 lg:pb-0 max-w-full">

                {/* Activity Title & Due Date - Dark Header */}
                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg sm:rounded-xl border-2 border-cyan-400 shadow-xl p-4 sm:p-6 relative overflow-hidden w-full">
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/30 to-cyan-300/30 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-300/20 to-cyan-300/20 rounded-full -ml-12 -mb-12 blur-2xl"></div>
                  
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 sm:mb-3 leading-tight break-words">{activity?.title}</h1>
                        <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white/20 backdrop-blur-sm border border-white/40 rounded-full max-w-full">
                          <Clock className="h-3.5 w-3.5 text-white flex-shrink-0" />
                          <span className="text-white font-medium text-xs sm:text-sm truncate">
                              Due: {activity?.due_at ? new Date(activity.due_at).toLocaleDateString(undefined, { 
                                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'
                              }) : 'No deadline'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {existingSubmission && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (isEditing) {
                              setIsEditing(false);
                              setSubmissionText(existingSubmission.submission_text || "");
                              setSelectedFiles([]);
                            } else {
                              setIsEditing(true);
                            }
                          }}
                          disabled={isClosed}
                          className="bg-white/10 backdrop-blur-sm border-2 border-white/40 hover:border-white/60 hover:bg-white/20 text-white transition-all duration-200 shadow-lg hover:shadow-xl flex-shrink-0"
                          title={isEditing ? "Cancel editing" : "Edit submission"}
                        >
                          {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {isClosed && (
                  <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="text-sm text-red-800">
                        <p className="font-semibold">This activity is closed.</p>
                        <p>Late submissions are not allowed.</p>
                      </div>
                    </div>
                  </div>
                )}

                {!isClosed && isLate && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg sm:rounded-xl p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="text-sm text-amber-800">
                        <p className="font-semibold">This submission is late.</p>
                        <p>Late submissions are allowed for this activity.</p>
                      </div>
                    </div>
                  </div>
                )}

                  {activity?.description && (
                  <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 w-full overflow-hidden">
                    <h2 className="text-xs sm:text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3 sm:mb-4">
                      <div className="p-1.5 bg-blue-500 rounded-lg shadow-md">
                        <FileText className="h-3.5 w-3.5 text-white" />
                      </div>
                      Instructions
                    </h2>
                    <div 
                      className="text-sm sm:text-base text-gray-700 leading-relaxed space-y-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2.5 [&_ol]:mr-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_li]:text-gray-600 [&_li]:whitespace-normal [&_p]:text-gray-700 [&_p]:mb-2 [&_p]:whitespace-normal [&_strong]:font-semibold [&_strong]:text-gray-900 overflow-x-hidden"
                      dangerouslySetInnerHTML={{ __html: activity.description.replace(/&nbsp;/g, ' ') }}
                    />
                  </div>
                )}

                {/* Previous Submission - Enhanced Display */}
                {existingSubmission && !isEditing && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl border border-blue-200 shadow-sm p-4 sm:p-6 space-y-3 sm:space-y-4 w-full overflow-hidden">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg shadow-md flex-shrink-0">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm sm:text-base font-bold text-gray-900 break-words">Previous Submission</h2>
                        <p className="text-xs text-blue-700">Successfully submitted</p>
                      </div>
                    </div>
                    
                    {existingSubmission.submitted_at && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/60 rounded-lg border border-blue-200">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-xs text-gray-700">
                          Submitted: {new Date(existingSubmission.submitted_at).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'
                          })}
                        </span>
                      </div>
                    )}

                    {/* Text Response */}
                    {existingSubmission.submission_text && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Your Response</p>
                        <div className="bg-white rounded-lg p-4 sm:p-5 border border-blue-200 shadow-sm overflow-hidden">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed break-words">
                            {existingSubmission.submission_text}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Attached Files */}
                    {existingSubmission.file_name && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Attached Files</p>
                        {(() => {
                          try {
                            const fileNames = existingSubmission.file_name.startsWith('[') 
                              ? JSON.parse(existingSubmission.file_name) 
                              : [existingSubmission.file_name];
                            const fileUrls = existingSubmission.file_url?.startsWith('[')
                              ? JSON.parse(existingSubmission.file_url)
                              : [existingSubmission.file_url];

                            return fileNames.map((fileName: string, index: number) => (
                              <a
                                key={index}
                                href={fileUrls[index]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all duration-200 group overflow-hidden"
                              >
                                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors flex-shrink-0">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                </div>
                                <span className="text-xs sm:text-sm text-gray-800 flex-1 truncate font-medium min-w-0">
                                  {fileName}
                                </span>
                                <ExternalLink className="h-4 w-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                              </a>
                            ));
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                    )}

                  </div>
                )}

                {/* Your Submission Section - Enhanced */}
                {(!existingSubmission || isEditing) && (
                  <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4 sm:space-y-5 w-full overflow-hidden">
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                      <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md flex-shrink-0">
                        <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base sm:text-lg font-bold text-gray-900 break-words">Your Submission</h2>
                        <p className="text-xs text-gray-500 hidden sm:block">Add your response and attach files</p>
                      </div>
                    </div>

                    {existingSubmission && isEditing && (
                      <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-lg shadow-sm">
                        <div className="p-1.5 bg-amber-500 rounded-lg flex-shrink-0">
                          <AlertCircle className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-amber-900 mb-1">Resubmission Warning</p>
                          <p className="text-xs text-amber-800">
                            Submitting again will replace your previous submission shown above.
                          </p>
                        </div>
                      </div>
                    )}
                  {/* Text Response */}
                  <div className="space-y-2">
                    <label htmlFor="submission-text" className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Your Response
                    </label>
                    <Textarea
                      id="submission-text"
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                      placeholder="Type your response here..."
                      rows={8}
                      className="w-full resize-none border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm p-4 transition-all"
                    />
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Files to Submit</p>
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all duration-200 group"
                          >
                            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors flex-shrink-0">
                              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm text-gray-900 font-medium truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0 touch-manipulation"
                              title="Remove file"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File Upload Button + Submit Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="file-upload"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label htmlFor="file-upload" className="flex-1 sm:flex-initial">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto cursor-pointer border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-700 font-medium touch-manipulation"
                          asChild
                        >
                          <span className="flex items-center justify-center gap-2 py-2.5">
                            <Upload className="h-4 w-4" />
                            <span className="text-sm">Attach Files</span>
                          </span>
                        </Button>
                      </label>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/student/courses/${courseId}`)}
                        disabled={submitting}
                        className="flex-1 sm:flex-initial text-gray-600 hover:text-gray-900 hover:bg-gray-100 py-2.5 touch-manipulation"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={isClosed || submitting || (!submissionText.trim() && selectedFiles.length === 0)}
                        size="sm"
                        className="flex-1 sm:flex-initial bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-4 sm:px-6 py-2.5 touch-manipulation"
                      >
                        {submitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                            <span className="text-sm">Submitting...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            <span className="text-sm">Submit Work</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
        
      {alert && (
        <div className="fixed bottom-6 right-6 z-50">
          <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}
    </DashboardLayout>
  );
};

export default ActivitySubmit;
