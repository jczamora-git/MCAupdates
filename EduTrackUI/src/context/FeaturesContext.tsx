import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiGet } from '@/lib/api';

interface EnrollmentTypes {
  new_student: boolean;
  returning_student: boolean;
  transferee: boolean;
  continuing_student: boolean;
}

interface FeatureFlags {
  authentication: boolean;
  user_management: boolean;
  teacher_management: boolean;
  enrollment: boolean;
  payment: boolean;
  adviser_enrollment: boolean;
  enrollment_types: EnrollmentTypes;
  courses: boolean;
  course_management: boolean;
  subjects: boolean;
  activities: boolean;
  quizzes: boolean;
  grading: boolean;
  class_records: boolean;
  messages: boolean;
  announcements: boolean;
  broadcasts: boolean;
  attendance: boolean;
  rfid_scanner: boolean;
  qr_attendance: boolean;
  reports: boolean;
  analytics: boolean;
  learning_materials: boolean;
}

interface FeaturesContextType {
  features: FeatureFlags | null;
  loading: boolean;
  error: string | null;
  isFeatureEnabled: (feature: keyof FeatureFlags) => boolean;
  isEnrollmentTypeEnabled: (type: keyof EnrollmentTypes) => boolean;
  refreshFeatures: () => Promise<void>;
}

const FeaturesContext = createContext<FeaturesContextType | undefined>(undefined);

export const FeaturesProvider = ({ children }: { children: ReactNode }) => {
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet('/api/config/features');
      
      if (response.success && response.data) {
        setFeatures(response.data);
      } else {
        throw new Error('Failed to load features');
      }
    } catch (err) {
      console.error('Error fetching features:', err);
      setError(err instanceof Error ? err.message : 'Failed to load features');
      // Set default features on error (all enabled for development safety)
      setFeatures({
        authentication: true,
        user_management: true,
        teacher_management: true,
        enrollment: true,
        payment: true,
        adviser_enrollment: true,
        enrollment_types: {
          new_student: true,
          returning_student: false,
          transferee: true,
          continuing_student: true,
        },
        courses: true,
        course_management: true,
        subjects: true,
        activities: true,
        quizzes: true,
        grading: true,
        class_records: true,
        messages: true,
        announcements: true,
        broadcasts: true,
        attendance: true,
        rfid_scanner: true,
        qr_attendance: true,
        reports: true,
        analytics: true,
        learning_materials: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
    if (!features) return false;
    return features[feature] === true;
  };

  const isEnrollmentTypeEnabled = (type: keyof EnrollmentTypes): boolean => {
    if (!features || !features.enrollment_types) return false;
    return features.enrollment_types[type] === true;
  };

  const refreshFeatures = async () => {
    await fetchFeatures();
  };

  return (
    <FeaturesContext.Provider
      value={{
        features,
        loading,
        error,
        isFeatureEnabled,
        isEnrollmentTypeEnabled,
        refreshFeatures,
      }}
    >
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeatures = () => {
  const context = useContext(FeaturesContext);
  if (context === undefined) {
    throw new Error('useFeatures must be used within a FeaturesProvider');
  }
  return context;
};
