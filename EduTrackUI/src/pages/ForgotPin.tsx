import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINTS, apiPost } from '@/lib/api';
import EmailLoadingModal from '@/components/EmailLoadingModal';

export default function ForgotPin() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Pre-fill email if passed from VerifyPin page
  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    setShowEmailModal(true);
    setEmailSuccess(false);

    try {
      const response = await apiPost(API_ENDPOINTS.REQUEST_PIN_RESET, { email });

      if (response.success) {
        setEmailSuccess(true);
        // Wait a bit before showing success screen
        setTimeout(() => {
          setEmailSent(true);
        }, 2000);
      } else {
        setShowEmailModal(false);
        toast.error(response.message || 'Failed to send reset email');
      }
    } catch (error: any) {
      console.error('Forgot PIN error:', error);
      setShowEmailModal(false);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailModalComplete = () => {
    setShowEmailModal(false);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription className="text-base mt-2">
              We've sent PIN reset instructions to <span className="font-medium text-gray-900">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 leading-relaxed">
                Click the link in the email to reset your payment PIN. The link will expire in 24 hours.
              </p>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <p>Didn't receive the email?</p>
              <ul className="list-disc list-inside space-y-1 text-gray-500">
                <li>Check your spam or junk folder</li>
                <li>Make sure the email address is correct</li>
                <li>Wait a few minutes for the email to arrive</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                onClick={() => {
                  setEmailSent(false);
                  setEmail('');
                  setEmailSuccess(false);
                  setShowEmailModal(false);
                }}
                variant="outline"
                className="w-full"
              >
                Send to Different Email
              </Button>
              <Link to="/auth" className="w-full">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        
        <EmailLoadingModal
          isOpen={showEmailModal}
          isSuccess={emailSuccess}
          customMessage="Sending PIN reset email..."
          customSuccessMessage="PIN reset email has been sent"
          onComplete={handleEmailModalComplete}
          autoCloseDuration={2000}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Forgot Your PIN?</CardTitle>
          <CardDescription className="text-base mt-2">
            Enter your email address and we'll send you instructions to reset your payment PIN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> You can use any email address you have access to. When you click the reset link, you'll need to verify your identity with your student ID (e.g., MCAF2025-00000) or registered email to complete the reset.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Instructions'}
            </Button>

            <div className="text-center">
              <Link
                to="/auth"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center"
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <EmailLoadingModal
        isOpen={showEmailModal}
        isSuccess={emailSuccess}
        customMessage="Sending PIN reset email..."
        customSuccessMessage="PIN reset email has been sent"
        onComplete={handleEmailModalComplete}
        autoCloseDuration={2000}
      />
    </div>
  );
}
