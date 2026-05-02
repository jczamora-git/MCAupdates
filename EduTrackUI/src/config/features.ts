/**
 * Feature Flag Configuration
 * 
 * Controls which features are enabled in the application.
 * 
 * IMPORTANT FOR DEVELOPMENT:
 * - In DEVELOPMENT: All features are enabled for testing
 * - In PRODUCTION: Only deployment-ready features are enabled
 * 
 * This file chooses behavior based on VITE_DEPLOY_ENV.
 */

import { isDevelopmentDeployment } from "@/config/deployEnv";

/**
 * Production Feature Flags (for Hostinger deployment)
 * Only enable features that are ready for end-users
 */
const PRODUCTION_FEATURES = {
  // Phase 1: Core Features (Always Enabled)
  authentication: true,
  userManagement: true,
  teacherManagement: true,
  
  // Phase 1: Enrollment & Payment (Currently Deployed)
  enrollment: true,
  payment: true,
  adviserEnrollment: true,
  
  // Phase 2: Academic Features (Under Development - DISABLED in production)
  courses: true,
  courseManagement: false,
  subjects: true,
  activities: false,
  quizzes: false,
  grading: false,
  classRecords: false,
  
  // Phase 2: Communication Features (Under Development - DISABLED in production)
  messages: false,
  announcements: true,  // ENABLED: Admin notifications/announcements
  broadcasts: false,
  
  // Phase 2: Attendance Features (Under Development - DISABLED in production)
  attendance: false,
  rfidScanner: false,
  qrAttendance: false,
  
  // Phase 3: Advanced Features
  reports: true,
  analytics: false,  // DISABLED: Predictive analytics hidden in production
  learningMaterials: false,
  studentProgress: false,
} as const;

/**
 * Development Feature Flags (for local development)
 * All features enabled so you can develop and test everything
 */
const DEVELOPMENT_FEATURES = {
  // Everything enabled in development for testing
  authentication: true,
  userManagement: true,
  teacherManagement: true,
  enrollment: true,
  payment: true,
  adviserEnrollment: true,
  courses: true,
  courseManagement: true,
  subjects: true,
  activities: true,
  quizzes: true,
  grading: true,
  classRecords: true,
  messages: true,
  announcements: true,
  broadcasts: true,
  attendance: true,
  rfidScanner: true,
  qrAttendance: true,
  reports: true,
  analytics: true,
  learningMaterials: true,
  studentProgress: true,
} as const;

/**
 * Active feature configuration based on deployment target
 */
export const FEATURES = isDevelopmentDeployment ? DEVELOPMENT_FEATURES : PRODUCTION_FEATURES;

export type FeatureName = keyof typeof FEATURES;

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (feature: FeatureName): boolean => {
  return FEATURES[feature];
};

/**
 * Get all enabled features
 */
export const getEnabledFeatures = (): FeatureName[] => {
  return Object.entries(FEATURES)
    .filter(([_, enabled]) => enabled)
    .map(([feature]) => feature as FeatureName);
};

/**
 * Check if multiple features are all enabled
 */
export const areAllFeaturesEnabled = (...features: FeatureName[]): boolean => {
  return features.every(feature => FEATURES[feature]);
};

/**
 * Check if any of the features are enabled
 */
export const isAnyFeatureEnabled = (...features: FeatureName[]): boolean => {
  return features.some(feature => FEATURES[feature]);
};

/**
 * Feature groups for easier management
 */
export const FEATURE_GROUPS = {
  enrollmentAndPayment: ['enrollment', 'payment'] as FeatureName[],
  academic: ['courses', 'subjects', 'activities', 'quizzes', 'grading'] as FeatureName[],
  communication: ['messages', 'announcements', 'broadcasts'] as FeatureName[],
  attendance: ['attendance', 'rfidScanner', 'qrAttendance'] as FeatureName[],
} as const;

/**
 * Check if a feature group is enabled
 */
export const isFeatureGroupEnabled = (group: keyof typeof FEATURE_GROUPS): boolean => {
  return FEATURE_GROUPS[group].every(feature => FEATURES[feature]);
};

/**
 * Environment-based feature overrides (optional)
 * Allows enabling features via environment variables
 */
export const getFeatureOverrides = (): Partial<Record<FeatureName, boolean>> => {
  const overrides: Partial<Record<FeatureName, boolean>> = {};
  
  // Example: VITE_FEATURE_MESSAGES=true
  Object.keys(FEATURES).forEach(feature => {
    const envKey = `VITE_FEATURE_${feature.toUpperCase()}`;
    const envValue = import.meta.env[envKey];
    
    if (envValue !== undefined) {
      overrides[feature as FeatureName] = envValue === 'true';
    }
  });
  
  return overrides;
};

/**
 * Get final feature state with environment overrides
 */
export const getFinalFeatureState = (feature: FeatureName): boolean => {
  const overrides = getFeatureOverrides();
  return overrides[feature] ?? FEATURES[feature];
};
