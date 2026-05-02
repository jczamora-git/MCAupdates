import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type Role = 'admin' | 'teacher' | 'student' | 'enrollee';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole: Role | Role[];
}

/**
 * ProtectedRoute component for role-based route protection
 * - Redirects to /auth if user is not authenticated
 * - Redirects to /unauthorized if user is authenticated but lacks the required role
 * - Supports single role or array of allowed roles
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isAuthenticated, authReady } = useAuth();

  if (!authReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user's role matches required role(s)
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  if (!user?.role || !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
