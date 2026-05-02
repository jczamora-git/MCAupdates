import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Coins, Receipt, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import { API_ENDPOINTS } from '@/lib/api';

interface PaymentHistory {
  id: string | number;
  receipt_number: string;
  payment_type: string;
  payment_for: string;
  amount: number | string;
  total_discount?: number | string;
  net_amount?: number | string;
  payment_method: string;
  payment_date: string;
  status: string;
  reference_number?: string;
}

interface EnrollmentStep3Props {
  enrollment: any;
  onComplete: () => void;
}

export function EnrollmentStep3({ enrollment, onComplete }: EnrollmentStep3Props) {
  const { user } = useAuth();
  const isAdviser = user?.role === 'teacher';
  const [payments, setPayments] = useState<PaymentHistory[]>([]);
  const [requiredFees, setRequiredFees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentForbidden, setPaymentForbidden] = useState(false);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!enrollment?.id) return;
      
      setLoading(true);
      setError(null);
      setPaymentForbidden(false);
      
      try {
        const paymentsUrl = isAdviser
          ? API_ENDPOINTS.ADVISER_ENROLLMENT_PAYMENTS(enrollment.id)
          : `/api/enrollments/${enrollment.id}/payments`;
        const response = await fetch(paymentsUrl);
        if (response.status === 403 && isAdviser) {
          setPaymentForbidden(true);
          setPayments([]);
          setRequiredFees(0);
          return;
        }

        let result: any = null;
        try {
          result = await response.json();
        } catch (parseError) {
          result = null;
        }

        if (!response.ok) {
          setError(result?.message || 'Failed to load payments');
          setRequiredFees(20000);
          return;
        }

        if (result?.success) {
          setPayments(result.data?.payments || []);
          setRequiredFees(Number(result.data?.required_fees) || 0);
        } else {
          setError(result?.message || 'Failed to load payments');
          setRequiredFees(20000);
        }
      } catch (err) {
        console.error('Error fetching payments:', err);
        setError('Failed to connect to server');
        setRequiredFees(20000); 
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [enrollment?.id]);

  const totalDiscount = payments.reduce((sum, p) => {
    return sum + (Number(p.total_discount ?? 0) || 0);
  }, 0);

  const totalPaid = payments.reduce((sum, p) => {
    // Only count approved/verified payments towards total? 
    // Usually 'Approved' or 'Verified'. 'Pending' might not count yet.
    // Based on schema 'status' enum: 'Pending', 'Verified', 'Approved', 'Rejected'
    if (p.status === 'Rejected') return sum;
    return sum + (Number(p.net_amount ?? p.amount) || 0);
  }, 0);

  const hasApprovedPayment = payments.some((payment) => (
    payment.status === 'Approved' || payment.status === 'Verified'
  ));
  
  const balance = Math.max(0, requiredFees - (totalPaid + totalDiscount));
  const isFullyPaid = balance <= 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        <span className="ml-2 text-amber-600">Loading payment details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (isAdviser && (paymentForbidden || !hasApprovedPayment)) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Payment Review Pending</AlertTitle>
        <AlertDescription>
          Payment records for this enrollment have not yet been approved by the administration.
          Please await official payment verification before proceeding with approval.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-semibold">Total Paid</p>
                <p className="text-2xl font-bold text-green-700">₱{totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-semibold">Required Fees</p>
                <p className="text-2xl font-bold text-blue-700">₱{requiredFees.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                <Coins className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-semibold">Discounts Applied</p>
                <p className="text-2xl font-bold text-purple-700">₱{totalDiscount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-semibold">Balance</p>
                <p className="text-2xl font-bold text-amber-700">₱{balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card className="shadow-md">
        <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Payment History
          </CardTitle>
          <CardDescription className="text-amber-100">List of all payments made for this enrollment</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
             <div className="p-8 text-center text-gray-500">
               No payment records found for this enrollment.
             </div>
          ) : (
            <>
            <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-amber-50 border-b">
                    <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-amber-900 uppercase tracking-wider">Receipt #</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-amber-900 uppercase tracking-wider">Payment For</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-amber-900 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-amber-900 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-amber-900 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-amber-900 uppercase tracking-wider">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-amber-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{payment.receipt_number}</div>
                        {payment.reference_number && (
                            <div className="text-xs text-gray-500">Ref: {payment.reference_number}</div>
                        )}
                        </td>
                        <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{payment.payment_for}</div>
                        <div className="text-xs text-gray-500">{payment.payment_type}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">₱{Number(payment.net_amount ?? payment.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                            {payment.payment_method}
                        </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(payment.payment_date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={
                            payment.status === 'Approved' ? 'bg-green-100 text-green-800' :
                            payment.status === 'Verified' ? 'bg-blue-100 text-blue-800' :
                            payment.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }>
                            {payment.status}
                        </Badge>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            
            <div className="p-6 bg-amber-50 border-t">
                <div className="flex items-start gap-3">
                <AlertCircle className={`h-5 w-5 ${isFullyPaid ? 'text-green-600' : 'text-amber-600'} mt-0.5 flex-shrink-0`} />
                <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Payment Status: {isFullyPaid ? 'Fully Paid' : 'Partial Payment'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      The student has paid ₱{totalPaid.toLocaleString()} out of ₱{requiredFees.toLocaleString()} required fees.
                      {isFullyPaid
                         ? ' All required fees have been settled.'
                         : ` Remaining balance of ₱${balance.toLocaleString()} should be settled.`}
                      {totalDiscount > 0 && (
                        <> A discount of ₱{totalDiscount.toLocaleString()} was applied to reach this net total.</>
                      )}
                    </p>
                </div>
                </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Complete Step 3 Button */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-amber-900 text-lg">Payment review complete?</p>
            <p className="text-sm text-amber-700 mt-1">
                {balance > 0 
                    ? "Note: There is a remaining balance. You can still proceed if partial payment is allowed." 
                    : "Payment requirements met. Click to confirm and proceed to final approval."}
            </p>
          </div>
          <Button
            onClick={onComplete}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-3 text-base"
          >
            Mark Complete → Next Step
          </Button>
        </div>
      </div>
    </div>
  );
}
