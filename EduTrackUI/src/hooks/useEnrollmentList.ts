import { useQuery } from '@tanstack/react-query';
import { apiGet, API_ENDPOINTS } from '@/lib/api';

export interface EnrollmentListItem {
  id: number;
  student_name: string;
  grade_level: string;
  status: 'Pending' | 'Incomplete' | 'Under Review' | 'Verified' | 'Approved' | 'Rejected';
  submitted_date: string;
  enrollment_type?: 'New Student' | 'Continuing Student' | 'Returning Student' | 'Transferee';
  school_year: string;
  quarter: '1st Quarter' | '2nd Quarter' | '3rd Quarter' | '4th Quarter';
  academic_period_id: number;
  documents_count: number;
  documents_verified: number;
  documents_rejected?: number;
  formatted_student_id?: string | null;
  enrollment_period_id?: number | null;
  created_user_id?: number | null;
  created_student_id?: number | null;
  approved_date?: string | null;
  rejected_date?: string | null;
  rejection_reason?: string | null;
}

interface UseEnrollmentListOptions {
  userRole?: string;
  adviserLevel?: string;
  enabled?: boolean;
}

/**
 * React Query hook for fetching enrollment list
 * Provides automatic caching, refetching, and loading states
 */
export function useEnrollmentList(options: UseEnrollmentListOptions = {}) {
  const { userRole, adviserLevel, enabled = true } = options;

  return useQuery<EnrollmentListItem[]>({
    queryKey: ['enrollments', 'list', userRole, adviserLevel],
    queryFn: async () => {
      // Teacher/Adviser view - fetch by grade level
      if (userRole === 'teacher' && adviserLevel) {
        const response = await apiGet(API_ENDPOINTS.ADVISER_ENROLLMENTS(adviserLevel));
        
        if (response.success && Array.isArray(response.data)) {
          return response.data;
        } else if (Array.isArray(response.data)) {
          return response.data;
        }
        throw new Error('Failed to load enrollments');
      }

      // Admin view - fetch all enrollments
      const response = await apiGet(API_ENDPOINTS.ADMIN_ENROLLMENTS);
      
      if (response.success && Array.isArray(response.data)) {
        return response.data;
      } else if (Array.isArray(response.data)) {
        return response.data;
      }
      throw new Error('Failed to load enrollments');
    },
    staleTime: 60000, // Data fresh for 60 seconds
    refetchInterval: 60000, // Auto-refresh every 60 seconds
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true, // Refresh when user returns to tab
    enabled, // Can be disabled if needed
  });
}

/**
 * Hook to get teacher's adviser levels
 */
export function useAdviserLevels(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery<string[]>({
    queryKey: ['adviser', 'levels'],
    queryFn: async () => {
      // Try localStorage cache first
      const cached = localStorage.getItem('adviserLevels');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch (err) {
          // Invalid cache, fetch from API
        }
      }

      // Fetch from API
      const response = await apiGet(API_ENDPOINTS.TEACHER_ADVISER_LEVELS);
      if (response?.success && Array.isArray(response.levels)) {
        // Cache for next time
        try {
          localStorage.setItem('adviserLevels', JSON.stringify(response.levels));
        } catch (err) {
          // Ignore storage errors
        }
        return response.levels;
      }

      return [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Adviser levels don't change often
    enabled,
  });
}
