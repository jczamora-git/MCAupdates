import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, BookOpen, Clock, FileText, HelpCircle, Award, Zap,
  Palette, MessageCircle, Mic, UsersRound, ClipboardList, FileIcon,
  Upload, PlayCircle, CheckCircle, AlertCircle, Download, ExternalLink,
  Calendar, Layers, LayoutList,
} from "lucide-react";
import { API_ENDPOINTS, apiGet } from "@/lib/api";

// ── Activity type display ──────────────────────────────────────────────────────
const getActivityTypeDisplay = (type: string) => {
  const typeMap: Record<string, { label: string; color: string; bgColor: string; borderColor: string; leftBorderClass: string; Icon: any }> = {
    worksheet:     { label: "Worksheet",     color: "text-blue-700",   bgColor: "bg-blue-50",   borderColor: "border-blue-300",   leftBorderClass: "border-l-4 border-l-blue-300",   Icon: FileText },
    quiz:          { label: "Quiz",          color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-300", leftBorderClass: "border-l-4 border-l-purple-300", Icon: HelpCircle },
    exam:          { label: "Exam",          color: "text-red-700",    bgColor: "bg-red-50",    borderColor: "border-red-300",    leftBorderClass: "border-l-4 border-l-red-300",    Icon: Award },
    project:       { label: "Project",       color: "text-cyan-700",   bgColor: "bg-cyan-50",   borderColor: "border-cyan-300",   leftBorderClass: "border-l-4 border-l-cyan-300",   Icon: Zap },
    art:           { label: "Art",           color: "text-pink-700",   bgColor: "bg-pink-50",   borderColor: "border-pink-300",   leftBorderClass: "border-l-4 border-l-pink-300",   Icon: Palette },
    storytime:     { label: "Storytime",     color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-300", leftBorderClass: "border-l-4 border-l-orange-300", Icon: MessageCircle },
    recitation:    { label: "Recitation",    color: "text-green-700",  bgColor: "bg-green-50",  borderColor: "border-green-300",  leftBorderClass: "border-l-4 border-l-green-300",  Icon: Mic },
    participation: { label: "Participation", color: "text-indigo-700", bgColor: "bg-indigo-50", borderColor: "border-indigo-300", leftBorderClass: "border-l-4 border-l-indigo-300", Icon: UsersRound },
    other:         { label: "Other",         color: "text-gray-700",   bgColor: "bg-gray-50",   borderColor: "border-gray-300",   leftBorderClass: "border-l-4 border-l-gray-300",   Icon: ClipboardList },
  };
  return typeMap[type] ?? typeMap["other"];
};

// ── Relative time helper ───────────────────────────────────────────────────────
const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now  = new Date();
  const diffMs   = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays  = Math.floor(diffMs / 86400000);

  if (diffMins  < 1)  return "just now";
  if (diffMins  < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays  === 1) return "yesterday";
  if (diffDays  < 7)  return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// ── YouTube helper ─────────────────────────────────────────────────────────────
const getYouTubeId = (url: string) => {
  const match = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?.*v=)([^#&?]{11})/);
  return match ? match[1] : null;
};

// ── Filter type ────────────────────────────────────────────────────────────────
type FilterType = "all" | "activities" | "materials";

// ══════════════════════════════════════════════════════════════════════════════
const StudentCourseManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { courseId } = useParams();

  const [courseTitle, setCourseTitle]             = useState<string | null>(null);
  const [courseCode, setCourseCode]               = useState<string | null>(null);
  const [activities, setActivities]               = useState<any[]>([]);
  const [learningMaterials, setLearningMaterials] = useState<any[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [filter, setFilter]                       = useState<FilterType>("all");

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "student") navigate("/auth");
  }, [isAuthenticated, user, navigate]);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      if (!user?.id || !courseId) return;
      try {
        setLoading(true);

        // Student record
        const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_USER(user.id));
        const student = studentRes.data || studentRes.student || studentRes || null;
        if (!student) return;

        const sectionId = student.section_id || student.sectionId;

        // Course title (try teacher assignments first, then subject endpoint)
        try {
          const taRes = await apiGet(
            `${API_ENDPOINTS.TEACHER_ASSIGNMENTS_FOR_STUDENT}?section_id=${sectionId}`
          );
          const assignments = taRes.data || taRes.assignments || taRes || [];
          const match = assignments.find(
            (a: any) => String(a.id) === String(courseId) || String(a.subject?.id) === String(courseId)
          );
          if (match) {
            const subj = match.subject || match.subject_info || {};
            setCourseTitle(subj.course_name || subj.title || subj.name || "Course");
            setCourseCode(subj.course_code || subj.code || "N/A");
          }
        } catch {}

        try {
          const subjRes = await apiGet(API_ENDPOINTS.SUBJECT_BY_ID(courseId));
          const subj = subjRes.data || subjRes.subject || subjRes || null;
          if (subj) {
            setCourseTitle(prev => prev || subj.course_name || subj.title || subj.name || "Course");
            setCourseCode(prev => prev || subj.course_code || subj.code || "N/A");
          }
        } catch {}

        // Activities
        try {
          const actRes = await apiGet(
            `${API_ENDPOINTS.ACTIVITIES_STUDENT_GRADES}?course_id=${courseId}&student_id=${student.id}${sectionId ? `&section_id=${sectionId}` : ""}`
          );
          const list = actRes.data || actRes || [];
          setActivities(
            Array.isArray(list)
              ? list.map((a: any) => ({
                  id: a.id,
                  title: a.title,
                  type: a.type,
                  description: a.description,
                  max_score: a.max_score,
                  due_at: a.due_at,
                  student_grade: a.student_grade,
                  submission_status: a.submission_status ?? (a.student_grade !== null ? "graded" : "pending"),
                  created_at: a.created_at || a.due_at || new Date().toISOString(),
                }))
              : []
          );
        } catch { setActivities([]); }

        // Learning materials
        try {
          const matRes = await apiGet(`${API_ENDPOINTS.LEARNING_MATERIALS}/subject/${courseId}`);
          if (matRes.success && Array.isArray(matRes.data)) setLearningMaterials(matRes.data);
        } catch { setLearningMaterials([]); }

      } catch (e) {
        console.error("Error fetching course data:", e);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && user?.role === "student") fetchAll();
  }, [user, isAuthenticated, courseId]);

  // ── Build merged & sorted feed ──────────────────────────────────────────────
  const feed = useMemo(() => {
    const actItems = activities.map(a => ({ ...a, _feedType: "activity" as const }));
    const matItems = learningMaterials.map(m => ({ ...m, _feedType: "material" as const }));

    const merged = [...actItems, ...matItems].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    if (filter === "activities") return merged.filter(i => i._feedType === "activity");
    if (filter === "materials")  return merged.filter(i => i._feedType === "material");
    return merged;
  }, [activities, learningMaterials, filter]);

  if (!isAuthenticated) return null;

  // ── Filter pill (used in both header strip + sidebar) ───────────────────────
  const FilterPill = ({
    value, label, icon: Icon, compact = false, iconOnly = false,
  }: { value: FilterType; label: string; icon: any; compact?: boolean; iconOnly?: boolean }) => {
    const count =
      value === "all" ? activities.length + learningMaterials.length
      : value === "activities" ? activities.length
      : learningMaterials.length;
    const active = filter === value;
    if (iconOnly) {
      return (
        <button
          onClick={() => setFilter(value)}
          title={label}
          className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 flex-shrink-0 ${
            active
              ? "bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          <Icon className="h-5 w-5" />
          <span className={`text-[10px] font-extrabold mt-0.5 ${
            active ? "text-white/90" : "text-gray-400"
          }`}>{count}</span>
        </button>
      );
    }
    return (
      <button
        onClick={() => setFilter(value)}
        className={`flex items-center gap-2 whitespace-nowrap transition-all duration-200 font-semibold ${
          compact
            ? `w-full px-3 py-2.5 rounded-xl text-sm ${
                active
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-100"
              }`
            : `px-4 py-2 rounded-full text-sm border-2 ${
                active
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-md"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`
        }`}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{label}</span>
        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-bold ${
          active ? "bg-white/30 text-white" : "bg-gray-100 text-gray-500"
        }`}>
          {count}
        </span>
      </button>
    );
  };

  // ── Activity post card ──────────────────────────────────────────────────────
  const ActivityCard = ({ item }: { item: any }) => {
    const typeInfo  = getActivityTypeDisplay(item.type);
    const isOverdue = item.due_at && new Date(item.due_at) < new Date() && item.student_grade === null;
    const isGraded  = item.student_grade !== null;

    return (
      <div
        className={`bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-100 ${typeInfo.leftBorderClass}`}
      >
        {/* Top meta bar */}
        <div className="px-5 pt-4 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${typeInfo.bgColor} border ${typeInfo.borderColor}`}>
              <typeInfo.Icon className={`h-3.5 w-3.5 ${typeInfo.color}`} />
            </div>
            <span className={`text-xs font-bold uppercase tracking-widest ${typeInfo.color}`}>{typeInfo.label}</span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">Activity</span>
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getRelativeTime(item.created_at)}
          </span>
        </div>

        {/* Card body */}
        <div className="px-5 pt-3 pb-4">
          <h3 className="font-bold text-base sm:text-lg text-gray-900 leading-snug">{item.title}</h3>
          {item.description && (
            <div
              className="text-sm text-gray-500 line-clamp-2 mt-1 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          )}

          {/* Status + meta chips */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {isGraded ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-semibold text-green-700">
                <CheckCircle className="h-3 w-3" />
                {item.student_grade}/{item.max_score} pts
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
                <Award className="h-3 w-3" />
                {item.max_score} pts
              </span>
            )}
            {item.due_at && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isOverdue
                  ? "bg-red-50 border-red-200 text-red-600"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}>
                <Calendar className="h-3 w-3" />
                {isOverdue ? "Overdue · " : "Due "}{
                  new Date(item.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                }
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
                <AlertCircle className="h-3 w-3" />
                Overdue
              </span>
            )}
          </div>
        </div>

        {/* Card footer action */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between gap-2">
          <div className="flex-1" />
          {!isGraded && (item.type === "quiz" || item.type === "exam") && (
            <Button
              size="sm"
              onClick={() => navigate(`/student/courses/${courseId}/activities/${item.id}/quiz`)}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90 rounded-full px-5 shadow-sm shadow-blue-200"
            >
              <PlayCircle className="h-4 w-4 mr-1.5" />
              Take {item.type === "exam" ? "Exam" : "Quiz"}
            </Button>
          )}
          {!isGraded && ["worksheet", "project", "art"].includes(item.type) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/student/courses/${courseId}/activities/${item.id}/submit`)}
              className="border-blue-300 text-blue-700 hover:bg-blue-50 rounded-full px-5"
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Submit Work
            </Button>
          )}
          {isGraded && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
              <CheckCircle className="h-4 w-4" />
              Graded
            </span>
          )}
          {!isGraded && !["quiz", "exam", "worksheet", "project", "art"].includes(item.type) && (
            <span className="text-xs text-gray-400 italic">No submission required</span>
          )}
        </div>
      </div>
    );
  };

  // ── Material post card ──────────────────────────────────────────────────────
  const MaterialCard = ({ item }: { item: any }) => {
    let links: string[] = [];
    if (item.type === "link" && item.link_url) {
      try {
        const parsed = JSON.parse(item.link_url);
        links = Array.isArray(parsed) ? parsed : [item.link_url];
      } catch { links = [item.link_url]; }
    }
    const youtubeLinks = links.map(l => ({ url: l, ytId: getYouTubeId(l) })).filter(l => l.ytId);
    const regularLinks = links.filter(l => !getYouTubeId(l));

    return (
      <div
        className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden border border-l-4 border-emerald-300"
      >
        {/* Top meta bar */}
        <div className="px-5 pt-4 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-200">
              {item.type === "file" ? (
                <FileIcon className="h-3.5 w-3.5 text-emerald-600" />
              ) : item.type === "link" ? (
                <ExternalLink className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <BookOpen className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
              {item.type === "file" ? "File" : item.type === "link" ? "Link" : "Reading"}
            </span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">Learning Material</span>
          </div>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getRelativeTime(item.created_at)}
          </span>
        </div>

        {/* Card body */}
        <div className="px-5 pt-3 pb-4 space-y-3">
          <h3 className="font-bold text-base sm:text-lg text-gray-900 leading-snug">{item.title}</h3>

          {item.description && (
            <div
              className="text-sm text-gray-500 prose prose-sm max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          )}

          {/* Text content */}
          {item.type === "text" && item.content && (
            <div
              className="prose prose-sm max-w-none p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-sm"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
          )}

          {/* File downloads */}
          {item.type === "file" && item.file_url && (() => {
            try {
              const files = JSON.parse(item.file_url);
              const fileNames: string[] = item.file_name ? JSON.parse(item.file_name) : [];
              const fileList = Array.isArray(files) ? files : [item.file_url];
              return (
                <div className="space-y-2">
                  {fileList.map((url: string, idx: number) => (
                    <a
                      key={idx}
                      href={url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                        <Download className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-emerald-800 group-hover:underline truncate flex-1">
                        {fileNames[idx] || `File ${idx + 1}`}
                      </span>
                    </a>
                  ))}
                </div>
              );
            } catch {
              return (
                <a
                  href={item.file_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Download className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-emerald-800 group-hover:underline truncate">
                    {item.file_name || "Download File"}
                  </span>
                </a>
              );
            }
          })()}

          {/* YouTube embeds */}
          {youtubeLinks.length > 0 && (
            <div className="space-y-3">
              {youtubeLinks.map((yt, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden border-2 border-emerald-200 aspect-video max-w-lg">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${yt.ytId}`}
                    title="YouTube video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Regular links */}
          {regularLinks.length > 0 && (
            <div className="space-y-2">
              {regularLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
                    <ExternalLink className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-emerald-800 group-hover:underline truncate flex-1">
                    {link}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const totalCount   = activities.length + learningMaterials.length;
  const gradedCount  = activities.filter(a => a.student_grade !== null).length;
  const pendingCount = activities.filter(a => a.student_grade === null).length;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

        {/* ── Sticky top bar ── */}
        <div className="border-b border-gray-200 px-4 sm:px-8 py-3 sm:py-4 bg-white flex-shrink-0 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/student/courses")}
              className="text-gray-500 hover:text-gray-900 -ml-2 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Back to My Courses</span>
              <span className="sm:hidden">Back</span>
            </Button>

            {/* Title (visible on mobile in the top bar) */}
            <div className="flex-1 min-w-0 lg:hidden">
              <h1 className="text-base font-bold text-gray-900 truncate">{courseTitle || "Course"}</h1>
              {courseCode && <p className="text-xs text-gray-400 truncate">{courseCode}</p>}
            </div>
          </div>
        </div>

        {/* ── Mobile filter strip (hidden on lg) ── */}
        <div className="lg:hidden flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2">
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <FilterPill value="all"        label="All"        icon={Layers}     iconOnly />
            <FilterPill value="activities" label="Activities" icon={LayoutList} iconOnly />
            <FilterPill value="materials"  label="Materials"  icon={BookOpen}   iconOnly />
          </div>
        </div>

        {/* ── Main content (sidebar + feed on desktop) ── */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full max-w-6xl mx-auto flex gap-0 lg:gap-6 lg:px-6 lg:py-6">

            {/* ══ Desktop sidebar ══ */}
            <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 gap-4">

              {/* Course info card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-3 shadow-md shadow-blue-100">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{courseTitle || "Course"}</h1>
                {courseCode && (
                  <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                    {courseCode}
                  </span>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-800">{totalCount}</p>
                    <p className="text-xs text-gray-400">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{gradedCount}</p>
                    <p className="text-xs text-gray-400">Graded</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-500">{pendingCount}</p>
                    <p className="text-xs text-gray-400">Pending</p>
                  </div>
                </div>
              </div>

              {/* Sidebar filters */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Filter</p>
                <div className="flex flex-col gap-0.5">
                  <FilterPill value="all"        label="All Posts"    icon={Layers}     compact />
                  <FilterPill value="activities" label="Activities"   icon={LayoutList} compact />
                  <FilterPill value="materials"  label="Materials"    icon={BookOpen}   compact />
                </div>
              </div>

            </aside>

            {/* ══ Feed ══ */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 sm:px-0 py-4 lg:py-0 space-y-4">

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24">
                    <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
                    <p className="text-muted-foreground text-sm">Loading feed…</p>
                  </div>
                ) : feed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      {filter === "activities" ? (
                        <ClipboardList className="h-10 w-10 text-gray-300" />
                      ) : filter === "materials" ? (
                        <FileIcon className="h-10 w-10 text-gray-300" />
                      ) : (
                        <Layers className="h-10 w-10 text-gray-300" />
                      )}
                    </div>
                    <p className="text-lg font-semibold text-gray-400">Nothing here yet</p>
                    <p className="text-sm text-gray-400 mt-1">Your teacher will post content soon.</p>
                  </div>
                ) : (
                  feed.map(item =>
                    item._feedType === "activity"
                      ? <ActivityCard key={`act-${item.id}`} item={item} />
                      : <MaterialCard key={`mat-${item.id}`} item={item} />
                  )
                )}

              </div>
            </div>

          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default StudentCourseManagement;
