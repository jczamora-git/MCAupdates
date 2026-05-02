import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS, apiPost, apiGet } from '@/lib/api';
import { requestPermission } from '@/lib/firebase';

interface User {
  id: string;
  email: string;
  name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  role: 'student' | 'teacher' | 'admin' | 'enrollee';
  status?: 'active' | 'inactive' | 'pending' | 'pending_verification';
  payment_pin_set?: boolean;
  profile_photo_path?: string | null;
}

interface RegistrationResponse {
  success: boolean;
  message?: string;
  // email_result comes from the backend and may include send status and message
  email_result?: {
    success: boolean;
    message?: string;
  };
  user?: any;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, firstName: string, middleName: string, lastName: string, role: string, phone?: string) => Promise<RegistrationResponse>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  authReady: boolean;
  checkUser: () => Promise<boolean>;
  updateUser: (updatedFields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Initialize user from localStorage on mount
    try {
      const stored = localStorage.getItem('edutrack_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[Auth] Checking session...');
        const response = await apiGet(API_ENDPOINTS.CHECK);
        console.log('[Auth] Check response:', response);

        if (!isMounted) {
          return;
        }

        if (response.authenticated && response.user) {
          console.log('[Auth] User authenticated:', response.user.email);
          const userData: User = {
            id: response.user.id.toString(),
            email: response.user.email,
            name: `${response.user.first_name} ${response.user.last_name}`,
            first_name: response.user.first_name,
            middle_name: response.user.middle_name,
            last_name: response.user.last_name,
            role: response.user.role as 'student' | 'teacher' | 'admin' | 'enrollee',
            status: response.user.status as 'active' | 'inactive' | 'pending' | 'pending_verification',
            payment_pin_set: response.user.payment_pin_set || false,
            profile_photo_path: response.user.profile_photo_path || null,
          };

          setUser(userData);
          localStorage.setItem('edutrack_user', JSON.stringify(userData));

          // Ensure FCM token registration runs with a valid authenticated session.
          void requestPermission();
        } else {
          console.log('[Auth] Not authenticated, clearing user');
          setUser(null);
          localStorage.removeItem('edutrack_user');
        }
      } catch (error) {
        console.error('[Auth] Error checking session:', error);
        if (!isMounted) {
          return;
        }
        setUser(null);
        localStorage.removeItem('edutrack_user');
      } finally {
        if (isMounted) {
          console.log('[Auth] Auth ready');
          setAuthReady(true);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiPost(API_ENDPOINTS.LOGIN, { email, password });
      
      if (response.success && response.user) {
        const userData: User = {
          id: response.user.id.toString(),
          email: response.user.email,
          name: `${response.user.first_name} ${response.user.last_name}`,
          first_name: response.user.first_name,
          middle_name: response.user.middle_name,
          last_name: response.user.last_name,
          role: response.user.role as 'student' | 'teacher' | 'admin' | 'enrollee',
          status: response.user.status as 'active' | 'inactive' | 'pending' | 'pending_verification',
          payment_pin_set: response.user.payment_pin_set || false,
          profile_photo_path: response.user.profile_photo_path || null,
        };
        
        setUser(userData);
        localStorage.setItem('edutrack_user', JSON.stringify(userData));

        // Refresh/register FCM token after login to bind this device to the user.
        void requestPermission();
        
        // Navigate based on role
        switch (userData.role) {
          case 'enrollee':
            navigate('/enrollee/dashboard');
            break;
          case 'student':
            navigate('/student/dashboard');
            break;
          case 'teacher':
            navigate('/teacher/dashboard');
            break;
          case 'admin':
            navigate('/admin/dashboard');
            break;
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (
    email: string, 
    password: string, 
    firstName: string, 
    middleName: string,
    lastName: string, 
    role: string,
    phone?: string
  ): Promise<RegistrationResponse> => {
    try {
      const response = await apiPost(API_ENDPOINTS.REGISTER, {
        email,
        password,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        role,
        phone,
      });

      // Return the full response so callers can inspect email_result
      return response;
    } catch (error: any) {
      console.error('Registration error:', error);
      return { success: false, message: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await apiPost(API_ENDPOINTS.LOGOUT, {});
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('edutrack_user');
      navigate('/auth');
    }
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...updatedFields };
    console.log('updateUser called:', { current: user, updated: updatedUser });
    setUser(updatedUser);
    localStorage.setItem('edutrack_user', JSON.stringify(updatedUser));
  };

  const checkUser = async (): Promise<boolean> => {
    try {
      const response = await apiGet(API_ENDPOINTS.CHECK);
      
      if (response.authenticated && response.user) {
        const userData: User = {
          id: response.user.id.toString(),
          email: response.user.email,
          name: `${response.user.first_name} ${response.user.last_name}`,
          first_name: response.user.first_name,
          middle_name: response.user.middle_name,
          last_name: response.user.last_name,
          role: response.user.role as 'student' | 'teacher' | 'admin' | 'enrollee',
          status: response.user.status as 'active' | 'inactive' | 'pending' | 'pending_verification',
          payment_pin_set: response.user.payment_pin_set || false,
          profile_photo_path: response.user.profile_photo_path || null,
        };
        
        setUser(userData);
        localStorage.setItem('edutrack_user', JSON.stringify(userData));

        // Refresh/register FCM token when session check restores authentication.
        void requestPermission();

        return true;
      }

      setUser(null);
      localStorage.removeItem('edutrack_user');
      
      return false;
    } catch (error) {
      console.error('Check user error:', error);
      setUser(null);
      localStorage.removeItem('edutrack_user');
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user, authReady, checkUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
