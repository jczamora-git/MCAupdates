import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "@/hooks/use-sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { NotificationBell } from "./NotificationBell";
import { CompactLanguageSelector } from "./LanguageSelector";
import { FEATURES } from "@/config/features";
import { isProductionDeployment } from "@/config/deployEnv";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { usePaymentNotificationCount, useEnrollmentNotificationCount, usePaymentPlanNotificationCount } from "@/hooks/useNotifications";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  Bell,
  FileText,
  Settings,
  ChevronLeft,
  ChevronDown,
  LogOut,
  BarChart3,
  ClipboardList,
  Award,
  Calendar,
  BookOpen,
  Grid3x3,
  Sun,
  Moon,
  Monitor,
  Mail,
  MessageSquare,
  Menu,
  X,
  Coins,
  CalendarClock,
  Radio,
  Shirt,
  Bus,
  Package,
  TrendingUp,
  ChevronRight,
  DollarSign,
  BarChart2,
  Megaphone,
  Wrench
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive?: boolean;
  badgeCount?: number;
}

const ChatbotIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 469.2 461.6"
    className={className}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M376.6,133.9l-23.7,3.7c-6.2,1-12.5,1.4-18.8,1.4c-8.2,0-16.4-0.8-24.3-2.5c-20.4-4.2-34.5-12.8-42.7-19.3l-32.4-25.4l-32.3,25.4c-8.2,6.5-22.3,15.1-42.7,19.3c-7.9,1.6-16.1,2.5-24.3,2.5c-6.3,0-12.7-0.5-18.8-1.4l-23.7-3.7l-66.4,50.6v104.1c0,4.9,0.3,9.7,0.8,14.6c4.6,41.3,28.9,80.2,68.1,108.5c0.9,0.7,1.9,1.4,2.9,2c48.1,33.6,102,43.9,129.9,47.1l6.7,0.8l6.7-0.8c27.9-3.2,81.8-13.5,129.9-47.1c1-0.7,2-1.4,2.9-2.1c43.8-31.6,69-76.5,69-123.1V184.5L376.6,133.9L376.6,133.9z M413,288.7c0,40.4-21.7,79.2-59.6,106.5c-0.8,0.6-1.7,1.2-2.5,1.8c-42.2,29.5-89.6,38.6-114,41.4l-2.2,0.2l-2.2-0.2c-24.5-2.8-71.8-11.9-114.1-41.4c-0.8-0.6-1.7-1.2-2.5-1.8c-33.3-24-54.2-57-58.7-92.1c-0.6-4.8-0.9-9.6-0.9-14.4V194l46.2-35.2l7.9,1.2c8.1,1.3,16.5,1.9,24.8,1.9c10.9,0,21.7-1.1,32.2-3.3c27-5.6,45.6-16.9,56.4-25.5l10.8-8.5l10.8,8.5c10.9,8.5,29.4,19.9,56.4,25.5c10.5,2.2,21.3,3.3,32.2,3.3c8.3,0,16.7-0.6,24.8-1.9l7.9-1.2L413,194L413,288.7L413,288.7z" />
    <path d="M443,210.9L443,210.9c14.5,0,26.2,11.7,26.2,26.2V277c0,14.5-11.7,26.2-26.2,26.2h0c-14.5,0-26.2-11.7-26.2-26.2v-39.9C416.8,222.7,428.5,210.9,443,210.9z" />
    <path d="M26.2,210.9L26.2,210.9c14.5,0,26.2,11.7,26.2,26.2V277c0,14.5-11.7,26.2-26.2,26.2l0,0C11.7,303.3,0,291.5,0,277v-39.9C0,222.7,11.7,210.9,26.2,210.9z" />
    <circle cx="153" cy="256.3" r="55.8" />
    <circle cx="234.6" cy="33.8" r="33.8" />
    <circle cx="316.2" cy="256.3" r="55.8" />
    <path d="M234.4,374.6c-12.2,0-24.4-3-36.1-9.2c-2.3-1.2-3-4.1-1.7-6.3l0,0c1.2-2.1,3.9-2.8,6-1.7c20.8,10.9,42.8,10.9,64.1,0c2.1-1.1,4.8-0.4,6,1.7l0,0c1.3,2.2,0.5,5.1-1.8,6.2C259,371.6,246.6,374.6,234.4,374.6L234.4,374.6z" />
    <polygon points="254.7,116.7 216.4,116.7 226.3,55.8 244.8,55.8" />
  </svg>
);

