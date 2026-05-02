import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Eye, EyeOff, Mail } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/lib/api";
import EmailLoadingModal from "@/components/EmailLoadingModal";
import { CompactLanguageSelector } from "@/components/LanguageSelector";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      switch (user.role) {
        case 'enrollee':
          navigate('/enrollee/dashboard', { replace: true });
          break;
        case 'student':
          navigate('/student/dashboard', { replace: true });
          break;
        case 'teacher':
          navigate('/teacher/dashboard', { replace: true });
          break;
        case 'admin':
          navigate('/admin/dashboard', { replace: true });
          break;
      }
    }
  }, [user, navigate]);

  const handleResendVerification = async () => {
    if (!registeredEmail) return;
    
    setResendingEmail(true);
    try {
      const response = await fetch(API_ENDPOINTS.RESEND_VERIFICATION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: registeredEmail }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success("Verification email sent successfully!");
      } else {
        toast.error(data.message || "Failed to resend verification email");
      }
    } catch (error) {
      toast.error("Failed to resend verification email");
    }
    setResendingEmail(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError("");
    
    const success = await login(loginEmail, loginPassword);
    
    if (!success) {
      // Check if it's a verification error
      try {
        const response = await fetch(API_ENDPOINTS.LOGIN, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        });
        const data = await response.json();
        
        // Allow enrollees with pending status to login - they'll see verification prompt on dashboard
        // Only block other roles from logging in with pending status
        if (data.message && data.message.includes('verify') && data.user?.role !== 'enrollee') {
          setLoginError("Please verify your email before logging in. Check your inbox for the verification link.");
          setRegisteredEmail(loginEmail);
        } else if (!data.success) {
          toast.error("Invalid credentials. Please try again.");
        }
      } catch {
        toast.error("Invalid credentials. Please try again.");
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-accent/5 to-success/5">
      {/* Language Selector - Fixed Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <CompactLanguageSelector />
      </div>

      {/* Show loading modal while submitting */}
      {isLoading && !showVerificationMessage && (
        <EmailLoadingModal 
          isOpen={true}
          isSuccess={false}
          emailType="custom"
          customMessage="Processing your request..."
        />
      )}

      <div className="w-full max-w-md">
        <div className="flex items-center justify-start gap-2 mb-5 w-full">
          <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="Maranatha Christian Academy Foundation" className="h-16 object-contain flex-shrink-0" />
          <div className="leading-none flex-1">
            <p className="text-gray-800 text-lg font-extrabold" style={{ fontFamily: 'Montserrat', lineHeight: '1.1' }}>Maranatha Christian Academy</p>
            <p className="text-gray-600 text-base font-medium" style={{ fontFamily: 'Montserrat', lineHeight: '1.1' }}>Foundation Calapan City Inc.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Welcome back to Maranatha</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {loginError}
                    {registeredEmail && (
                      <Button 
                        variant="link" 
                        onClick={handleResendVerification}
                        disabled={resendingEmail}
                        className="p-0 h-auto ml-2 text-destructive-foreground underline"
                      >
                        {resendingEmail ? "Sending..." : "Resend verification email"}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input 
                  id="signin-email" 
                  type="text" 
                  placeholder="Email or username" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password">Password</Label>
                  <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input 
                    id="signin-password" 
                    type={showLoginPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pr-10"
                    required 
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
              
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">OR</span>
                </div>
              </div>

              <div className="space-y-2">
                <div 
                  onClick={() => navigate('/register')}
                  className="p-4 border border-border rounded-lg hover:bg-primary/5 hover:border-primary/50 transition-all cursor-pointer group"
                >
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    Don't have an account?
                  </p>
                  <p className="text-xs text-muted-foreground group-hover:text-primary/70 transition-colors">
                    Sign Up to create a new account
                  </p>
                </div>
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
};

export default Auth;
