import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { usePaymentPageLock } from '@/hooks/usePaymentPageLock';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, AlertCircle, ArrowLeft, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINTS, apiPost } from '@/lib/api';
import { NumericKeypad } from '@/components/NumericKeypad';
import { Button } from '@/components/ui/button';

export default function VerifyPin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { unlockPaymentSection, navigateToPayment } = usePaymentPageLock();
  
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);

  // Countdown timer for lock duration
  useEffect(() => {
    if (!isLocked || lockTimeRemaining <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setLockTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsLocked(false);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLocked, lockTimeRemaining]);

  // Format time remaining as MM:SS
  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerify = async () => {
    if (pin.length !== 6) {
      setError('Please enter your complete 6-digit PIN');
      return;
    }

    if (isLocked && lockTimeRemaining > 0) {
      setError(`Account locked. Try again in ${formatTimeRemaining(lockTimeRemaining)}`);
      return;
    }

    setIsVerifying(true);
    setError('');
    
    console.log('🔐 [VerifyPin] Attempting to verify PIN...');

    try {
      const response = await apiPost(API_ENDPOINTS.VERIFY_PAYMENT_PIN, {
        payment_pin: pin,
      });

      if (response.success) {
        console.log('🔐 [VerifyPin] PIN verified successfully!');
        toast.success('PIN verified successfully');
        setPin('');
        setIsLocked(false);
        setLockTimeRemaining(0);
        setError('');
        unlockPaymentSection();
        navigateToPayment();
      } else {
        console.log('🔐 [VerifyPin] PIN verification failed:', { response });
        
        // Check if account is locked (backend sends this message)
        if (response.message?.includes('locked') || response.message?.includes('Lock')) {
          // Account is locked for 2 minutes
          setIsLocked(true);
          setLockTimeRemaining(2 * 60); // 2 minutes in seconds
          setError('Too many failed attempts. Account locked for 2 minutes.');
          toast.error('Account locked for security. Try again in 2 minutes.');
          setPin('');
        } else {
          // Show attempts remaining from backend
          const attemptsRemaining = response.attempts_remaining ?? 0;
          if (attemptsRemaining > 0) {
            setError(`Incorrect PIN. ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.`);
            toast.error('Incorrect PIN');
          } else {
            setError('Incorrect PIN');
            toast.error('Incorrect PIN');
          }
          setPin('');
        }
      }
    } catch (err: any) {
      console.error('🔐 [VerifyPin] PIN verification error:', err);
      setError('An error occurred. Please try again.');
      toast.error('Error verifying PIN');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    setError('');
  };

  return (
    <DashboardLayout>
      <div className="enrollment-readable min-h-screen flex items-center justify-center py-4 px-2 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="flex justify-center mb-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-2xl shadow-lg">
                <Lock className="h-7 w-7 text-white" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              Verify Payment PIN
            </h1>
            <p className="text-xs text-gray-600 px-2">
              Enter your 6-digit PIN
            </p>
          </div>

          {/* Main Card */}
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-4 pb-4 px-3">
              {/* Error Message */}
              {error && (
                <div className="mb-3 flex gap-1.5 rounded-lg bg-red-50 border border-red-200 p-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-tight text-red-700">{error}</div>
                </div>
              )}

              {/* Lock Countdown Timer */}
              {isLocked && lockTimeRemaining > 0 && (
                <div className="mb-3 flex gap-1.5 rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <Clock className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-orange-900 mb-1">Account Locked</p>
                    <p className="text-[11px] leading-tight text-orange-700">
                      Please wait <span className="font-mono font-bold">{formatTimeRemaining(lockTimeRemaining)}</span> before trying again
                    </p>
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                <p className="text-[11px] leading-tight text-blue-700">
                  This is your payment PIN, not your password.
                </p>
              </div>

              {/* Numeric Keypad */}
              <NumericKeypad
                value={pin}
                onChange={handlePinChange}
                maxLength={6}
                onSubmit={handleVerify}
                disabled={isVerifying || isLocked}
              />

              {/* Forgot PIN Link */}
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/auth/forgot-pin', { 
                    state: { email: user?.email || '' } 
                  })}
                  className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                >
                  Forgot PIN?
                </button>
              </div>

              {/* Back Button */}
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(-1)}
                disabled={isVerifying}
                className="w-full mt-2 text-xs text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Go Back
              </Button>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <div className="mt-3 text-center text-[10px] text-gray-500">
            PIN required for all payments
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