const SidebarItem = ({ icon, label, href, isActive, badgeCount }: SidebarItemProps) => {
  const navigate = useNavigate();
  const { isOpen } = useSidebar();
  return (
    <button
      onClick={() => navigate(href)}
      className={cn(
        "w-full flex items-center gap-2 p-1.5 sm:p-2 rounded-lg transition-all text-xs sm:text-sm relative",
        isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/80",
        !isOpen && "justify-center"
      )}
    >
      <div className="relative">
        {icon}
        {/* Small circular badge on icon (same style as notification bell) */}
        {!isOpen && badgeCount != null && badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full min-w-[16px] h-[16px] text-[9px] flex items-center justify-center font-bold shadow-sm border border-background">
            {badgeCount > 9 ? '9' : badgeCount}
          </span>
        )}
      </div>
      {isOpen && <span className="truncate hidden sm:inline flex-1 text-left">{label}</span>}
      {/* Circular badge for open sidebar (matches notification bell style) */}
      {isOpen && badgeCount != null && badgeCount > 0 && (
        <span className="ml-auto bg-red-500 text-white rounded-full min-w-[18px] h-[18px] px-1.5 text-[10px] flex items-center justify-center font-bold shadow-sm">
          {badgeCount > 99 ? '99' : badgeCount}
        </span>
      )}
    </button>
  );
};

