import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, Mail } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS } from "@/lib/api";
import EmailLoadingModal from "@/components/EmailLoadingModal";
import { toast } from "sonner";
import { CompactLanguageSelector } from "@/components/LanguageSelector";

const StudentLogin = () => {
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [studentPasswordSetupPassword, setStudentPasswordSetupPassword] = useState("");
  const [studentPasswordSetupConfirm, setStudentPasswordSetupConfirm] = useState("");
  const [studentError, setStudentError] = useState("");
  const [foundStudent, setFoundStudent] = useState<any>(null);
  const [studentPasswordSetup, setStudentPasswordSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if redirected from email verification
  useEffect(() => {
    if (location.state) {
      const state = location.state as any;
      if (state.verified && state.email) {
        // User was just verified, show password setup
        setStudentEmail(state.email);
        setFoundStudent({
          email: state.email,
          first_name: state.firstName || ''
        });
        setVerificationSent(true);
        setIsVerified(true);
        setStudentPasswordSetup(true); // Show password creation form
      }
    }
  }, [location.state]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      switch (user.role) {
        case 'student':
          navigate('/student/dashboard', { replace: true });
          break;
        default:
          navigate('/auth', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleStudentEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError("");
    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.CHECK_STUDENT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: studentEmail }),
      });

      const data = await response.json();

      if (!data.success) {
        setStudentError(data.message || "Student account not found");
        setFoundStudent(null);
        setIsLoading(false);
        return;
      }

      // Student found - now send verification email
      setFoundStudent(data);
      
      // Send verification email
      try {
        const verifyResponse = await fetch(API_ENDPOINTS.RESEND_VERIFICATION, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: studentEmail }),
        });

        const verifyData = await verifyResponse.json();
        
        if (verifyData.success) {
          setVerificationSent(true);
        } else {
          setStudentError("Found account but failed to send verification email. Please try again.");
          setFoundStudent(null);
        }
      } catch (error) {
        setStudentError("Found account but failed to send verification email. Please try again.");
        setFoundStudent(null);
      }
    } catch (error) {
      setStudentError("Failed to check student account. Please try again.");
      setFoundStudent(null);
    }
    
    setIsLoading(false);
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    try {
      const response = await fetch(API_ENDPOINTS.RESEND_VERIFICATION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: studentEmail }),
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

  const handleVerificationComplete = () => {
    // After email is verified, proceed to password setup or login
    setVerificationSent(false);
    
    if (foundStudent.password_set) {
      setStudentPasswordSetup(false);
    } else {
      setStudentPasswordSetup(true);
    }
  };

  const handleStudentPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError("");
    setIsLoading(true);

    const success = await login(studentEmail, studentPassword);
    
    if (!success) {
      setStudentError("Invalid email or password. Please try again.");
    }
    
    setIsLoading(false);
  };

  const handleStudentPasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError("");

    if (studentPasswordSetupPassword !== studentPasswordSetupConfirm) {
      setStudentError("Passwords do not match");
      return;
    }

    if (studentPasswordSetupPassword.length < 6) {
      setStudentError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.SET_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: studentEmail,
          password: studentPasswordSetupPassword,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setStudentError(data.message || "Failed to set password");
        setIsLoading(false);
        return;
      }

      // Password set successfully, now auto-login
      const loginSuccess = await login(studentEmail, studentPasswordSetupPassword);
      
      if (loginSuccess) {
        // useEffect will handle the redirect
      } else {
        setStudentError("Password set but login failed. Please try again.");
      }
    } catch (error) {
      setStudentError("Failed to set password. Please try again.");
    }
    
    setIsLoading(false);
  };

  const resetFlow = () => {
    setStudentEmail("");
    setStudentPassword("");
    setStudentPasswordSetup(false);
    setStudentPasswordSetupPassword("");
    setStudentPasswordSetupConfirm("");
    setStudentError("");
    setFoundStudent(null);
    setVerificationSent(false);
  };

  // Show verification email screen
  if (verificationSent && foundStudent && !isVerified) {
    // Show verification pending screen (only if not already verified from email)
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
              <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Verify Your Email</CardTitle>
              <CardDescription>
                We found your student account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Student Information */}
              <div className="space-y-3 bg-muted/50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">First Name</p>
                    <p className="text-sm font-medium">{foundStudent.first_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Last Name</p>
                    <p className="text-sm font-medium">{foundStudent.last_name}</p>
                  </div>
                </div>
                
                {foundStudent.student_id && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Student ID</p>
                    <p className="text-sm font-medium">{foundStudent.student_id}</p>
                  </div>
                )}
                
                {foundStudent.year_level && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Year Level</p>
                    <p className="text-sm font-medium">{foundStudent.year_level}</p>
                  </div>
                )}
                
                {foundStudent.section && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Section</p>
                    <p className="text-sm font-medium">{foundStudent.section}</p>
                  </div>
                )}
                
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Email</p>
                  <p className="text-sm font-medium break-all">{studentEmail}</p>
                </div>
              </div>
              
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  We've sent a verification link to your email. Click the link to verify your account.
                </AlertDescription>
              </Alert>

              <div className="text-center text-sm text-muted-foreground">
                <p>Didn't receive the email?</p>
                <Button 
                  variant="link" 
                  onClick={handleResendVerification}
                  disabled={resendingEmail}
                  className="p-0 h-auto"
                >
                  {resendingEmail ? "Sending..." : "Click here to resend"}
                </Button>
              </div>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={resetFlow}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Use Different Email
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-4">
            After verifying your email, you'll be able to set your password and access your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-accent/5 to-success/5">
      {/* Language Selector - Fixed Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <CompactLanguageSelector />
      </div>

      {/* Show loading modal while submitting */}
      {isLoading && (
        <EmailLoadingModal 
          isOpen={true}
          isSuccess={false}
          emailType="custom"
          customMessage={studentPasswordSetup ? "Creating your password..." : "Looking up your account..."}
        />
      )}

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
            <CardTitle>Student Login</CardTitle>
            <CardDescription>Access your student account</CardDescription>
          </CardHeader>
          <CardContent>
            {!foundStudent ? (
              // Step 1: Email lookup (skip if coming from email verification)
              <form onSubmit={handleStudentEmailSubmit} className="space-y-4">
                {studentError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{studentError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="student-email">Email Address</Label>
                  <Input 
                    id="student-email" 
                    type="email" 
                    placeholder="your@email.com" 
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    disabled={isLoading}
                    required 
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter your email address to look up your student account
                </p>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Looking up account..." : "Continue"}
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
            ) : studentPasswordSetup ? (
              // Step 2: Create password (first-time setup)
              <form onSubmit={handleStudentPasswordSetup} className="space-y-4">
                {studentError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{studentError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Welcome, {foundStudent.first_name} {foundStudent.last_name || ''}!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isVerified 
                      ? "Email verified! Now create a password to access your account." 
                      : "This is your first time logging in. Please create a password."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-password-setup">Create Password</Label>
                  <Input 
                    id="student-password-setup" 
                    type="password"
                    placeholder="••••••••"
                    value={studentPasswordSetupPassword}
                    onChange={(e) => setStudentPasswordSetupPassword(e.target.value)}
                    disabled={isLoading}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-password-confirm">Confirm Password</Label>
                  <Input 
                    id="student-password-confirm" 
                    type="password"
                    placeholder="••••••••"
                    value={studentPasswordSetupConfirm}
                    onChange={(e) => setStudentPasswordSetupConfirm(e.target.value)}
                    disabled={isLoading}
                    required 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Setting password..." : "Create Password & Login"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={resetFlow}
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Use Different Email
                </Button>
              </form>
            ) : (
              // Step 2: Normal login (password already set)
              <form onSubmit={handleStudentPasswordLogin} className="space-y-4">
                {studentError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{studentError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Welcome back, {foundStudent.first_name}!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {foundStudent.email}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="student-login-password">Password</Label>
                  <Input 
                    id="student-login-password" 
                    type="password"
                    placeholder="••••••••"
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    disabled={isLoading}
                    required 
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full"
                  onClick={resetFlow}
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Use Different Email
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default StudentLogin;
