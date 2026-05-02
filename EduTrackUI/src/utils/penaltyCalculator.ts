/**
 * Penalty Calculator Utility
 * Calculates late payment penalties on-the-fly for installments
 * 
 * Business Rule: 5% penalty on overdue installments
 */

export type PenaltyInfo = {
  hasPenalty: boolean;
  penaltyAmount: number;
  daysOverdue: number;
  totalDue: number;
  penaltyPercentage: number;
};

/**
 * Calculate penalty for an installment
 * 
 * @param installment - The installment to calculate penalty for
 * @returns PenaltyInfo object with penalty details
 */
export const calculateInstallmentPenalty = (installment: {
  due_date: string | null;
  balance: number;
  status: string;
  amount_paid?: number;
}): PenaltyInfo => {
  const defaultResult: PenaltyInfo = {
    hasPenalty: false,
    penaltyAmount: 0,
    daysOverdue: 0,
    totalDue: Number(installment.balance),
    penaltyPercentage: 5.0
  };

  // No penalty if already paid
  if (installment.status === 'Paid') {
    return defaultResult;
  }

  // No penalty if no due date (Upon Enrollment not yet set)
  if (!installment.due_date) {
    return defaultResult;
  }

  // Calculate days overdue
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(installment.due_date);
  dueDate.setHours(0, 0, 0, 0);

  // Not overdue yet
  if (today <= dueDate) {
    return defaultResult;
  }

  // Calculate overdue days
  const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  // Ensure balance is a number (API might return string)
  const balance = Number(installment.balance);

  // Calculate penalty (5% of remaining balance)
  const penaltyPercentage = 5.0;
  const penaltyAmount = balance * (penaltyPercentage / 100);

  return {
    hasPenalty: true,
    penaltyAmount: Math.round(penaltyAmount * 100) / 100, // Round to 2 decimals
    daysOverdue,
    totalDue: balance + penaltyAmount,
    penaltyPercentage
  };
};

/**
 * Format penalty information for display
 */
export const formatPenaltyDisplay = (penalty: PenaltyInfo): string => {
  if (!penalty.hasPenalty) {
    return '';
  }

  return `Overdue by ${penalty.daysOverdue} day${penalty.daysOverdue > 1 ? 's' : ''} - Late fee: ₱${penalty.penaltyAmount.toFixed(2)}`;
};

/**
 * Check if penalty should be applied to payment
 */
export const shouldApplyPenalty = (installment: {
  due_date: string | null;
  status: string;
}): boolean => {
  if (installment.status === 'Paid') return false;
  if (!installment.due_date) return false;
  
  const today = new Date();
  const dueDate = new Date(installment.due_date);
  
  return today > dueDate;
};
