/**
 * Utility functions for grade level calculations and management
 */

export const GRADE_PROGRESSION: Record<string, string> = {
  'Nursery 1': 'Nursery 2',
  'Nursery 2': 'Kinder',
  'Kinder': 'Grade 1',
  'Grade 1': 'Grade 2',
  'Grade 2': 'Grade 3',
  'Grade 3': 'Grade 4',
  'Grade 4': 'Grade 5',
  'Grade 5': 'Grade 6',
  'Grade 6': 'Graduated',
};

export const ALL_GRADE_LEVELS = [
  'Nursery 1',
  'Nursery 2',
  'Kinder',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
];

/**
 * Calculate the next grade level based on current grade
 * @param currentGrade - The student's current grade level
 * @returns The next grade level
 */
export function calculateNextGrade(currentGrade: string): string {
  return GRADE_PROGRESSION[currentGrade] || currentGrade;
}

/**
 * Check if a student can enroll (not graduated)
 * @param currentGrade - The student's current grade level
 * @returns True if student can enroll
 */
export function canEnroll(currentGrade: string): boolean {
  const nextGrade = calculateNextGrade(currentGrade);
  return nextGrade !== 'Graduated';
}

/**
 * Get a user-friendly message about grade progression
 * @param currentGrade - The student's current grade level
 * @returns Message about enrollment eligibility
 */
export function getGradeProgressionMessage(currentGrade: string): string {
  const nextGrade = calculateNextGrade(currentGrade);
  
  if (nextGrade === 'Graduated') {
    return `You have completed ${currentGrade}. Congratulations on your graduation!`;
  }
  
  return `You are currently in ${currentGrade}. You will be enrolling for ${nextGrade}.`;
}
