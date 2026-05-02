import { ReactNode } from 'react';
import { isFeatureEnabled, FeatureName } from '@/config/features';
import { Lock } from 'lucide-react';

interface FeatureGateProps {
  feature: FeatureName;
  children: ReactNode;
  fallback?: ReactNode;
  showComingSoon?: boolean;
}

/**
 * Conditionally render content based on feature flag
 * 
 * @example
 * <FeatureGate feature="messages">
 *   <MessagingComponent />
 * </FeatureGate>
 */
export const FeatureGate = ({ 
  feature, 
  children, 
  fallback = null,
  showComingSoon = false 
}: FeatureGateProps) => {
  if (isFeatureEnabled(feature)) {
    return <>{children}</>;
  }

  if (showComingSoon) {
    return <FeatureComingSoon featureName={formatFeatureName(feature)} />;
  }

  return <>{fallback}</>;
};

interface FeatureComingSoonProps {
  featureName: string;
  description?: string;
}

/**
 * Display "Coming Soon" message for disabled features
 */
export const FeatureComingSoon = ({ 
  featureName, 
  description 
}: FeatureComingSoonProps) => (
  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-8">
    <Lock className="h-16 w-16 mb-4 opacity-50" />
    <h3 className="text-xl font-semibold mb-2">
      {featureName} Coming Soon
    </h3>
    <p className="text-sm text-center max-w-md">
      {description || "This feature is currently under development and will be available in a future update."}
    </p>
  </div>
);

/**
 * Format feature name for display
 */
const formatFeatureName = (feature: string): string => {
  return feature
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

/**
 * Hook to check feature availability
 */
export const useFeature = (feature: FeatureName) => {
  return {
    isEnabled: isFeatureEnabled(feature),
    featureName: formatFeatureName(feature),
  };
};

/**
 * HOC to protect components behind feature flags
 */
export const withFeatureGate = <P extends object>(
  Component: React.ComponentType<P>,
  feature: FeatureName,
  options?: { showComingSoon?: boolean; fallback?: ReactNode }
) => {
  return (props: P) => (
    <FeatureGate 
      feature={feature} 
      showComingSoon={options?.showComingSoon}
      fallback={options?.fallback}
    >
      <Component {...props} />
    </FeatureGate>
  );
};
