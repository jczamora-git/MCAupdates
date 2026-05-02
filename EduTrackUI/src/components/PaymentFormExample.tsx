/**
 * Example: Payment Form with Penalty Integration
 * 
 * This is a reference implementation showing how to integrate
 * the penalty system into a payment processing form.
 * 
 * Location: src/components/PaymentFormExample.tsx (for reference only)
 */

import React, { useState, useEffect } from 'react';
import { calculateInstallmentPenalty, formatPenaltyDisplay } from '@/utils/penaltyCalculator';
import { API_ENDPOINTS } from '@/lib/api';
import { AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Installment = {
  installment_id: number;
  installment_number: number;
  due_date: string | null;
  balance: number;
  amount: number;
  status: string;
};

type PenaltyInfo = {
  hasPenalty: boolean;
  penaltyAmount: number;
  daysOverdue: number;
  totalDue: number;
  penaltyPercentage: number;
};

export function PaymentFormExample({ installment }: { installment: Installment }) {
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [penaltyInfo, setPenaltyInfo] = useState<PenaltyInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate penalty when component loads
  useEffect(() => {
    const penalty = calculateInstallmentPenalty({
      due_date: installment.due_date,
      balance: installment.balance,
      status: installment.status
    });
    
    setPenaltyInfo(penalty);
    
    // Pre-fill payment amount with total due (including penalty)
    setPaymentAmount(penalty.totalDue);
  }, [installment]);

  const handlePayment = async () => {
    if (!penaltyInfo) return;

    setIsProcessing(true);
    try {
      // Step 1: Create the payment record
      const paymentResponse = await fetch(API_ENDPOINTS.PAYMENTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          installment_id: installment.installment_id,
          amount: paymentAmount,
          payment_method: 'Cash', // Or from form
          reference_number: generateReferenceNumber()
        })
      });

      if (!paymentResponse.ok) {
        throw new Error('Payment creation failed');
      }

      const paymentData = await paymentResponse.json();
      const paymentId = paymentData.payment_id;

      // Step 2: If there's a penalty, record it
      if (penaltyInfo.hasPenalty) {
        await fetch(API_ENDPOINTS.PAYMENT_PENALTIES_RECORD, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            installment_id: installment.installment_id,
            penalty_amount: penaltyInfo.penaltyAmount,
            days_overdue: penaltyInfo.daysOverdue,
            payment_id: paymentId
          })
        });
      }

      // Step 3: Show success message
      alert('Payment processed successfully!');
      
      // Reload or redirect
      window.location.reload();

    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReferenceNumber = () => {
    return `PAY-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
  };

  if (!penaltyInfo) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      {/* Installment Details */}
      <div>
        <h3 className="text-lg font-semibold mb-4">
          Installment #{installment.installment_number}
        </h3>
        
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Original Amount:</span>
            <span className="font-medium">₱{installment.amount.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Remaining Balance:</span>
            <span className="font-medium">₱{installment.balance.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Due Date:</span>
            <span className="font-medium">
              {installment.due_date 
                ? new Date(installment.due_date).toLocaleDateString() 
                : 'Not set'}
            </span>
          </div>
        </div>
      </div>

      {/* Penalty Warning */}
      {penaltyInfo.hasPenalty && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            <div className="font-semibold mb-1">Late Payment Penalty Applied</div>
            <div className="text-sm">
              {formatPenaltyDisplay(penaltyInfo)}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Penalty Breakdown */}
      {penaltyInfo.hasPenalty && (
        <div className="space-y-2 p-4 bg-gray-50 rounded-md">
          <h4 className="font-semibold text-sm text-gray-700">Payment Breakdown</h4>
          
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Balance Due:</span>
            <span>₱{installment.balance.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between text-sm text-red-600">
            <span>Late Fee (5%):</span>
            <span>₱{penaltyInfo.penaltyAmount.toFixed(2)}</span>
          </div>
          
          <div className="border-t border-gray-300 pt-2 mt-2"></div>
          
          <div className="flex justify-between font-bold">
            <span>Total Amount Due:</span>
            <span className="text-lg">₱{penaltyInfo.totalDue.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* No Penalty Message */}
      {!penaltyInfo.hasPenalty && (
        <Alert className="bg-green-50 border-green-200">
          <Info className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            No late fees. Payment is on time.
          </AlertDescription>
        </Alert>
      )}

      {/* Payment Amount Input */}
      <div className="space-y-2">
        <Label htmlFor="payment-amount">Payment Amount</Label>
        <Input
          id="payment-amount"
          type="number"
          step="0.01"
          min="0"
          max={penaltyInfo.totalDue}
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
          className="text-lg font-semibold"
        />
        <p className="text-sm text-gray-500">
          Recommended: ₱{penaltyInfo.totalDue.toFixed(2)}
        </p>
      </div>

      {/* Payment Method (simplified) */}
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <select className="w-full border border-gray-300 rounded-md p-2">
          <option value="Cash">Cash</option>
          <option value="Check">Check</option>
          <option value="Bank Transfer">Bank Transfer</option>
        </select>
      </div>

      {/* Submit Button */}
      <Button 
        onClick={handlePayment}
        disabled={isProcessing || paymentAmount <= 0}
        className="w-full"
      >
        {isProcessing ? 'Processing...' : 'Process Payment'}
      </Button>

      {/* Warning if partial payment */}
      {paymentAmount < penaltyInfo.totalDue && paymentAmount > 0 && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700">
            <div className="text-sm">
              You are making a partial payment. 
              Remaining balance after this payment: 
              <strong> ₱{(penaltyInfo.totalDue - paymentAmount).toFixed(2)}</strong>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/* ============================================
   ADMIN: Penalty Waiver Component Example
   ============================================ */

type PenaltyRecord = {
  penalty_id: number;
  installment_id: number;
  penalty_amount: number;
  days_overdue: number;
  waived: number;
  waived_by: number | null;
  waived_at: string | null;
  waived_reason: string | null;
};

export function PenaltyWaiverForm({ 
  penalty, 
  onSuccess 
}: { 
  penalty: PenaltyRecord; 
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWaive = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for waiving this penalty');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        API_ENDPOINTS.PAYMENT_PENALTY_WAIVE(penalty.penalty_id),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ reason })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to waive penalty');
      }

      alert('Penalty waived successfully');
      onSuccess();
      
    } catch (error) {
      console.error('Waive error:', error);
      alert('Failed to waive penalty. You may not have permission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold">Waive Late Payment Penalty</h3>
      
      {/* Penalty Details */}
      <div className="space-y-2 p-4 bg-gray-50 rounded-md">
        <div className="flex justify-between">
          <span className="text-gray-600">Penalty Amount:</span>
          <span className="font-bold text-red-600">
            ₱{penalty.penalty_amount.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Days Overdue:</span>
          <span className="font-medium">{penalty.days_overdue} days</span>
        </div>
      </div>

      {/* Waiver Reason */}
      <div className="space-y-2">
        <Label htmlFor="waiver-reason">
          Reason for Waiver <span className="text-red-500">*</span>
        </Label>
        <textarea
          id="waiver-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Example: Medical emergency with hospital documentation, Natural disaster affected student's area, etc."
          rows={4}
          className="w-full border border-gray-300 rounded-md p-2"
          required
        />
        <p className="text-sm text-gray-500">
          This reason will be recorded for audit purposes.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          onClick={handleWaive}
          disabled={isSubmitting || !reason.trim()}
          variant="default"
        >
          {isSubmitting ? 'Waiving...' : 'Waive Penalty'}
        </Button>
        
        <Button 
          onClick={onSuccess}
          variant="outline"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>

      {/* Warning */}
      <Alert className="bg-yellow-50 border-yellow-200">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-700 text-sm">
          Once waived, this action cannot be undone. The waiver will be recorded 
          permanently for audit purposes.
        </AlertDescription>
      </Alert>
    </div>
  );
}

/* ============================================
   ADMIN: Penalty History Component
   ============================================ */

export function PenaltyHistory({ installmentId }: { installmentId: number }) {
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPenalties();
  }, [installmentId]);

  const fetchPenalties = async () => {
    try {
      const response = await fetch(
        API_ENDPOINTS.PAYMENT_PENALTY_BY_INSTALLMENT(installmentId),
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPenalties(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch penalties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading penalty history...</div>;
  }

  if (penalties.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-md text-center text-gray-600">
        No penalty records found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold">Penalty History</h4>
      
      {penalties.map((penalty) => (
        <div 
          key={penalty.penalty_id} 
          className={`p-4 rounded-md border ${
            penalty.waived 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-semibold">
                ₱{penalty.penalty_amount.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">
                {penalty.days_overdue} days overdue
              </div>
            </div>
            
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              penalty.waived 
                ? 'bg-green-200 text-green-800' 
                : 'bg-red-200 text-red-800'
            }`}>
              {penalty.waived ? 'Waived' : 'Active'}
            </div>
          </div>
          
          {penalty.waived && penalty.waived_reason && (
            <div className="mt-2 pt-2 border-t border-green-300">
              <div className="text-sm text-gray-700">
                <strong>Waiver Reason:</strong> {penalty.waived_reason}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Waived on {new Date(penalty.waived_at!).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * USAGE NOTES:
 * 
 * 1. Import these example components as reference
 * 2. Adapt to your existing payment form structure
 * 3. Ensure API_ENDPOINTS are properly configured
 * 4. Add proper error handling for production use
 * 5. Add loading states and user feedback
 * 6. Test with various scenarios (on-time, late, waived)
 * 
 * Integration Steps:
 * 
 * 1. Add penalty calculation when loading installment
 * 2. Display penalty warning if applicable
 * 3. Include penalty in payment amount
 * 4. Record penalty after payment success
 * 5. Add admin waiver UI for finance staff
 * 6. Add penalty history view for transparency
 */
