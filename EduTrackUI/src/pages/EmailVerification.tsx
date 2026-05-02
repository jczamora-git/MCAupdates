import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api";

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already_verified'>('loading');
  const [message, setMessage] = useState('');
  const [userInfo, setUserInfo] = useState<{ email?: string; first_name?: string; role?: string } | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('No verification token provided. Please check your email for the correct link.');
        return;
      }

      try {
        const url = `${API_ENDPOINTS.VERIFY_EMAIL}?token=${encodeURIComponent(token)}`;
        
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
        });

        const data = await response.json();

        if (data.success) {
          if (data.already_verified) {
            setStatus('already_verified');
          } else {
            setStatus('success');
          }
          setMessage(data.message);
          if (data.user) {
            setUserInfo(data.user);
          }
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification failed. Please try again.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('An error occurred during verification. Please try again later.');
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-accent/5 to-success/5">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 hover:opacity-80 transition-opacity">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="EduTrack logo" className="h-12 object-contain" />
        </Link>

        <Card>
          <CardHeader className="text-center">
            {status === 'loading' && (
              <>
                <div className="flex justify-center mb-4">
                  <Loader2 className="h-16 w-16 text-primary animate-spin" />
                </div>
                <CardTitle>Verifying Your Email</CardTitle>
                <CardDescription>Please wait while we verify your email address...</CardDescription>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="flex justify-center mb-4">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>
                <CardTitle className="text-green-600">Email Verified!</CardTitle>
                <CardDescription>{message}</CardDescription>
              </>
            )}

            {status === 'already_verified' && (
              <>
                <div className="flex justify-center mb-4">
                  <Mail className="h-16 w-16 text-blue-500" />
                </div>
                <CardTitle className="text-blue-600">Already Verified</CardTitle>
                <CardDescription>{message}</CardDescription>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="flex justify-center mb-4">
                  <XCircle className="h-16 w-16 text-red-500" />
                </div>
                <CardTitle className="text-red-600">Verification Failed</CardTitle>
                <CardDescription>{message}</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {(status === 'success' || status === 'already_verified') && (
              <>
                {userInfo && (
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Welcome,</p>
                    <p className="font-semibold">{userInfo.first_name}</p>
                    <p className="text-sm text-muted-foreground">{userInfo.email}</p>
                  </div>
                )}
                <Button asChild className="w-full">
                  <Link to="/auth">Sign In to Your Account</Link>
                </Button>
              </>
            )}

            {status === 'error' && (
              <div className="space-y-3">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth">Back to Sign In</Link>
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Need help? Contact support at{' '}
                  <a href="mailto:support@mcc.edu.ph" className="text-primary hover:underline">
                    support@mcc.edu.ph
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailVerification;
