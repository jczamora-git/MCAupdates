import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle2, AlertCircle, XCircle, Coins, Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface InstallmentMobileViewProps {
  paymentPlans?: any[];
  installments?: { [key: string]: any[] };
  payments?: any[];
  onPayInstallment?: (installment: any, plan: any) => void;
}

export const InstallmentMobileView = ({
  paymentPlans = [],
  installments = {},
  payments = [],
  onPayInstallment,
}: InstallmentMobileViewProps) => {
  const [prioritizePending, setPrioritizePending] = useState(true);

  // Helper to get installment status
  const getInstallmentStatus = (installment: any) => {
    // Use the status from the installment data directly
    const status = installment.status?.toLowerCase();
    
    if (status === 'paid') return 'paid';
    if (status === 'overdue') return 'overdue';
    if (status === 'partial') return 'partial';
    return 'pending';
  };

  const statusConfig = {
    paid: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-400',
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: 'Paid',
    },
    pending: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      icon: <Clock className="w-4 h-4" />,
      label: 'Pending',
    },
    partial: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-400',
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Partial',
    },
    overdue: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      icon: <XCircle className="w-4 h-4" />,
      label: 'Overdue',
    },
  };

  // Helper to calculate plan progress
  const getPlanProgress = (planId: number) => {
    const planInstallments = installments[planId] || [];
    const paidCount = planInstallments.filter(
      (inst) => getInstallmentStatus(inst) === 'paid'
    ).length;
    return {
      paid: paidCount,
      total: planInstallments.length,
      percentage: planInstallments.length > 0 ? (paidCount / planInstallments.length) * 100 : 0,
    };
  };

  return (
      <div className="p-3 space-y-3 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs opacity-90">Payment Plans</p>
            <h1 className="text-lg font-bold">Installment Details</h1>
          </div>
        </div>
        
        {/* Toggle for pending/overdue first */}
        <div className="flex items-center justify-between pt-1 border-t border-blue-400/50">
          <span className="text-xs opacity-90">Show pending first</span>
          <Switch
            checked={prioritizePending}
            onCheckedChange={setPrioritizePending}
            className="scale-75"
          />
        </div>
      </div>

      {/* Payment Plans List */}
      {paymentPlans.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">No payment plans found</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            You don't have any installment plans yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paymentPlans.map((plan) => {
            const planInstallments = installments[plan.id] || [];
            const progress = getPlanProgress(plan.id);

            return (
              <Card key={plan.id} className="overflow-hidden border-gray-200 dark:border-gray-700">
                {/* Plan Header */}
                <CardHeader className="pb-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {plan.schedule_type} Payment Plan
                      </CardTitle>
                      <Badge className="bg-blue-100 dark:bg-blue-900/30 border-0 flex-shrink-0">
                        <span className="text-blue-700 dark:text-blue-400 text-xs font-medium">
                          {progress.paid}/{progress.total}
                        </span>
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Progress</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {progress.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Total Tuition</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          ₱{(plan.total_tuition && !isNaN(Number(plan.total_tuition))) 
                            ? Number(plan.total_tuition).toLocaleString() 
                            : '0'}
                        </span>
                      </div>
                      
                      {/* Total Paid */}
                      {plan.total_paid > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Total Paid</span>
                          <span className="text-xs font-medium text-green-600 dark:text-green-400">
                            ₱{Number(plan.total_paid).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {/* Balance */}
                      {plan.balance > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Remaining Balance</span>
                          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                            ₱{Number(plan.balance).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Installments List */}
                <CardContent className="pt-0 pb-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
                    {planInstallments.length === 0 ? (
                      <p className="text-xs text-center text-gray-500 dark:text-gray-400 py-4">
                        No installments found for this plan
                      </p>
                    ) : (
                      (() => {
                        // Sort installments based on toggle
                        let installmentsToDisplay = [...planInstallments].sort((a, b) => a.installment_number - b.installment_number);
                        
                        if (prioritizePending) {
                          installmentsToDisplay.sort((a, b) => {
                            const aPayment = payments.find(p => p.installment_id === a.id);
                            const bPayment = payments.find(p => p.installment_id === b.id);
                            const aIsPaid = aPayment && (aPayment.status === 'Approved' || aPayment.status === 'Verified');
                            const bIsPaid = bPayment && (bPayment.status === 'Approved' || bPayment.status === 'Verified');
                            
                            // Paid items go to bottom
                            if (aIsPaid && !bIsPaid) return 1;
                            if (!aIsPaid && bIsPaid) return -1;
                            // Keep original order for items with same paid status
                            return a.installment_number - b.installment_number;
                          });
                        }
                        
                        return installmentsToDisplay.map((installment, index) => {
                        const status = getInstallmentStatus(installment);
                        const config = statusConfig[status];

                        // Check locked status (must pay previous installments)
                        const orderedInstallments = [...planInstallments].sort((a, b) => a.installment_number - b.installment_number);
                        const nextUnpaidIndex = orderedInstallments.findIndex(i => {
                          const payment = payments.find(p => p.installment_id === i.id);
                          return !payment || (payment.status !== 'Approved' && payment.status !== 'Verified');
                        });
                        const currentIndex = orderedInstallments.findIndex(i => i.id === installment.id);
                        const relatedPayment = payments.find(p => p.installment_id === installment.id);
                        const isPaid = relatedPayment && (relatedPayment.status === 'Approved' || relatedPayment.status === 'Verified');
                        const isNextUnpaid = currentIndex === nextUnpaidIndex;
                        const isLocked = !isPaid && !isNextUnpaid;
                        const isSubmitted = relatedPayment && relatedPayment.status === 'Pending';

                        return (
                          <div
                            key={installment.id}
                            className={`bg-white dark:bg-gray-800/50 rounded-lg p-3 space-y-2 border-2 ${
                              isLocked 
                                ? 'border-gray-300 dark:border-gray-600 opacity-60' 
                                : status === 'paid' 
                                ? 'border-green-200 dark:border-green-800' 
                                : status === 'overdue' 
                                ? 'border-red-200 dark:border-red-800' 
                                : isSubmitted
                                ? 'border-blue-200 dark:border-blue-800'
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            {/* Installment Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  isLocked 
                                    ? 'bg-gray-200 dark:bg-gray-700' 
                                    : 'bg-blue-100 dark:bg-blue-900/30'
                                }`}>
                                  <span className={`text-xs font-bold ${
                                    isLocked 
                                      ? 'text-gray-500 dark:text-gray-400' 
                                      : 'text-blue-600 dark:text-blue-400'
                                  }`}>
                                    {installment.installment_number}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] sm:text-xs font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                                      Installment #{installment.installment_number}
                                    </span>
                                    {isLocked && <Lock className="w-3 h-3 text-gray-400" />}
                                  </div>
                                  {isLocked && (
                                    <p className="!text-[10px] sm:!text-[11px] leading-tight text-gray-500 dark:text-gray-400 mt-0.5">
                                      Pay previous installments first
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Badge className={`${
                                isSubmitted 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' 
                                  : config.bg
                              } border flex items-center gap-1 flex-shrink-0`}>
                                {isSubmitted ? <Clock className="w-3 h-3" /> : config.icon}
                                <span className={`${
                                  isSubmitted 
                                    ? 'text-blue-700 dark:text-blue-400' 
                                    : config.text
                                } text-[11px] sm:text-xs font-medium`}>
                                  {isSubmitted ? 'Submitted' : config.label}
                                </span>
                              </Badge>
                            </div>

                            {/* Due Date */}
                            <div className="flex items-center justify-between text-[11px] sm:text-xs">
                              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Due: {new Date(installment.due_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}</span>
                              </div>
                              {/* Days overdue indicator */}
                              {status === 'overdue' && installment.days_overdue > 0 && (
                                <span className="text-[11px] sm:text-xs font-medium text-red-600 dark:text-red-400">
                                  {installment.days_overdue} {installment.days_overdue === 1 ? 'day' : 'days'} late
                                </span>
                              )}
                            </div>

                            {/* Amount */}
                            <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Coins className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Amount Due</span>
                                </div>
                                <span className="text-[13px] sm:text-sm font-bold text-gray-900 dark:text-gray-100">
                                  ₱{(installment.amount_due && !isNaN(Number(installment.amount_due))) 
                                    ? Number(installment.amount_due).toLocaleString() 
                                    : '0'}
                                </span>
                              </div>
                              
                              {/* Amount Paid (if any) */}
                              {installment.amount_paid > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Amount Paid</span>
                                  <span className="text-[11px] sm:text-xs font-medium text-green-600 dark:text-green-400">
                                    ₱{Number(installment.amount_paid).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              
                              {/* Balance (if partial payment) */}
                              {installment.balance > 0 && status === 'partial' && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Balance</span>
                                  <span className="text-[11px] sm:text-xs font-medium text-orange-600 dark:text-orange-400">
                                    ₱{Number(installment.balance).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              
                              {/* Late Fee (if overdue) */}
                              {installment.late_fee > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] sm:text-xs text-red-500 dark:text-red-400">Late Fee</span>
                                  <span className="text-[11px] sm:text-xs font-medium text-red-600 dark:text-red-400">
                                    +₱{Number(installment.late_fee).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Payment Info (if paid or submitted) */}
                            {(status === 'paid' || isSubmitted) && installment.paid_date && (
                              <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
                                    {isSubmitted ? 'Submitted on' : 'Paid on'}
                                  </span>
                                  <span className={`text-[11px] sm:text-xs font-medium ${
                                    isSubmitted 
                                      ? 'text-blue-600 dark:text-blue-400' 
                                      : 'text-green-600 dark:text-green-400'
                                  }`}>
                                    {new Date(installment.paid_date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Pay Button */}
                            {!isLocked && !isPaid && !isSubmitted && onPayInstallment && (
                              <div className="pt-2">
                                <Button
                                  size="sm"
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => onPayInstallment(installment, plan)}
                                >
                                  Pay Installment
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                        });
                      })()
                    )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary Card */}
      {paymentPlans.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <AlertCircle className="w-4 h-4" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs text-blue-800 dark:text-blue-200">
              <div className="flex items-center justify-between">
                <span>Total Plans:</span>
                <span className="font-semibold">{paymentPlans.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Installments:</span>
                <span className="font-semibold">
                  {Object.values(installments).reduce((sum, insts) => sum + insts.length, 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Paid Installments:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {Object.values(installments).reduce((sum, insts) => 
                    sum + insts.filter((inst: any) => inst.status === 'Paid').length, 0
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending Installments:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {Object.values(installments).reduce((sum, insts) => 
                    sum + insts.filter((inst: any) => inst.status === 'Pending').length, 0
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Overdue Installments:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {Object.values(installments).reduce((sum, insts) => 
                    sum + insts.filter((inst: any) => inst.status === 'Overdue').length, 0
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
  );
};
