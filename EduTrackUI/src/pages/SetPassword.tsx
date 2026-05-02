import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const token = searchParams.get('token');

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch('/api/auth/validate-set-password-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (data.success) {
          setTokenValid(true);
          setUserInfo(data.user);
        } else {
          setTokenValid(false);
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setTokenValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/set-password-with-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Password Set Successfully!",
          description: "Your account is now ready. You can now log in with your email and new password.",
        });

        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/auth');
        }, 2000);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to set password. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Set password error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-accent/5 to-success/5">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-start gap-2 mb-5 w-full">
            <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="Maranatha Christian Academy" className="h-16 object-contain flex-shrink-0" />
            <div className="leading-none flex-1">
              <p className="text-gray-800 text-lg font-extrabold" style={{ fontFamily: 'Montserrat', lineHeight: '1.1' }}>Maranatha Christian Academy</p>
              <p className="text-gray-600 text-base font-medium" style={{ fontFamily: 'Montserrat', lineHeight: '1.1' }}>Foundation Calapan City Inc.</p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Validating your link...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!token || !tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-accent/5 to-success/5">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-start gap-2 mb-5 w-full">
            <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="Maranatha Christian Academy" className="h-16 object-contain flex-shrink-0" />
            <div className="leading-none flex-1">
              <p className="text-gray-800 text-lg font-extrabold" style={{ fontFamily: 'Montserrat', lineHeight: '1.1' }}>Maranatha Christian Academy</p>
              <p className="text-gray-600 text-base font-medium" style={{ fontFamily: 'Montserrat', lineHeight: '1.1' }}>Foundation Calapan City Inc.</p>
            </div>
          </div>

          <Card>
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <CardTitle className="text-red-600">Invalid or Expired Link</CardTitle>
              <CardDescription>
                This password setup link is invalid or has expired. Please contact the school administration for assistance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-accent/5 to-success/5">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-start gap-2 mb-5 w-full">
          <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="Maranatha Christian Academy" className="h-16 object-contain flex-shrink-0" />
          <div className="leading-none flex-1">
            <p className="text-gray-800 text-lg font-extrabold" style={{ fontFamily: 'Montserrat', lineHeight: '1.1' }}>Maranatha Christian Academy</p>
            <p className="text-gray-600 text-base font-medium" style={{ fontFamily: 'Montserrat', lineHeight: '1.1' }}>Foundation Calapan City Inc.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Set Password</CardTitle>
            <CardDescription>Complete your account setup</CardDescription>
          </CardHeader>

          <CardContent>
            {userInfo && (
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg mb-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Account</p>
                  <p className="text-sm font-medium">{userInfo.first_name} {userInfo.last_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Email</p>
                  <p className="text-sm font-medium break-all">{userInfo.email}</p>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`pr-10 ${errors.password ? 'border-red-500' : ''}`}
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={`pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Password Requirements:</strong>
                  <ul className="mt-1 ml-4 list-disc text-xs">
                    <li>At least 8 characters long</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One number</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  'Set Password & Continue'
                )}
              </Button>

              <div
                onClick={() => navigate('/auth')}
                className="p-4 border border-border rounded-lg hover:bg-primary/5 hover:border-primary/50 transition-all cursor-pointer group"
              >
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Back to Sign In
                </p>
                <p className="text-xs text-muted-foreground group-hover:text-primary/70 transition-colors">
                  Return to login page
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}