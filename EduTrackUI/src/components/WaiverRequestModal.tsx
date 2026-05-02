import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINTS, apiPost } from '@/lib/api';

interface WaiverRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (explanationId: number) => void; // Called after a successful waiver submission to continue - passes explanation ID
  installmentId: number;
  penaltyAmount: number;
  daysOverdue: number;
  installmentNumber: number;
}

export function WaiverRequestModal({
  isOpen,
  onClose,
  onSubmitted,
  installmentId,
  penaltyAmount,
  daysOverdue,
  installmentNumber,
}: WaiverRequestModalProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitWaiver = async () => {
    if (penaltyAmount > 0 && !reason.trim()) {
      toast.error('Please provide an explanation for the late payment (required)');
      return;
    }

    if (penaltyAmount === 0 && !reason.trim()) {
      toast.error('Please provide an explanation');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiPost(API_ENDPOINTS.STUDENT_REQUEST_PENALTY_WAIVER, {
        installment_id: installmentId,
        explanation: reason.trim(), // Field name for backend
        penalty_amount: penaltyAmount,
        days_overdue: daysOverdue,
      });

      if (response.success || response.status === 'success') {
        toast.success('Explanation submitted. Proceeding to payment with penalty...');
        setReason('');
        onClose();
        // Notify parent to persist navigation state and continue
        const explanationId = response.data?.id || response.data?.explanation_id || 0;
        setTimeout(() => {
          onSubmitted(explanationId);
        }, 300);
      } else {
        toast.error(response.message || 'Failed to submit explanation');
      }
    } catch (error) {
      console.error('Error submitting explanation:', error);
      toast.error('Error submitting explanation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // No "proceed without waiver" for overdue payments. Parent may offer direct proceed when penaltyAmount === 0.

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-orange-600" />
            Late Payment - Explanation Required
          </DialogTitle>
          <DialogDescription>
            Installment #{installmentNumber} is overdue
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Penalty Info */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Penalty Amount:</span>
                <span className="font-bold text-red-700">₱{penaltyAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Days Overdue:</span>
                <span className="font-medium">{daysOverdue} days</span>
              </div>
              <div className="pt-2 border-t border-red-300">
                <p className="text-xs font-semibold text-red-800">⚠️ This penalty will be charged with your payment</p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md flex gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">Explanation Required</p>
              <p className="text-xs text-yellow-700 mt-1">
                School policy requires an explanation for all late payments. The penalty charge will still apply regardless of the reason provided. This is for record-keeping purposes.
              </p>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <Label htmlFor="waiver-reason">
              Explanation for Late Payment {penaltyAmount > 0 && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="waiver-reason"
              className="mt-1 min-h-[120px]"
              placeholder="Explain why you couldn't pay on time (e.g., financial difficulties, medical emergency, family issues, etc.)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This explanation is required and will be recorded. The penalty will still be charged with your payment.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <Button
            onClick={handleSubmitWaiver}
            disabled={isSubmitting || (penaltyAmount > 0 && !reason.trim())}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Explanation & Proceed to Payment'}
          </Button>
          <Button
            onClick={onClose}
            disabled={isSubmitting}
            variant="ghost"
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
