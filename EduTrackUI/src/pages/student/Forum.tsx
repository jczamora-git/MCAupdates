import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Users,
  Search,
  Plus,
  Pin,
  Clock,
  ThumbsUp,
  MessageCircle,
  Tag,
  Share2,
  Ellipsis,
} from "lucide-react";

const mockPosts = [
  {
    id: 1,
    title: "Parent reminder: Activity photo submission checklist",
    author: "Mrs. Angela M.",
    role: "Parent",
    section: "ENGL-G2 Family",
    content:
      "For shared accounts, here is our home checklist before upload: clear lighting, child name on paper, and one final photo check.",
    category: "Parent Corner",
    likes: 22,
    replies: 11,
    createdAt: "1h ago",
    pinned: true,
  },
  {
    id: 2,
    title: "Student question: Can we upload JPG and PNG in one submission?",
    author: "Joshua P.",
    role: "Student",
    section: "ENGL-G2",
    content: "I can see one file in preview only. Is this normal for mixed file types? Parents and classmates, please share what worked for you.",
    category: "Q&A",
    likes: 10,
    replies: 15,
    createdAt: "4h ago",
    pinned: false,
  },
  {
    id: 3,
    title: "Family study hour ideas for Grade 2 learners",
    author: "Mr. Carlo D.",
    role: "Parent",
    section: "Community",
    content: "Sharing our routine: 20-minute reading, 10-minute drawing, then upload check together. Open to suggestions from students and parents.",
    category: "General",
    likes: 31,
    replies: 19,
    createdAt: "1d ago",
    pinned: false,
  },
  {
    id: 4,
    title: "School update: Posting etiquette for shared accounts",
    author: "Teacher Maria",
    role: "Teacher",
    section: "Faculty",
    content: "Please use respectful language and include whether the post is from the parent or student when using a shared account.",
    category: "School Updates",
    likes: 29,
    replies: 9,
    createdAt: "2d ago",
    pinned: true,
  },
  {
    id: 5,
    title: "Student tip: Make instructions easier to follow",
    author: "Bea C.",
    role: "Student",
    section: "ENGL-G2",
    content: "I copy the instructions into a notebook and check each line before uploading. It helps me and my mom avoid missing steps.",
    category: "Student Corner",
    likes: 18,
    replies: 7,
    createdAt: "2d ago",
    pinned: false,
  },
];

const filters = ["All", "Parent Corner", "Student Corner", "School Updates", "Q&A", "General"] as const;

type ForumFilter = (typeof filters)[number];

const getRoleStyles = (role: string) => {
  if (role === "Parent") {
    return {
      chip: "bg-rose-50 text-rose-700 border-rose-200",
      avatar: "from-rose-500 to-pink-500",
    };
  }

  if (role === "Student") {
    return {
      chip: "bg-blue-50 text-blue-700 border-blue-200",
      avatar: "from-blue-500 to-cyan-500",
    };
  }

  return {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    avatar: "from-emerald-500 to-teal-500",
  };
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const StudentForum = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<ForumFilter>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "student") {
      navigate("/auth");
    }
  }, [isAuthenticated, user, navigate]);

  const filteredPosts = useMemo(() => {
    return mockPosts.filter((post) => {
      const matchesFilter = activeFilter === "All" || post.category === activeFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        post.author.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, search]);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 px-2 py-3 sm:p-5 md:p-7">
        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 leading-tight">MCA Community Forum</h1>
                  <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 hidden sm:block">Shared parent-student community feed</p>
                  <p className="text-[10px] text-gray-500 sm:hidden">Parent-student community</p>
                </div>
              </div>
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm flex-shrink-0">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Post</span>
              </Button>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0">
                {getInitials(user?.name || "Shared User")}
              </div>
              <button
                type="button"
                className="w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-xs sm:text-sm text-gray-500 transition-colors"
              >
                <span className="hidden sm:inline">Share a question or tip for parents and students...</span>
                <span className="sm:hidden">Share a question or tip...</span>
              </button>
            </div>

            <div className="mt-2.5 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
              <div className="text-[10px] sm:text-xs text-gray-500 inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-gray-50 border border-gray-200">
                Parent + Student shared account
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500 inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-gray-50 border border-gray-200">
                School-safe mockup data
              </div>
            </div>

            <div className="mt-3 sm:mt-4 flex flex-col md:flex-row gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search community posts..."
                  className="w-full h-9 sm:h-10 pl-8 sm:pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold rounded-full whitespace-nowrap border transition-colors ${
                      activeFilter === filter
                        ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {filteredPosts.map((post) => {
              const roleStyles = getRoleStyles(post.role);
              return (
                <article key={post.id} className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 shadow-sm">
                  {post.pinned && (
                    <div className="mb-2 text-[10px] sm:text-[11px] font-semibold text-amber-700 inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-amber-50 border border-amber-200">
                      <Pin className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      Pinned Post
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r ${roleStyles.avatar} text-white flex items-center justify-center text-[10px] sm:text-xs font-bold flex-shrink-0`}>
                        {getInitials(post.author)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                          <h2 className="text-xs sm:text-sm md:text-[15px] font-semibold text-gray-900">{post.author}</h2>
                          <span className={`px-1.5 sm:px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-medium ${roleStyles.chip}`}>
                            {post.role}
                          </span>
                        </div>

                        <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1 sm:gap-1.5 flex-wrap">
                          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span>{post.createdAt}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{post.section}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      title="Post options"
                      aria-label="Post options"
                      className="p-1 sm:p-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
                    >
                      <Ellipsis className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  </div>

                  <div className="mt-2.5 sm:mt-3">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight mb-1.5 sm:mb-2">{post.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{post.content}</p>

                    <div className="mt-2.5 sm:mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-500">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-100 text-blue-700">
                          <ThumbsUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </span>
                        {post.likes} reactions
                      </div>

                      <div className="inline-flex items-center gap-2 sm:gap-3 flex-wrap">
                        <span>{post.replies} comments</span>
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full border border-blue-100 bg-blue-50 text-blue-700">
                          <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          {post.category}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-gray-100 grid grid-cols-3 gap-1 sm:gap-2">
                      <button type="button" className="h-8 sm:h-9 rounded-lg text-[11px] sm:text-xs font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-colors">
                        <ThumbsUp className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden xs:inline">Like</span>
                      </button>
                      <button type="button" className="h-8 sm:h-9 rounded-lg text-[11px] sm:text-xs font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-colors">
                        <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden xs:inline">Comment</span>
                      </button>
                      <button type="button" className="h-8 sm:h-9 rounded-lg text-[11px] sm:text-xs font-medium text-gray-600 hover:bg-gray-100 active:bg-gray-200 inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-colors">
                        <Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        <span className="hidden xs:inline">Share</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredPosts.length === 0 && (
              <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6 sm:p-8 text-center text-xs sm:text-sm text-gray-500">
                No community posts found for this filter/search.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentForum;
