import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINTS, apiPost } from '@/lib/api';
import { NumericKeypad } from '@/components/NumericKeypad';

interface PinVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  paymentAmount?: number;
  paymentDescription?: string;
}

export function PinVerificationModal({
  isOpen,
  onClose,
  onVerified,
  paymentAmount,
  paymentDescription = 'Payment',
}: PinVerificationModalProps) {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError('');
      setAttempts(0);
      setIsVerifying(false);
    }
  }, [isOpen]);

  const handleVerify = async () => {
    if (!pin.trim()) {
      setError('PIN is required');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError('Invalid PIN format');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const response = await apiPost(API_ENDPOINTS.VERIFY_PAYMENT_PIN, {
        payment_pin: pin,
      });

      if (response.success) {
        toast.success('PIN verified successfully');
        setPin('');
        setAttempts(0);
        setError('');
        onVerified();
        onClose();
      } else {
        // Use backend response message - it knows the real state
        const backendMessage = response.message || 'PIN verification failed';
        setError(backendMessage);
        
        // Check if account is locked based on backend message
        if (backendMessage.toLowerCase().includes('locked')) {
          toast.error('Your account is temporarily locked for security.');
          // Close modal after 2 seconds so user can read the message
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          // Wrong PIN - show attempt count from backend
          toast.error('Incorrect PIN');
          setAttempts((response.attempts_remaining ?? 0) + 1);
        }
      }
    } catch (err: any) {
      console.error('PIN verification error:', err);
      setError('An error occurred. Please try again.');
      toast.error('Error verifying PIN');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPin(value);
    if (error) setError('');
  };

  const handleClose = () => {
    // Only allow closing if verification is in progress (to cancel)
    // Don't reset state here - let the actual close handler do it
    onClose();
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    // Only allow closing the dialog if not currently verifying
    // This prevents the X button from closing while verification is happening
    if (!newOpen && !isVerifying) {
      handleClose();
    }
  };

  const handleForgotPin = () => {
    handleClose();
    navigate('/auth/forgot-pin');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md pin-verification-modal">
        <DialogHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="bg-blue-100 p-3 rounded-full">
              <Lock className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <DialogTitle className="text-xl">Verify Payment PIN</DialogTitle>
            {paymentAmount && (
              <div className="text-base font-medium text-gray-900">
                Amount: ₱{Number(paymentAmount).toFixed(2)}
              </div>
            )}
            <DialogDescription className="text-sm text-gray-600">
              Enter your PIN to confirm this payment
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* PIN Input */}
          <div className="space-y-2">
            <NumericKeypad
              value={pin}
              onChange={handlePasswordChange}
              maxLength={6}
              onSubmit={handleVerify}
              disabled={isVerifying}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              This is your payment security PIN, not your password.
            </p>
          </div>

          {/* Forgot PIN Link */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleForgotPin}
              disabled={isVerifying}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Forgot PIN?
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