export const Sidebar = () => {
  const { isOpen, toggle } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'academic': true,
    'finance': true,
    'services': true,
    'communication': true,
    'tools': true
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  
  // Mutual exclusive toggle logic
  const handleMobileMenuOpen = () => {
    setMobileMenuOpen(true);
    setNotificationOpen(false);
    setLanguageOpen(false);
  };
  
  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };
  
  const handleNotificationOpen = () => {
    setNotificationOpen(true);
    setMobileMenuOpen(false);
    setLanguageOpen(false);
  };
  
  const handleNotificationClose = () => {
    setNotificationOpen(false);
  };
  
  const handleLanguageOpen = () => {
    setLanguageOpen(true);
    setMobileMenuOpen(false);
    setNotificationOpen(false);
  };
  
  const handleLanguageClose = () => {
    setLanguageOpen(false);
  };

  const [isTeacherAdviser, setIsTeacherAdviser] = useState(() => {
    try {
      const cached = localStorage.getItem('adviserLevels');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return true;
        }
      }
    } catch (err) {
      // ignore cache errors
    }

    try {
      return localStorage.getItem('isTeacherAdviser') === 'true';
    } catch (err) {
      return false;
    }
  });

  // Fetch payment notification count for admin
  const { data: paymentNotifCount } = usePaymentNotificationCount({
    enabled: user?.role === 'admin'
  });
  const paymentBadgeCount = paymentNotifCount?.count ?? 0;

  // Fetch enrollment notification count for admin
  const { data: enrollmentNotifCount } = useEnrollmentNotificationCount({
    enabled: user?.role === 'admin'
  });
  const enrollmentBadgeCount = enrollmentNotifCount?.count ?? 0;

  // Fetch payment plan notification count for admin
  const { data: paymentPlanNotifCount } = usePaymentPlanNotificationCount({
    enabled: user?.role === 'admin'
  });
  const paymentPlanBadgeCount = paymentPlanNotifCount?.count ?? 0;

  // Check if any admin submenu is active (includes the main users page)
  const isAdminSubmenuActive = location.pathname.startsWith('/admin/users');

  // Auto-expand submenu if active; collapse by default
  const isManageUsersExpanded = expandedMenus['/admin/users'] ?? isAdminSubmenuActive;

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-5 w-5" />;
      case 'dark':
        return <Moon className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light Mode';
      case 'dark':
        return 'Dark Mode';
      default:
        return 'System';
    }
  };

  const handleLogout = () => {
    try {
      logout();
    } catch (e) {
      localStorage.removeItem("token");
      navigate("/auth");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const hasCache = isTeacherAdviser === true;

    const checkAdviser = async () => {
      if (user?.role !== "teacher") {
        setIsTeacherAdviser(false);
        return;
      }

      try {
        const res = await apiGet(API_ENDPOINTS.TEACHER_ADVISER_LEVELS);
        const levels = res && Array.isArray(res.levels) ? res.levels : [];
        if (!cancelled) {
          const isAdviser = levels.length > 0;
          setIsTeacherAdviser(isAdviser);
          try {
            localStorage.setItem('isTeacherAdviser', isAdviser ? 'true' : 'false');
            localStorage.setItem('adviserLevels', JSON.stringify(levels));
          } catch (err) {
            // ignore storage errors
          }
        }
      } catch (err) {
        if (!cancelled && !hasCache) setIsTeacherAdviser(false);
      }
    };

    checkAdviser();

    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  const isProd = isProductionDeployment;

  // Organized menu structure with sections
  const adminMenuSections = [
    {
      id: 'main',
      label: 'MAIN',
      icon: LayoutDashboard,
      collapsible: false,
      items: [
        { to: "/admin/dashboard", icon: BarChart3, label: "Dashboard" }
      ]
    },
    {
      id: 'academic',
      label: 'ACADEMIC MANAGEMENT',
      icon: GraduationCap,
      collapsible: true,
      items: [
        { to: "/admin/users", icon: Users, label: "Manage Users", hasSubmenu: true },
        ...(FEATURES.enrollment ? [{ to: "/admin/enrollments", icon: ClipboardList, label: "Enrollments" }] : []),
        ...(FEATURES.grading ? [{ to: "/teacher/grades", icon: Award, label: "Grade Input" }] : [])
      ]
    },
    {
      id: 'finance',
      label: 'FINANCE',
      icon: DollarSign,
      collapsible: true,
      items: [
        ...(FEATURES.payment ? [{ to: "/admin/payments", icon: Coins, label: "Payments" }] : []),
        ...(FEATURES.payment ? [{ to: "/admin/payment-plans", icon: CalendarClock, label: "Payment Plans" }] : [])
      ]
    },
    {
      id: 'services',
      label: 'SERVICES',
      icon: Wrench,
      collapsible: true,
      items: [
        ...(FEATURES.payment ? [{ to: "/admin/uniform-orders", icon: Shirt, label: "Uniform Orders" }] : []),
        ...(FEATURES.payment ? [{ to: "/admin/school-services", icon: Bus, label: "School Services" }] : []),
        ...(FEATURES.attendance ? [{ to: "/admin/rfid-attendance", icon: Radio, label: "RFID Scanner" }] : [])
      ]
    },
    {
      id: 'communication',
      label: 'COMMUNICATION',
      icon: Megaphone,
      collapsible: true,
      items: [
        ...(FEATURES.announcements ? [{ to: "/admin/announcements", icon: Bell, label: "Announcements" }] : []),
        { to: "/admin/sentiment", icon: MessageSquare, label: "Concerns" }
      ]
    },
    {
      id: 'tools',
      label: 'ADVANCED TOOLS',
      icon: TrendingUp,
      collapsible: true,
      items: [
        ...(FEATURES.reports ? [{ to: "/admin/reports", icon: BarChart2, label: "Reports" }] : []),
        ...(FEATURES.analytics ? [{ to: "/admin/predictive-analytics", icon: TrendingUp, label: "Predictive Analytics" }] : []),
        // ...(!isProd ? [{ to: "/admin/chatbot-knowledge", icon: ChatbotIcon, label: "Chatbot Knowledge" }] : []),
      ]
    }
  ].filter(section => section.items.length > 0); // Filter out empty sections

  // Flatten for legacy compatibility (teacher/student/enrollee links still use flat structure)
  const adminLinks = adminMenuSections.flatMap(section => section.items);

  const teacherLinks = [
    { to: "/teacher/dashboard", icon: BarChart3, label: "Dashboard" },
    ...(FEATURES.adviserEnrollment && isTeacherAdviser ? [{ to: "/admin/enrollments", icon: ClipboardList, label: "Enrollments" }] : []),
    ...(FEATURES.courses ? [{ to: "/teacher/courses", icon: BookOpen, label: "My Courses" }] : []),
    ...(FEATURES.messages ? [{ to: "/teacher/messages", icon: Mail, label: "Messages" }] : []),
    ...(FEATURES.activities ? [{ to: "/teacher/activities", icon: ClipboardList, label: "Activities" }] : []),
    ...(FEATURES.attendance ? [{ to: "/teacher/attendance", icon: Calendar, label: "Attendance" }] : []),
    ...(FEATURES.grading ? [{ to: "/teacher/grades", icon: Award, label: "Grade Input" }] : []),
    ...(FEATURES.announcements ? [{ to: "/teacher/announcements", icon: Bell, label: "Announcements" }] : []),
  ];

  const studentLinks = [
    { to: "/student/dashboard", icon: BarChart3, label: "Dashboard" },
    ...(FEATURES.courses && !isProd ? [{ to: "/student/courses", icon: BookOpen, label: "My Courses" }] : []),
    ...(FEATURES.enrollment ? [{ to: "/enrollment/my-enrollments", icon: FileText, label: "My Enrollments" }] : []),
    ...(FEATURES.grading ? [{ to: "/student/grades", icon: Award, label: "My Grades" }] : []),
    ...(FEATURES.payment ? [{ to: "/enrollment/payment", icon: Coins, label: "Payment" }] : []),
    // ...(FEATURES.messages ? [{ to: "/student/messages", icon: Mail, label: "Messages" }] : []),
    // ...(!isProd ? [{ to: "/student/forum", icon: Users, label: "Forum" }] : []),
    { to: "/student/feedback", icon: MessageSquare, label: "Concerns" },
    { to: "/student/settings", icon: Settings, label: "Settings" },
  ];

  const enrolleeLinks = [
    { to: "/enrollee/dashboard", icon: BarChart3, label: "Dashboard" },
    ...(FEATURES.enrollment ? [{ to: "/enrollee/enrollment", icon: FileText, label: "Enrollment" }] : []),
    ...(FEATURES.payment ? [{ to: "/enrollee/payment", icon: Award, label: "Payment" }] : []),
  ];

  // Determine links from the authenticated user's role. If no role, return an empty list.
  const links = (() => {
    const role = user?.role;
    switch (role) {
      case "admin":
        return adminLinks;
      case "teacher":
        return teacherLinks;
      case "student":
        return studentLinks;
      case "enrollee":
        return enrolleeLinks;
      default:
        return [];
    }
  })();

  const mobileAdminLinks = [
    { to: "/admin/dashboard", label: "Dashboard", subtitle: "Overview and key metrics", icon: BarChart3 },
    { to: "/admin/users", label: "User Directory", subtitle: "Browse all user accounts", icon: Users },
    ...(FEATURES.teacherManagement ? [{ to: "/admin/users/teachers", label: "Manage Teachers", subtitle: "Assign and maintain faculty", icon: School }] : []),
    { to: "/admin/users/students", label: "Manage Students", subtitle: "Maintain learner profiles", icon: Users },
    ...(FEATURES.subjects ? [{ to: "/admin/users/subjects", label: "Manage Subjects", subtitle: "Organize subject offerings", icon: BookOpen }] : []),
    { to: "/admin/users/sections", label: "Manage Sections", subtitle: "Arrange class groupings", icon: Grid3x3 },
    ...(FEATURES.enrollment ? [{ to: "/admin/enrollments", label: "Enrollments", subtitle: "Review student applications", icon: ClipboardList }] : []),
    ...(FEATURES.grading ? [{ to: "/teacher/grades", label: "Grade Input", subtitle: "Encode and submit grades", icon: Award }] : []),
    ...(FEATURES.payment ? [{ to: "/admin/payments", label: "Payments", subtitle: "Track and managepayments", icon: Coins }] : []),
    ...(FEATURES.payment ? [{ to: "/admin/payment-plans", label: "Payment Plans", subtitle: "Manage tuition installment plans", icon: CalendarClock }] : []),
    ...(FEATURES.payment ? [{ to: "/admin/uniform-orders", label: "Uniform Orders", subtitle: "Process uniform requests", icon: Shirt }] : []),
    ...(FEATURES.payment ? [{ to: "/admin/school-services", label: "School Services", subtitle: "Handle recurring services", icon: Bus }] : []),
    ...(FEATURES.attendance ? [{ to: "/admin/rfid-attendance", label: "RFID Scanner", subtitle: "Monitor attendance scans", icon: Radio }] : []),
    ...(FEATURES.announcements ? [{ to: "/admin/announcements", label: "Announcements", subtitle: "Post school-wide notices", icon: Bell }] : []),
    { to: "/admin/sentiment", label: "Concerns", subtitle: "Review concerns and suggestions", icon: MessageSquare },
    ...(FEATURES.reports ? [{ to: "/admin/reports", label: "Reports", subtitle: "Export operational reports", icon: BarChart2 }] : []),
    ...(FEATURES.analytics ? [{ to: "/admin/predictive-analytics", label: "Predictive Analytics", subtitle: "View trend projections", icon: TrendingUp }] : []),
    ...(!isProd ? [{ to: "/admin/chatbot-knowledge", label: "Chatbot Knowledge", subtitle: "Maintain chatbot content", icon: ChatbotIcon }] : []),
  ];

  const getMobileBadgeCount = (path: string) => {
    if (path === '/admin/payments') return paymentBadgeCount;
    if (path === '/admin/enrollments') return enrollmentBadgeCount;
    if (path === '/admin/payment-plans') return paymentPlanBadgeCount;
    return 0;
  };

  const getMobileDescription = (path: string, label?: string) => {
    if (path.includes('/payments') || path.includes('/payment-plans')) return 'Manage transactions and billing';
    if (path.includes('/users')) return 'Manage accounts and access';
    if (path.includes('/enrollments')) return 'Review student applications';
    if (path.includes('/rfid')) return 'Track attendance activity';
    if (path.includes('/announcements') || path.includes('/sentiment')) return 'Handle communication tools';
    if (path.includes('/grades')) return 'Access grading workspace';
    if (path.includes('/courses')) return 'View class materials and tasks';
    if (path.includes('/settings')) return 'Adjust account preferences';
    if (path.includes('/dashboard')) return 'View overview and snapshots';
    return label ? `Open ${label}` : 'Open module';
  };

  const mobileLinks = user?.role === 'admin'
    ? mobileAdminLinks
    : links.map((link) => ({
        to: link.to,
        label: link.label,
        icon: link.icon,
        subtitle: getMobileDescription(link.to, link.label)
      }));

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div
        id="mobile-top-navbar"
        data-mobile-header="true"
        className="md:hidden fixed top-0 left-0 right-0 bg-background border-b border-border z-30 px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="Maranatha Christian Academy Foundation" className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 font-montserrat leading-[1.1]">Maranatha Christian</p>
            <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 font-montserrat leading-[0.9]">Academy Foundation</p>
            <p className="text-[10px] font-normal text-slate-600 dark:text-slate-400 font-montserrat leading-[1.1]">Calapan City Inc.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <CompactLanguageSelector 
            isOpen={languageOpen}
            onOpenChange={(open) => open ? handleLanguageOpen() : handleLanguageClose()}
          />
          <NotificationBell 
            isOpen={notificationOpen}
            onOpenChange={(open) => open ? handleNotificationOpen() : handleNotificationClose()}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => mobileMenuOpen ? handleMobileMenuClose() : handleMobileMenuOpen()}
            className="hover:bg-muted"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Fullscreen Menu */}
      {mobileMenuOpen && (
      <div
        className="md:hidden fixed top-14 left-0 right-0 bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border overflow-y-auto"
      >
        <div className="p-4">
          <div className="space-y-2">
            {mobileLinks.map((link) => {
              const isActive = location.pathname === link.to || location.pathname.startsWith(link.to + "/");
              const badgeCount = getMobileBadgeCount(link.to);
              const Icon = link.icon as any;
              const description = link.subtitle || getMobileDescription(link.to, link.label);

              return (
                <button
                  key={link.to}
                  onClick={() => {
                    navigate(link.to);
                    handleMobileMenuClose();
                  }}
                  className={cn(
                    "group relative w-full rounded-xl border px-3 py-3 text-left shadow-sm transition-all",
                    isActive
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-950/35 dark:border-blue-800"
                      : "bg-card border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-9 w-9 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-300"
                    )}>
                      {Icon ? <Icon className="h-4.5 w-4.5" /> : <Grid3x3 className="h-4.5 w-4.5" />}
                    </div>
                    <div className="pr-5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block text-base font-semibold leading-tight break-words text-blue-700 dark:text-blue-300">
                          {link.label}
                        </span>
                        {badgeCount > 0 && (
                          <span className="bg-red-500 text-white rounded-full min-w-[20px] h-[20px] px-1.5 text-[10px] flex items-center justify-center font-bold shadow-sm shrink-0">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400 break-words">{description}</span>
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4",
                    isActive ? "text-blue-500 dark:text-blue-300" : "text-blue-400 dark:text-blue-500"
                  )} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t p-4 space-y-2 text-center">
          <button
            onClick={cycleTheme}
            className="w-full p-2 rounded-lg text-base text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
          >
            <span>{getThemeLabel()}</span>
          </button>
          <button
            onClick={() => {
              handleLogout();
              handleMobileMenuClose();
            }}
            className="w-full p-2 rounded-lg text-base text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          >
            <span>Logout</span>
          </button>
        </div>
      </div>
      )}

      {/* Desktop Sidebar */}
      <div
        className={cn(
          "hidden md:flex sticky top-0 h-screen bg-background border-r border-border flex-col transition-all duration-300 z-20",
          isOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-4 sm:p-6 flex justify-between items-center">
          {isOpen && (
            <div className="flex items-center gap-2 w-full">
              <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="Maranatha Christian Academy Foundation" className="h-6 w-6 flex-shrink-0" />
              <div className="leading-tight flex-1 min-w-0">
                <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate font-montserrat leading-[1.1]">Maranatha Christian</p>
                <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate font-montserrat leading-[1.1]">Academy Foundation</p>
                <p className="text-[10px] font-normal text-slate-600 dark:text-slate-400 truncate font-montserrat leading-[1.1]">Calapan City INC.</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="hover:bg-muted"
          >
            <ChevronLeft className={cn("h-5 sm:h-6 w-5 sm:w-6", !isOpen && "rotate-180")} />
          </Button>
        </div>

        <div className="flex-1 px-2 sm:px-4 space-y-1 overflow-y-auto">
          {user?.role === "admin" ? (
            // Admin role: Use organized sections
            adminMenuSections.map((section) => {
              const SectionIcon = section.icon as any;
              const isSectionExpanded = section.collapsible ? (expandedSections[section.id] ?? true) : true;

              return (
                <div key={section.id} className="space-y-1">
                  {isOpen ? (
                    section.collapsible ? (
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                      >
                        <SectionIcon className="h-3 w-3" />
                        <span className="flex-1 text-left hidden sm:inline">{section.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 transition-transform duration-200 hidden sm:block",
                            isSectionExpanded ? "rotate-0" : "-rotate-90"
                          )}
                        />
                      </button>
                    ) : (
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <span className="hidden sm:inline">{section.label}</span>
                      </div>
                    )
                  ) : (
                    <div className="h-px bg-border my-2" />
                  )}

                  <div
                    className={cn(
                      "space-y-1 overflow-hidden transition-all duration-300 ease-in-out",
                      isOpen && section.collapsible && !isSectionExpanded ? "max-h-0 opacity-0" : "max-h-[1000px] opacity-100"
                    )}
                  >
                    {section.items.map((link) => {
                      const Icon = link.icon as any;
                      const isActive = location.pathname === link.to || location.pathname.startsWith(link.to + "/");
                      const isManageUsers = link.hasSubmenu && link.to === "/admin/users";
                      const isMenuExpanded = isManageUsers ? isManageUsersExpanded : expandedMenus[link.to] ?? true;

                      return (
                        <div key={link.to}>
                          {isManageUsers && user?.role === "admin" && isOpen ? (
                            <button
                              onClick={() => {
                                toggleMenu(link.to);
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 p-1.5 sm:p-2 rounded-lg transition-all text-xs sm:text-sm",
                                isActive || isAdminSubmenuActive ? "bg-primary/10 text-primary" : "hover:bg-muted/80"
                              )}
                            >
                              <Icon className="h-4 sm:h-5 w-4 sm:w-5" />
                              <span className="truncate flex-1 text-left hidden sm:inline">{link.label}</span>
                              <ChevronDown
                                className={cn(
                                  "h-3 sm:h-4 w-3 sm:w-4 transition-transform duration-300 hidden sm:block",
                                  isMenuExpanded ? "rotate-0" : "-rotate-90"
                                )}
                              />
                            </button>
                          ) : (
                            <SidebarItem
                              icon={<Icon className="h-5 w-5" />}
                              label={link.label}
                              href={link.to}
                              isActive={isActive}
                              badgeCount={
                                link.to === '/admin/payments' ? paymentBadgeCount : 
                                link.to === '/admin/enrollments' ? enrollmentBadgeCount : 
                                link.to === '/admin/payment-plans' ? paymentPlanBadgeCount : 
                                undefined
                              }
                            />
                          )}

                          {isManageUsers && user?.role === "admin" && isOpen && (
                            <div
                              className={cn(
                                "overflow-hidden transition-all duration-300 ease-in-out",
                                isMenuExpanded ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
                              )}
                            >
                              <div className="mt-1 space-y-0.5 pl-4 sm:pl-6">
                                <button
                                  onClick={() => navigate('/admin/users')}
                                  className={cn(
                                    "w-full flex items-center gap-2 p-1.5 rounded-md text-xs sm:text-sm hover:bg-muted/80 transition-colors",
                                    location.pathname === '/admin/users' ? 'bg-primary/10 text-primary' : ''
                                  )}
                                >
                                  <Users className="h-3 sm:h-4 w-3 sm:w-4" />
                                  <span className="hidden sm:inline">User Directory</span>
                                </button>

                                {FEATURES.teacherManagement && (
                                  <button
                                    onClick={() => navigate('/admin/users/teachers')}
                                    className={cn(
                                      "w-full flex items-center gap-2 p-1.5 rounded-md text-xs sm:text-sm hover:bg-muted/80 transition-colors",
                                      location.pathname.startsWith('/admin/users/teachers') && !location.pathname.includes('assignments') ? 'bg-primary/10 text-primary' : ''
                                    )}
                                  >
                                    <School className="h-3 sm:h-4 w-3 sm:w-4" />
                                    <span className="hidden sm:inline">Manage Teachers</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => navigate('/admin/users/students')}
                                  className={cn(
                                    "w-full flex items-center gap-2 p-1.5 rounded-md text-xs sm:text-sm hover:bg-muted/80 transition-colors",
                                    location.pathname.startsWith('/admin/users/students') ? 'bg-primary/10 text-primary' : ''
                                  )}
                                >
                                  <Users className="h-3 sm:h-4 w-3 sm:w-4" />
                                  <span className="hidden sm:inline">Manage Students</span>
                                </button>

                                {FEATURES.subjects && (
                                  <button
                                    onClick={() => navigate('/admin/users/subjects')}
                                    className={cn(
                                      "w-full flex items-center gap-2 p-1.5 rounded-md text-xs sm:text-sm hover:bg-muted/80 transition-colors",
                                      location.pathname.startsWith('/admin/users/subjects') ? 'bg-primary/10 text-primary' : ''
                                    )}
                                  >
                                    <BookOpen className="h-3 sm:h-4 w-3 sm:w-4" />
                                    <span className="hidden sm:inline">Manage Subjects</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => navigate('/admin/users/sections')}
                                  className={cn(
                                    "w-full flex items-center gap-2 p-1.5 rounded-md text-xs sm:text-sm hover:bg-muted/80 transition-colors",
                                    location.pathname.startsWith('/admin/users/sections') ? 'bg-primary/10 text-primary' : ''
                                  )}
                                >
                                  <Grid3x3 className="h-3 sm:h-4 w-3 sm:w-4" />
                                  <span className="hidden sm:inline">Manage Sections</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            // Other roles: Use flat links structure
            links.map((link) => {
              const Icon = link.icon as any;
              const isActive = location.pathname === link.to || location.pathname.startsWith(link.to + "/");

              return (
                <SidebarItem
                  key={link.to}
                  icon={<Icon className="h-5 w-5" />}
                  label={link.label}
                  href={link.to}
                  isActive={isActive}
                />
              );
            })
          )}
        </div>

        <div className="border-t p-2 sm:p-4 space-y-0.5 sm:space-y-1">
          {!isProd && (
            <button
              onClick={cycleTheme}
              className={cn(
                "w-full flex items-center gap-2 p-1.5 sm:p-2 rounded-lg text-xs sm:text-sm text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all",
                !isOpen && "justify-center"
              )}
              title={isOpen ? undefined : getThemeLabel()}
            >
              {getThemeIcon()}
              {isOpen && <span className="hidden sm:inline">{getThemeLabel()}</span>}
            </button>
          )}

          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2 p-1.5 sm:p-2 rounded-lg text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all",
              !isOpen && "justify-center"
            )}
          >
            <LogOut className="h-4 sm:h-5 w-4 sm:w-5" />
            {isOpen && <span className="hidden sm:inline">Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
};