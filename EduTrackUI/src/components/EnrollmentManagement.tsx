import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, Search, Clock, AlertCircle, CheckCircle2, XCircle, Plus, FileText, Settings, ArrowRight, Users, UserPlus, FileCheck, RotateCcw, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, API_ENDPOINTS } from '@/lib/api';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import { useEnrollmentList, useAdviserLevels } from '@/hooks/useEnrollmentList';
import { useManilaTime } from '@/hooks/useManilaTime';
import { Pagination } from './Pagination';

interface EnrollmentData {
  id: number;
  student_name: string;
  grade_level: string;
  status: 'Pending' | 'Incomplete' | 'Under Review' | 'Verified' | 'Approved' | 'Rejected';
  submitted_date: string;
  
  // Enrollment Type
  enrollment_type?: 'New Student' | 'Continuing Student' | 'Returning Student' | 'Transferee';
  
  // Academic period info (from JOIN)
  school_year: string;
  quarter: '1st Quarter' | '2nd Quarter' | '3rd Quarter' | '4th Quarter';
  academic_period_id: number;
  
  // Document counts
  documents_count: number;
  documents_verified: number;
  documents_rejected?: number;
  formatted_student_id?: string | null;
  
  // Database tracking fields
  enrollment_period_id?: number | null;
  created_user_id?: number | null;
  created_student_id?: number | null;
  
  // Audit fields
  approved_date?: string | null;
  rejected_date?: string | null;
  rejection_reason?: string | null;
}

interface NotificationRow {
  id: number | string;
  entity_type?: string;
  entity_id?: number | string;
  action_url?: string;
}

const UNREAD_ENROLLMENT_NOTIFICATIONS_POLL_MS = 90 * 1000;

