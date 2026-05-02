import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentPageLock } from '@/hooks/usePaymentPageLock';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINTS, apiPost } from '@/lib/api';
import { NumericKeypad } from '@/components/NumericKeypad';
import { useConfirm } from '@/components/Confirm';

const SetupPin = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { unlockPaymentSection, navigateToVerifyPin, navigateToPayment } = usePaymentPageLock();
  const confirmFn = useConfirm();
  
  // State for form
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pinJustSet, setPinJustSet] = useState(false);

  console.log('🔐 [SetupPin] Component mounted/updated', {
    userExists: !!user,
    userId: user?.id,
    payment_pin_set: user?.payment_pin_set,
    pinJustSet,
  });

  useEffect(() => {
    // Check if user has PIN already set (but only if we didn't just set it)
    // This handles the case where user navigates back to setup-pin when they already have a PIN
    if (user && user.payment_pin_set && !pinJustSet) {
      // User already has PIN, redirect to verify page
      console.log('🔐 [SetupPin] User already has PIN - redirecting to verify-pin');
      navigateToVerifyPin();
    }
  }, [user?.id, pinJustSet, navigateToVerifyPin]);

  // Navigate after PIN is set and state is updated
  useEffect(() => {
    if (pinJustSet && user?.payment_pin_set) {
      console.log('🔐 [SetupPin] PIN set confirmed in state - navigating to payment');
      navigateToPayment();
    }
  }, [pinJustSet, navigateToPayment]);

  // Debug: Log user state changes
  useEffect(() => {
    console.log('SetupPin - User state updated:', {
      userId: user?.id,
      paymentPinSet: user?.payment_pin_set,
      pinJustSet,
    });
  }, [user, pinJustSet]);

  const handleContinue = () => {
    if (step === 'enter') {
      if (pin.length !== 6) {
        setError('PIN must be exactly 6 digits');
        return;
      }
      setError('');
      setStep('confirm');
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setStep('enter');
    setConfirmPin('');
    setError('');
  };

  const handleSubmit = async () => {
    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    // Show confirmation dialog
    const confirmed = await confirmFn({
      title: "Confirm Payment PIN Setup",
      description: `Are you sure you want to set this PIN? You'll need this PIN to authorize all payment transactions. Make sure you remember it.`,
      confirmText: "Set PIN",
      cancelText: "Cancel"
    });

    if (!confirmed) {
      setStep('enter');
      setPin('');
      setConfirmPin('');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiPost(API_ENDPOINTS.SETUP_PAYMENT_PIN, {
        payment_pin: pin,
      });

      if (response.success) {
        console.log('🔐 [SetupPin] PIN setup successful!', { response });
        toast.success('Payment PIN successfully set!');
        
        // Update user in auth context with payment_pin_set = true
        updateUser({ payment_pin_set: true });

        // Unlock payment section for 2FA
        unlockPaymentSection();

        // Set flag to trigger navigation in useEffect
        setPinJustSet(true);
      } else {
        console.log('🔐 [SetupPin] PIN setup failed!', { response });
        toast.error(response.message || 'Failed to set PIN. Please try again.');
        setError(response.message || 'Failed to set PIN');
      }
    } catch (error: any) {
      console.error('🔐 [SetupPin] PIN setup error:', error);
      toast.error('Error setting PIN. Please try again.');
      setError('Error setting PIN. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinChange = (value: string) => {
    if (step === 'enter') {
      setPin(value);
    } else {
      setConfirmPin(value);
    }
    setError('');
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

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
              {step === 'enter' ? 'Set Payment PIN' : 'Confirm Your PIN'}
            </h1>
            <p className="text-xs text-gray-600 px-2">
              {step === 'enter' 
                ? 'Create a secure 6-digit PIN'
                : 'Re-enter your 6-digit PIN'
              }
            </p>
          </div>

          {/* Main Card */}
          <Card className="border-0 shadow-xl">
            <CardContent className="pt-4 pb-4 px-3">
              {/* Info Box */}
              {step === 'enter' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4">
                  <div className="flex gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-tight text-blue-700">
                      <p className="font-medium">Why a PIN?</p>
                      <p className="mt-0.5">
                        A PIN prevents unauthorized payments.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-3 flex gap-1.5 rounded-lg bg-red-50 border border-red-200 p-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-tight text-red-700">{error}</div>
                </div>
              )}

              {/* Numeric Keypad */}
              <NumericKeypad
                value={step === 'enter' ? pin : confirmPin}
                onChange={handlePinChange}
                maxLength={6}
                onSubmit={handleContinue}
                disabled={isSubmitting}
              />

              {/* Back Button (only on confirm step) */}
              {step === 'confirm' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="w-full mt-3 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-3 w-3 mr-2" />
                  Back to Enter PIN
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Security Tips */}
          {step === 'enter' && (
            <div className="mt-3 bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm">
              <p className="text-[11px] font-semibold text-gray-900 mb-1.5">Security Tips:</p>
              <ul className="text-[10px] leading-tight text-gray-600 space-y-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Avoid obvious numbers</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Don't share with anyone</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>Choose memorable numbers</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SetupPin;
