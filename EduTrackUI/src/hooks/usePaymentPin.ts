import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Hook to enforce PIN verification checkpoint before accessing payment page
 * Redirects to setup-pin page where user must:
 * - Create PIN (if not set)
 * - Verify PIN (if already set)
 * 
 * This acts as a security checkpoint for all users before payment access
 * 
 * Usage in components:
 * const { hasPinSet, isLoading } = usePaymentPin();
 */
export function usePaymentPin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to PIN checkpoint page only if PIN is NOT set
    // If PIN is already set, allow access to payment page
    if (user && !user.payment_pin_set) {
      navigate('/enrollment/setup-pin', { replace: true });
    }
  }, [user, navigate]);

  return {
    hasPinSet: user?.payment_pin_set || false,
    isLoading: !user,
  };
}

/**
 * Hook to enforce PIN setup/verification on the setup-pin page
 * Always redirects to setup-pin before allowing payment access
 * Used in Payment.tsx to create the checkpoint
 * 
 * Usage in components that should force PIN security:
 * useSetupPinCheckpoint();
 */
export function useSetupPinCheckpoint() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // ALWAYS redirect to setup-pin (it handles both setup and verification)
    if (user) {
      navigate('/enrollment/setup-pin', { replace: true });
    }
  }, [user, navigate]);
}

/**
 * Hook to allow PIN setup page to work
 * This helps distinguish between setup page and protected pages
 */
export function usePaymentPinSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user already has PIN, redirect to payment page
    if (user && user.payment_pin_set) {
      navigate('/enrollment/payment', { replace: true });
    }
  }, [user, navigate]);

  return {
    canSetupPin: user && !user.payment_pin_set,
    isLoading: !user,
  };
}
