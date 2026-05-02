const normalize = (value: string | undefined): string => (value || '').trim().toLowerCase();

const envValue = normalize(import.meta.env.VITE_DEPLOY_ENV);

// Dev deployment can still be built with MODE=production, so use VITE_DEPLOY_ENV for behavior toggles.
export const isProductionDeployment = envValue === 'production';
export const isDevelopmentDeployment = !isProductionDeployment;
