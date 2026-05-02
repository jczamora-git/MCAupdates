import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { apiGet, API_ENDPOINTS } from '@/lib/api';

/**
 * Hook to manage payment section lock/unlock state
 * Acts like 2FA for the payment pages
 * 
 * Payment section includes:
 * - /enrollment/payment (main page)
 * - /enrollment/installment-plans
 * - /enrollment/payment-process
 * 
 * IMPORTANT: For enrollee role users, checks if enrollment is submitted
 * before allowing payment access. Redirects to enrollment page if needed.
 * 
 * When user navigates away to non-payment pages, lock resets
 * Coming back to payment requires PIN verification again
 * 
 * Usage:
 * const { isPaymentSectionUnlocked, unlockPaymentSection } = usePaymentPageLock();
 */

const PAYMENT_SECTION_PAGES = [
  '/enrollee/payment',
  '/enrollment/payment',
  '/enrollee/installment-plans',
  '/enrollment/installment-plans',
  '/enrollee/payment-process',
  '/enrollment/payment-process',
];

const PAYMENT_LOCK_KEY = 'payment_section_unlocked';

export function usePaymentPageLock() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isPaymentSectionUnlocked, setIsPaymentSectionUnlocked] = useState<boolean | null>(null);
  const previousPathRef = useRef<string | null>(null);
  const [hasSubmittedEnrollment, setHasSubmittedEnrollment] = useState<boolean | null>(null);
  const enrollmentCheckRef = useRef<boolean>(false);

  /**
   * Detect the current route prefix (enrollee or enrollment)
   */
  const getCurrentPrefix = () => {
    if (location.pathname.startsWith('/enrollee/')) return '/enrollee';
    if (location.pathname.startsWith('/enrollment/')) return '/enrollment';
    return '/enrollee'; // default fallback
  };

  /**
   * Check if current page is part of payment section
   */
  const isPaymentSectionPage = () => {
    return PAYMENT_SECTION_PAGES.some(page => location.pathname === page);
  };

  /**
   * Check if previous page was part of payment section
   */
  const wasOnPaymentSection = () => {
    if (!previousPathRef.current) return false;
    return PAYMENT_SECTION_PAGES.some(page => previousPathRef.current === page);
  };

  /**
   * Unlock payment section for user
   */
  const unlockPaymentSection = () => {
    sessionStorage.setItem(PAYMENT_LOCK_KEY, 'true');
    setIsPaymentSectionUnlocked(true);
  };

  /**
   * Lock payment section
   */
  const lockPaymentSection = () => {
    sessionStorage.removeItem(PAYMENT_LOCK_KEY);
    setIsPaymentSectionUnlocked(false);
  };

  /**
   * Navigate to payment section with correct prefix
   */
  const navigateToPayment = () => {
    const prefix = getCurrentPrefix();
    navigate(`${prefix}/payment`, { replace: true });
  };

  /**
   * Navigate to setup-pin with correct prefix
   */
  const navigateToSetupPin = () => {
    const prefix = getCurrentPrefix();
    navigate(`${prefix}/setup-pin`, { replace: true });
  };

  /**
   * Navigate to verify-pin with correct prefix
   */
  const navigateToVerifyPin = () => {
    const prefix = getCurrentPrefix();
    navigate(`${prefix}/verify-pin`, { replace: true });
  };

  /**
   * Check if enrollee user has submitted enrollment
   * This runs once and caches the result to avoid repeated API calls
   */
  useEffect(() => {
    // Only check for enrollee role users
    if (user?.role !== 'enrollee') {
      setHasSubmittedEnrollment(true); // Non-enrollees bypass this check
      return;
    }

    // Only fetch once per session
    if (enrollmentCheckRef.current) {
      return;
    }

    const checkEnrollment = async () => {
      try {
        enrollmentCheckRef.current = true;
        const response = await apiGet(API_ENDPOINTS.ENROLLMENTS);

        // Parse enrollment data (same logic as Payment.tsx)
        let enrollmentsArray: any[] = [];
        if (response.success && response.data) {
          if (Array.isArray(response.data)) {
            enrollmentsArray = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            enrollmentsArray = response.data.data;
          } else if (response.data.data && response.data.data.id) {
            enrollmentsArray = [response.data.data];
          } else if (response.data.id) {
            enrollmentsArray = [response.data];
          } else if (response.data.enrollments && Array.isArray(response.data.enrollments)) {
            enrollmentsArray = response.data.enrollments;
          }
        }

        // Check if there's any enrollment that has been submitted
        // An enrollment is considered submitted if it exists in the system (has a submitted_date)
        // Status can be: Pending (waiting for approval), Approved, Enrolled, Rejected, etc.
        const hasSubmittedAnyEnrollment = enrollmentsArray.some(
          (enrollment: any) => enrollment.submitted_date || enrollment.id
        );

        setHasSubmittedEnrollment(hasSubmittedAnyEnrollment);
      } catch (error) {
        console.error('🔐 [usePaymentPageLock] Error fetching enrollment:', error);
        // On error, assume no enrollment to be safe
        setHasSubmittedEnrollment(false);
      }
    };

    checkEnrollment();
  }, [user?.role, user?.id]);

  /**
   * Check lock status on mount and location change
   */
  useEffect(() => {
    const isCurrentlyUnlocked = sessionStorage.getItem(PAYMENT_LOCK_KEY) === 'true';
    const isCurrentPageInPaymentSection = isPaymentSectionPage();
    const isLeavingPaymentSection = wasOnPaymentSection() && !isCurrentPageInPaymentSection;
    const hasPinSet = user?.payment_pin_set === true;

    // If leaving payment section (was on payment, now on different section), reset the lock
    if (isLeavingPaymentSection) {
      lockPaymentSection();
      previousPathRef.current = location.pathname;
      return;
    }

    // ENROLLMENT CHECK: For enrollee users, check if they have submitted enrollment FIRST
    // This must be checked BEFORE PIN logic to prevent redirects for enrollees without enrollment
    if (user?.role === 'enrollee' && isCurrentPageInPaymentSection) {
      // Wait for enrollment check to complete
      if (hasSubmittedEnrollment === null) {
        setIsPaymentSectionUnlocked(null); // Keep loading state
        previousPathRef.current = location.pathname;
        return;
      }

      // If enrollee has no submitted enrollment, bypass PIN checks completely
      // Let them access payment page where AccessLockedCard will be shown
      if (!hasSubmittedEnrollment) {
        setIsPaymentSectionUnlocked(true); // Allow access to payment page
        previousPathRef.current = location.pathname;
        return;
      }
    }

    // If trying to access payment section but not unlocked
    // IMPORTANT: Don't check PIN for enrollees without enrollment (already handled above)
    if (isCurrentPageInPaymentSection && !isCurrentlyUnlocked) {
      // Double-check: if enrollee without enrollment, don't redirect
      if (user?.role === 'enrollee' && hasSubmittedEnrollment === false) {
        setIsPaymentSectionUnlocked(true);
        previousPathRef.current = location.pathname;
        return;
      }
      
      // User has no PIN set - send to setup-pin
      if (!hasPinSet) {
        navigateToSetupPin();
        previousPathRef.current = location.pathname;
        return;
      }
      
      // User has PIN set but not unlocked - send to verify-pin
      navigateToVerifyPin();
      previousPathRef.current = location.pathname;
      return;
    }

    // Update state based on current unlock status
    setIsPaymentSectionUnlocked(isCurrentlyUnlocked);
    
    // Update previous path ref for next check
    previousPathRef.current = location.pathname;
  }, [location.pathname, navigate, user?.payment_pin_set, user?.role, hasSubmittedEnrollment]);

  return {
    isPaymentSectionUnlocked,
    unlockPaymentSection,
    lockPaymentSection,
    isPaymentSectionPage,
    navigateToPayment,
    navigateToSetupPin,
    navigateToVerifyPin,
    getCurrentPrefix,
    hasSubmittedEnrollment, // Export for Payment.tsx to use
  };
}