const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode; bgLight: string }> = {
  'Pending': {
    bg: 'bg-yellow-500',
    bgLight: 'bg-yellow-100',
    text: 'text-yellow-800',
    icon: <Clock className="w-4 h-4" />,
  },
  'Incomplete': {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-100',
    text: 'text-orange-800',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  'Under Review': {
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-100',
    text: 'text-blue-800',
    icon: <Clock className="w-4 h-4" />,
  },
  'Verified': {
    bg: 'bg-indigo-500',
    bgLight: 'bg-indigo-100',
    text: 'text-indigo-800',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  'Approved': {
    bg: 'bg-green-500',
    bgLight: 'bg-green-100',
    text: 'text-green-800',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  'Rejected': {
    bg: 'bg-red-500',
    bgLight: 'bg-red-100',
    text: 'text-red-800',
    icon: <XCircle className="w-4 h-4" />,
  },
};

// Status priority for sorting (lower number = higher priority/listed first)
const statusPriority: Record<string, number> = {
  'Pending': 1,
  'Incomplete': 2,
  'Under Review': 3,
  'Verified': 4,
  'Approved': 5,
  'Rejected': 6,
};

export const EnrollmentManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const highlightedEnrollmentRef = useRef<HTMLTableRowElement>(null);
  const { toIsoDate, parseBackendDate } = useManilaTime();
  
  const { user } = useRoleBasedAuth(['admin', 'teacher']);
  const isTeacher = user?.role === 'teacher';
  
  // Get highlighted enrollment ID from URL (from notification click)
  const highlightId = searchParams.get('highlight');
  const highlightedEnrollmentId = highlightId ? parseInt(highlightId) : null;
  
  // State
  const [activeAdviserLevel, setActiveAdviserLevel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'student_name' | 'grade_level' | 'enrollment_type' | 'school_year' | 'submitted_date' | 'documents' | 'status'>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showPaidFirst, setShowPaidFirst] = useState(false);
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [paidEnrollments, setPaidEnrollments] = useState<Set<number>>(new Set());
  const [enrollmentTypeModalOpen, setEnrollmentTypeModalOpen] = useState(false);
  const [selectedEnrollmentType, setSelectedEnrollmentType] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [unreadEnrollmentNotifications, setUnreadEnrollmentNotifications] = useState<NotificationRow[]>([]);
  const itemsPerPage = 20;

  // React Query hooks
  const { data: adviserLevelsData } = useAdviserLevels({ enabled: isTeacher });
  const { data: enrollments = [], isLoading: loading, refetch } = useEnrollmentList({
    userRole: user?.role,
    adviserLevel: isTeacher ? activeAdviserLevel : undefined,
    enabled: !!user && (!isTeacher || !!activeAdviserLevel),
  });

  // Set default adviser level for teachers
  useEffect(() => {
    if (isTeacher && adviserLevelsData && adviserLevelsData.length > 0 && !activeAdviserLevel) {
      setActiveAdviserLevel(adviserLevelsData[0]);
    }
  }, [isTeacher, adviserLevelsData, activeAdviserLevel]);

  // Scroll to and highlight the enrollment when URL param changes
  useEffect(() => {
    if (highlightedEnrollmentId && highlightedEnrollmentRef.current) {
      // Scroll to the highlighted row with smooth animation
      setTimeout(() => {
        highlightedEnrollmentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 300);

      // Remove highlight param after 5 seconds
      const timer = setTimeout(() => {
        setSearchParams((params) => {
          params.delete('highlight');
          return params;
        });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [highlightedEnrollmentId, setSearchParams]);

  const grades = ['Nursery 1', 'Nursery 2', 'Kinder', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
  const enrollmentTypes = ['New Student', 'Transferee', 'Returning Student', 'Continuing Student'];
  const adviserEnrollmentTypes = ['New Student', 'Transferee', 'Continuing Student'];
  const manualEntryOptions = isTeacher && activeAdviserLevel === 'Nursery 1'
    ? adviserEnrollmentTypes.filter(type => type !== 'Continuing Student')
    : (isTeacher ? adviserEnrollmentTypes : enrollmentTypes);

  const handleStartManualEntry = () => {
    if (!selectedEnrollmentType) {
      toast.error('Please select an enrollment type');
      return;
    }
    setEnrollmentTypeModalOpen(false);
    if (isTeacher) {
      navigate('/adviser/enrollments/new', { state: { enrollmentType: selectedEnrollmentType } });
      return;
    }
    navigate('/admin/enrollments/new', { state: { enrollmentType: selectedEnrollmentType } });
  };

  // Fetch payment status for enrollments
  const fetchPaymentStatuses = async (enrollmentIds: number[]) => {
    if (enrollmentIds.length === 0) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.PAYMENTS_BY_ENROLLMENT}?enrollment_ids=${enrollmentIds.join(',')}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          // Only include enrollments with Approved payment status
          const paidSet = new Set<number>(
            data.data
              .filter((p: any) => p.status === 'Approved')
              .map((p: any) => Number(p.enrollment_id))
          );
          setPaidEnrollments(paidSet);
        }
      }
    } catch (error) {
      console.error('Error fetching payment statuses:', error);
    }
  };

  // Fetch payment statuses when enrollments change
  useEffect(() => {
    if (enrollments.length > 0) {
      const enrollmentIds = enrollments.map(e => e.id);
      fetchPaymentStatuses(enrollmentIds);
    }
  }, [enrollments]);

  const refreshUnreadEnrollmentNotifications = async () => {
    try {
      const res = await apiGet(`${API_ENDPOINTS.NOTIFICATIONS}?unread_only=true&limit=100`);
      const rows = Array.isArray(res?.data) ? res.data : [];
      const filtered = rows.filter((row: any) => {
        const entityType = String(row?.entity_type || '').toLowerCase();
        const actionUrl = String(row?.action_url || '').toLowerCase();
        return (
          (entityType === 'enrollment' || entityType === 'enrollments') &&
          actionUrl.includes('/admin/enrollments')
        );
      });
      setUnreadEnrollmentNotifications(filtered);
    } catch {
      setUnreadEnrollmentNotifications([]);
    }
  };

  useEffect(() => {
    refreshUnreadEnrollmentNotifications();

    const pollTimer = window.setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      refreshUnreadEnrollmentNotifications();
    }, UNREAD_ENROLLMENT_NOTIFICATIONS_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, []);

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch =
      String(enrollment.id).includes(searchQuery) ||
      (enrollment.student_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (enrollment.school_year?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      enrollment.grade_level.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter;
    const matchesGrade = gradeFilter === 'all' || enrollment.grade_level === gradeFilter;

    const submittedDateIso = toIsoDate(enrollment.submitted_date);
    const matchesDate = (!dateFromFilter || submittedDateIso >= dateFromFilter) &&
               (!dateToFilter || submittedDateIso <= dateToFilter);

    return matchesSearch && matchesStatus && matchesGrade && matchesDate;
  });

  const getGradeSortValue = (gradeLevel: string) => {
    const idx = grades.indexOf(gradeLevel);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };

  const sortedEnrollments = [...filteredEnrollments].sort((a, b) => {
    // If showPaidFirst is enabled, prioritize paid enrollments first.
    if (showPaidFirst) {
      const aPaid = paidEnrollments.has(a.id);
      const bPaid = paidEnrollments.has(b.id);
      if (aPaid && !bPaid) return -1;
      if (!aPaid && bPaid) return 1;
    }

    let comparison = 0;

    switch (sortField) {
      case 'student_name':
        comparison = (a.student_name || '').localeCompare(b.student_name || '');
        break;
      case 'grade_level':
        comparison = getGradeSortValue(a.grade_level) - getGradeSortValue(b.grade_level);
        break;
      case 'enrollment_type':
        comparison = (a.enrollment_type || 'New Student').localeCompare(b.enrollment_type || 'New Student');
        break;
      case 'school_year':
        comparison = (a.school_year || '').localeCompare(b.school_year || '', undefined, { numeric: true });
        break;
      case 'submitted_date':
        comparison = (parseBackendDate(a.submitted_date)?.getTime() || 0) - (parseBackendDate(b.submitted_date)?.getTime() || 0);
        break;
      case 'documents':
        comparison = (a.documents_verified || 0) - (b.documents_verified || 0);
        if (comparison === 0) {
          comparison = (a.documents_count || 0) - (b.documents_count || 0);
        }
        break;
      case 'status':
      default: {
        const statusPriorityA = statusPriority[a.status] || 999;
        const statusPriorityB = statusPriority[b.status] || 999;
        comparison = statusPriorityA - statusPriorityB;
        break;
      }
    }

    if (comparison !== 0) {
      return sortDirection === 'asc' ? comparison : -comparison;
    }

    // Stable tie-breaker: most recent submissions first.
    const dateA = parseBackendDate(a.submitted_date)?.getTime() || 0;
    const dateB = parseBackendDate(b.submitted_date)?.getTime() || 0;
    return dateB - dateA;
  });

  const handleSort = (field: 'student_name' | 'grade_level' | 'enrollment_type' | 'school_year' | 'submitted_date' | 'documents' | 'status') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection(field === 'submitted_date' ? 'desc' : 'asc');
  };

  const renderSortIcon = (field: 'student_name' | 'grade_level' | 'enrollment_type' | 'school_year' | 'submitted_date' | 'documents' | 'status') => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-foreground" />
      : <ChevronDown className="h-3.5 w-3.5 text-foreground" />;
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, gradeFilter, showPaidFirst, dateFromFilter, dateToFilter, sortField, sortDirection]);

  // Clamp currentPage to valid pages
  const totalItems = sortedEnrollments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedEnrollments = sortedEnrollments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const unreadEnrollmentNotificationsById = unreadEnrollmentNotifications.reduce((acc, notif) => {
    const key = String(notif.entity_id || '');
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(notif);
    return acc;
  }, {} as Record<string, NotificationRow[]>);

  const unreadHighlightedEnrollmentIds = new Set(Object.keys(unreadEnrollmentNotificationsById));

  const stats = {
    total: enrollments.length,
    pending: enrollments.filter(e => e.status === 'Pending').length,
    approved: enrollments.filter(e => e.status === 'Approved').length,
    rejected: enrollments.filter(e => e.status === 'Rejected').length,
  };

  if (!user) {
    return <div>Access Denied</div>;
  }

  const headerTitle = isTeacher && activeAdviserLevel
    ? `Enrollment Management for ${activeAdviserLevel}`
    : 'Enrollment Management';

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {headerTitle}
          </h1>
          <p className="text-muted-foreground text-lg">Review and approve student enrollments</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <>
              <Button
                onClick={() => navigate('/admin/enrollment-settings')}
                variant="outline"
                className="shadow-md hover:shadow-lg"
              >
                <Settings className="h-4 w-4 mr-2" />
                Enrollment Settings
              </Button>
              <Button
                onClick={() => setEnrollmentTypeModalOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl"
              >
                <Plus className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </>
          )}
          {user?.role === 'teacher' && (
            <Button
              onClick={() => {
                setSelectedEnrollmentType('');
                setEnrollmentTypeModalOpen(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-semibold">Total Enrollments</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                <Users className="h-6 w-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-semibold">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-200 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-semibold">Approved</p>
                <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-semibold">Rejected</p>
                <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-200 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6 border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, grade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Incomplete">Incomplete</SelectItem>
                <SelectItem value="Under Review">Under Review</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {grades.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              placeholder="From Date"
              className="w-[155px]"
            />

            <Input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              placeholder="To Date"
              className="w-[155px]"
            />

            <div className="flex items-center gap-2">
              <Switch
                id="show-paid-first"
                checked={showPaidFirst}
                onCheckedChange={setShowPaidFirst}
              />
              <Label htmlFor="show-paid-first" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                Paid
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setGradeFilter('all');
                setDateFromFilter('');
                setDateToFilter('');
                setShowPaidFirst(false);
              }}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="shadow-lg border-0">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Enrollment Records ({filteredEnrollments.length})
          </CardTitle>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground font-medium">Loading enrollments...</p>
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground font-medium">No enrollments found matching your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('student_name')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Student Name
                        {renderSortIcon('student_name')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('grade_level')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Grade Level
                        {renderSortIcon('grade_level')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('enrollment_type')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Type
                        {renderSortIcon('enrollment_type')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('school_year')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Academic Period
                        {renderSortIcon('school_year')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('submitted_date')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Submitted
                        {renderSortIcon('submitted_date')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('documents')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Documents
                        {renderSortIcon('documents')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                        Status
                        {renderSortIcon('status')}
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    return pagedEnrollments.map((enrollment) => {
                      const status = statusConfig[enrollment.status] || {
                        bg: 'bg-gray-500', 
                        bgLight: 'bg-gray-100', 
                        text: 'text-gray-800', 
                        icon: <AlertCircle className="w-4 h-4" />
                      };

                      const isHighlighted = highlightedEnrollmentId === enrollment.id;
                      const isUnreadFromNotification = unreadHighlightedEnrollmentIds.has(String(enrollment.id));
                      
                      return (
                        <tr 
                          key={enrollment.id} 
                          ref={isHighlighted ? highlightedEnrollmentRef : null}
                          className={`transition-all duration-500 ${
                            isHighlighted 
                              ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-l-primary' 
                              : isUnreadFromNotification
                                ? 'bg-amber-50/70 hover:bg-amber-100/60'
                                : 'hover:bg-muted/50'
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                  {enrollment.student_name}
                                  {isUnreadFromNotification && (
                                    <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-1.5 py-0 h-5">
                                      New
                                    </Badge>
                                  )}
                                </p>
                                {enrollment.formatted_student_id && (
                                  <p className="text-xs text-gray-500">ID: {enrollment.formatted_student_id}</p>
                                )} 
                                {isHighlighted && (
                                  <p className="text-xs font-medium text-primary mt-1">Selected from notification</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant="outline" className="text-xs font-medium">
                              {enrollment.grade_level}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className="text-xs font-semibold bg-blue-100 text-blue-800 border-blue-200">
                                {enrollment.enrollment_type || 'New Student'}
                              </Badge>
                              {paidEnrollments.has(enrollment.id) && enrollment.status !== 'Approved' && (
                                <Badge className="text-xs font-semibold bg-emerald-600 text-white">
                                  Paid
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">SY {enrollment.school_year}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{toIsoDate(enrollment.submitted_date) || '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {enrollment.enrollment_type === 'Continuing Student' ? (
                              <div className="flex items-center gap-2">
                                <FileCheck className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm font-semibold text-gray-600">Exempt</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <FileCheck className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-bold">
                                    {enrollment.documents_verified}/{enrollment.documents_count}
                                  </p>
                                  {enrollment.documents_rejected > 0 && (
                                    <p className="text-xs text-red-600 font-semibold">
                                      {enrollment.documents_rejected} rejected
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={`${status.bgLight} ${status.text} font-semibold flex items-center gap-1 w-fit`}>
                              {status.icon}
                              <span>{enrollment.status}</span>
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/enrollments/${enrollment.id}`)}
                              className="gap-2 font-medium"
                            >
                              <Eye className="h-4 w-4" />
                              Review
                            </Button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              {filteredEnrollments.length === 0 && (
                <div className="text-center py-16">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No enrollments found</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && totalItems > 0 && (
        <div className="mt-6 px-2">
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>
      )}

      {/* Enrollment Type Selection Modal */}
      <Dialog open={enrollmentTypeModalOpen} onOpenChange={setEnrollmentTypeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Select Enrollment Type</DialogTitle>
            <DialogDescription>
              Choose the type of enrollment for this manual entry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <RadioGroup
              value={selectedEnrollmentType}
              onValueChange={setSelectedEnrollmentType}
              className="space-y-3"
            >
              {manualEntryOptions.includes('New Student') && (
                <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType('New Student')}>
                  <RadioGroupItem value="New Student" id="new-student" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="new-student" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-blue-600" />
                      New Student
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">Brand new student enrolling for the first time</p>
                  </div>
                </div>
              )}

              {manualEntryOptions.includes('Transferee') && (
                <div className="flex items-start space-x-3 p-4 bg-purple-50 rounded-lg border-2 border-purple-200 hover:border-purple-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType('Transferee')}>
                  <RadioGroupItem value="Transferee" id="transferee" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="transferee" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      Transferee
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">Student transferring from another school</p>
                  </div>
                </div>
              )}

              {manualEntryOptions.includes('Returning Student') && (
                <div className="flex items-start space-x-3 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200 hover:border-indigo-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType('Returning Student')}>
                  <RadioGroupItem value="Returning Student" id="returning-student" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="returning-student" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Returning Student
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">Former student resuming studies after a period of absence</p>
                  </div>
                </div>
              )}

              {manualEntryOptions.includes('Continuing Student') && (
                <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg border-2 border-green-200 hover:border-green-400 transition-colors cursor-pointer" onClick={() => setSelectedEnrollmentType('Continuing Student')}>
                  <RadioGroupItem value="Continuing Student" id="continuing-student" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="continuing-student" className="text-base font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      Continuing / Old Students
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">Currently enrolled student proceeding to the next grade level</p>
                  </div>
                </div>
              )}
            </RadioGroup>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setEnrollmentTypeModalOpen(false);
                setSelectedEnrollmentType('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartManualEntry}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              disabled={!selectedEnrollmentType}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnrollmentManagement;
