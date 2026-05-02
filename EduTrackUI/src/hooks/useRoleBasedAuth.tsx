import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

type Role = 'admin' | 'teacher' | 'student' | 'enrollee';

/**
 * Custom hook for role-based authentication and authorization
 * Automatically redirects to /auth if user is not authenticated or doesn't have the required role
 * @param requiredRole - The role required to access the component
 * @returns Object containing user data and authentication status
 */
export function useRoleBasedAuth(requiredRole: Role | Role[]) {
  const { user, isAuthenticated, authReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!isAuthenticated || !user?.role || !allowedRoles.includes(user.role as Role)) {
      navigate('/auth');
    }
  }, [authReady, isAuthenticated, user, requiredRole, navigate]);

  return { user, isAuthenticated, authReady };
}
