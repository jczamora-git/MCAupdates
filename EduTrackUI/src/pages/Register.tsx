import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ChevronRight, ChevronLeft, UserPlus, FileText, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS, apiGet } from "@/lib/api";
import { CompactLanguageSelector } from "@/components/LanguageSelector";
import { useTranslatedTexts } from "@/context/TranslationContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface RegisterFormData {
  childFirstName: string;
  childMiddleName: string;
  childLastName: string;
  parentEmail: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

const REGISTER_TEXT_STRINGS = [
  "Child's first name is required",
  "Child's last name is required",
  "Email is required",
  "Please enter a valid email address",
  "Phone number is required",
  "Please enter a valid 11-digit phone number starting with 09",
  "Password is required",
  "Password must be at least 6 characters",
  "Passwords do not match",
  "Please use @gmail.com or @yahoo.com email address",
  "Please read and accept the Data Privacy terms",
  "Account created successfully!",
  "Account created but auto-login failed. Please log in manually.",
  "Registration failed",
  "An error occurred during registration",
  "Creating Account...",
  "Create Account",
  "Maranatha Christian Academy",
  "Foundation Calapan City Inc.",
  "Enroll Your Child Now",
  "Create account for your child and start journey with us",
  "Child Information",
  "Enter your child's basic details",
  "Secure Account",
  "Create your login credentials",
  "Account Setup",
  "Fill in your information to get started",
  "Please check the form for errors",
  "Child's First Name *",
  "e.g., Juan",
  "Child's Middle Name (optional)",
  "e.g., Santos",
  "Child's Last Name *",
  "e.g., Dela Cruz",
  "Parent/Guardian Email Address *",
  "your@email.com",
  "📧 Use @gmail.com or @yahoo.com - Please ensure this account is active and can receive emails for school updates",
  "Parent's Contact Number *",
  "09XXXXXXXXX",
  "📱 This is used for updates and emergency contacts",
  "Create Account Password *",
  "🔒 Minimum 6 characters recommended",
  "Confirm Password *",
  "Data Privacy Act Compliance",
  "As per Republic Act No. 10173 (Data Privacy Act of 2012), we need your consent for data collection and media posting.",
  "Read Data Privacy Terms & Consent Form",
  "Privacy terms accepted",
  "(Photos/Videos: Allowed)",
  "(Photos/Videos: Not Allowed)",
  "Already have an account?",
  "Sign In Here",
  "Questions? Contact our admissions team at",
  "Data Privacy Act of 2012 - Consent Form",
  "Dear MCAFCAL Parents,",
  "Blessings! Maranatha Christian Foundation Calapan City, Inc. would like to thank you for your endless support and participation in MCAFCAL activities.",
  "Republic Act No. 10173 (Data Privacy Act of 2012)",
  '"The school is not allowed to post pictures and videos online without the parents\' consent."',
  "As a compliant with the aforementioned Law, we would like to ask permission during our school programs and activities in the MCA Foundation Calapan City, Inc Social Media Accounts – Facebook and Instagram for the Academic Year",
  "Your Consent/Decision",
  "Kindly check your preferred statement below that signifies your consent/decision and complete this form. Be rest assured that, without your consent, the pictures/videos of your child/ren will not be posted online.",
  "✓ Yes,",
  "I allow MCA Foundation Calapan City, Inc. to post my child's pictures/videos online.",
  "✗ No,",
  "I don't allow MCA Foundation Calapan City, Inc. to post my child's pictures/videos online.",
  "Thank you very much for your continuous support in all our undertakings. God bless you and your whole family.",
  "For your kid's sake,",
  "Terms of Service & Privacy Policy",
  "By creating an account, you agree to:",
  "Provide accurate and complete information",
  "Maintain the security of your account credentials",
  "Accept responsibility for all activities under your account",
  "Allow the school to collect and process necessary personal data for enrollment purposes",
  "Receive important communications regarding your child's education",
  "Comply with school policies and procedures",
  "Please select your consent preference",
  "Accept & Continue",
  "Cancel",
  "Hide password",
  "Show password",
  "Hide confirm password",
  "Show confirm password",
  "Maranatha Christian Academy Foundation Calapan City Inc.",
  "Maranatha Christian Academy is a private school, non-stock, non-profit, and non-sectarian educational institution that offers transformative quality education aimed at producing empowered and socially-responsible servant-leaders with high regard to their Christian values.",
  "is a private school, non-stock, non-profit, and non-sectarian educational institution that offers transformative quality education aimed at producing empowered and socially-responsible servant-leaders with high regard to their Christian values.",
] as const;

const Register = () => {
  const navigate = useNavigate();
  const { register, login, user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<RegisterFormData>({
    childFirstName: "",
    childMiddleName: "",
    childLastName: "",
    parentEmail: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState<'allow' | 'deny' | null>(null);
  const [activeSchoolYear, setActiveSchoolYear] = useState<string>('2023-2024');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const translatedTexts = useTranslatedTexts([...REGISTER_TEXT_STRINGS]);
  const t = {
    childFirstNameRequired: translatedTexts[0],
    childLastNameRequired: translatedTexts[1],
    emailRequired: translatedTexts[2],
    validEmailRequired: translatedTexts[3],
    phoneRequired: translatedTexts[4],
    validPhoneRequired: translatedTexts[5],
    passwordRequired: translatedTexts[6],
    passwordMinLength: translatedTexts[7],
    passwordMismatch: translatedTexts[8],
    allowedEmailDomains: translatedTexts[9],
    acceptPrivacyRequired: translatedTexts[10],
    accountCreated: translatedTexts[11],
    autoLoginFailed: translatedTexts[12],
    registrationFailed: translatedTexts[13],
    registrationError: translatedTexts[14],
    creatingAccount: translatedTexts[15],
    createAccount: translatedTexts[16],
    schoolName: translatedTexts[17],
    schoolTagline: translatedTexts[18],
    enrollNow: translatedTexts[19],
    enrollSubtitle: translatedTexts[20],
    childInformation: translatedTexts[21],
    childInformationDesc: translatedTexts[22],
    secureAccount: translatedTexts[23],
    secureAccountDesc: translatedTexts[24],
    accountSetup: translatedTexts[25],
    accountSetupDesc: translatedTexts[26],
    checkErrors: translatedTexts[27],
    childFirstNameLabel: translatedTexts[28],
    childFirstNamePlaceholder: translatedTexts[29],
    childMiddleNameLabel: translatedTexts[30],
    childMiddleNamePlaceholder: translatedTexts[31],
    childLastNameLabel: translatedTexts[32],
    childLastNamePlaceholder: translatedTexts[33],
    parentEmailLabel: translatedTexts[34],
    parentEmailPlaceholder: translatedTexts[35],
    emailNote: translatedTexts[36],
    phoneLabel: translatedTexts[37],
    phonePlaceholder: translatedTexts[38],
    phoneNote: translatedTexts[39],
    passwordLabel: translatedTexts[40],
    passwordNote: translatedTexts[41],
    confirmPasswordLabel: translatedTexts[42],
    privacyTitle: translatedTexts[43],
    privacyDesc: translatedTexts[44],
    readPrivacy: translatedTexts[45],
    privacyAccepted: translatedTexts[46],
    allowSuffix: translatedTexts[47],
    denySuffix: translatedTexts[48],
    alreadyHaveAccount: translatedTexts[49],
    signIn: translatedTexts[50],
    questionsContact: translatedTexts[51],
    privacyModalTitle: translatedTexts[52],
    dearParents: translatedTexts[53],
    blessingsText: translatedTexts[54],
    privacyActTitle: translatedTexts[55],
    privacyQuote: translatedTexts[56],
    privacyYearPrefix: translatedTexts[57],
    consentTitle: translatedTexts[58],
    consentDesc: translatedTexts[59],
    yesLabel: translatedTexts[60],
    allowText: translatedTexts[61],
    noLabel: translatedTexts[62],
    denyText: translatedTexts[63],
    thanksText: translatedTexts[64],
    forKidsSake: translatedTexts[65],
    termsTitle: translatedTexts[66],
    termsIntro: translatedTexts[67],
    term1: translatedTexts[68],
    term2: translatedTexts[69],
    term3: translatedTexts[70],
    term4: translatedTexts[71],
    term5: translatedTexts[72],
    term6: translatedTexts[73],
    selectConsent: translatedTexts[74],
    acceptContinue: translatedTexts[75],
    cancel: translatedTexts[76],
    hidePassword: translatedTexts[77],
    showPassword: translatedTexts[78],
    hideConfirmPassword: translatedTexts[79],
    showConfirmPassword: translatedTexts[80],
    privacyModalSchoolName: translatedTexts[81],
    footerDescription: translatedTexts[82],
    footerSuffix: translatedTexts[83],
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/enrollee/dashboard", { replace: true });
    }
  }, [user, navigate]);

  // Fetch active academic period for dynamic school year
  useEffect(() => {
    const fetchActiveSchoolYear = async () => {
      try {
        const response = await apiGet(API_ENDPOINTS.ACADEMIC_PERIODS_ACTIVE);
        if (response?.success && response?.data?.school_year) {
          setActiveSchoolYear(response.data.school_year);
        }
      } catch (error) {
        console.error('Error fetching active school year:', error);
        // Keep default 2023-2024 if fetch fails
      }
    };
    fetchActiveSchoolYear();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.childFirstName.trim()) {
      newErrors.childFirstName = t.childFirstNameRequired;
    }

    if (!formData.childLastName.trim()) {
      newErrors.childLastName = t.childLastNameRequired;
    }

    if (!formData.parentEmail.trim()) {
      newErrors.parentEmail = t.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parentEmail)) {
      newErrors.parentEmail = t.validEmailRequired;
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = t.phoneRequired;
    } else if (!/^09\d{9}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = t.validPhoneRequired;
    }

    if (!formData.password) {
      newErrors.password = t.passwordRequired;
    } else if (formData.password.length < 6) {
      newErrors.password = t.passwordMinLength;
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t.passwordMismatch;
    }

    // Restrict signup to allowed email domains
    const allowedDomains = ["@gmail.com", "@yahoo.com"];
    const emailToCheck = formData.parentEmail.trim().toLowerCase();
    const domainAllowed = allowedDomains.some((d) => emailToCheck.endsWith(d));
    if (formData.parentEmail && !domainAllowed) {
      newErrors.parentEmail = t.allowedEmailDomains;
    }

    if (!hasAcceptedPrivacy) {
      toast.error(t.acceptPrivacyRequired);
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
    const sanitizeNameInput = (input: string): string => {
      return input
        .replace(/[^A-Za-z.\s]/g, "")
        .replace(/\s{2,}/g, " ")
        .trimStart();
    };

    const sanitizePhoneInput = (input: string): string => {
      const digitsOnly = input.replace(/\D/g, "");
      if (!digitsOnly) return "";

      if (digitsOnly.startsWith("09")) {
        return digitsOnly.slice(0, 11);
      }

      if (digitsOnly.startsWith("9")) {
        return `0${digitsOnly}`.slice(0, 11);
      }

      if (digitsOnly.startsWith("0")) {
        return `09${digitsOnly.slice(1)}`.slice(0, 11);
      }

      return `09${digitsOnly}`.slice(0, 11);
    };

    const normalizedValue =
      field === "phoneNumber"
        ? sanitizePhoneInput(value)
        : field === "childFirstName" || field === "childMiddleName" || field === "childLastName"
          ? sanitizeNameInput(value)
          : value;

    setFormData((prev) => ({
      ...prev,
      [field]: normalizedValue,
    }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Register as enrollee
      const result = await register(
        formData.parentEmail,
        formData.password,
        formData.childFirstName,
        formData.childMiddleName,
        formData.childLastName,
        "enrollee",
        formData.phoneNumber
      );

      if (result && result.success) {
        // Auto-login after successful registration
        const loginSuccess = await login(formData.parentEmail, formData.password);

        if (loginSuccess) {
          toast.success(t.accountCreated);
          // useEffect will handle redirect to /enrollee/dashboard
        } else {
          toast.error(t.autoLoginFailed);
          navigate("/auth");
        }
      } else {
        toast.error(result?.message || t.registrationFailed);
      }
    } catch (error) {
      toast.error(t.registrationError);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-3 sm:p-4">
      {/* Language Selector - Fixed Top Right */}
      <div className="fixed top-2 right-4 sm:top-4 sm:right-4 z-50">
        <div className="rounded-full bg-white/95 border border-slate-200 shadow-sm backdrop-blur p-1 sm:p-0 sm:bg-transparent sm:border-0 sm:shadow-none">
          <CompactLanguageSelector className="h-8 w-8 sm:h-10 sm:w-10 [&_svg]:h-4 [&_svg]:w-4 sm:[&_svg]:h-5 sm:[&_svg]:w-5" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Header Section - Logo */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-2xl sm:rounded-3xl p-4 sm:p-10 mb-5 sm:mb-8 shadow-xl">
          <div className="text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
              <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="Maranatha Christian Academy" className="h-12 sm:h-16 object-contain" />
              <div className="text-center sm:text-left">
                <p className="text-white text-lg sm:text-3xl font-extrabold leading-tight font-montserrat">{t.schoolName}</p>
                <p className="text-white text-xs sm:text-lg font-medium font-montserrat">{t.schoolTagline}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5 sm:mb-8 h-1.5 sm:h-2 bg-white rounded-full overflow-hidden shadow-sm">
          <div className="h-full bg-gradient-to-r from-blue-600 to-blue-700 w-full"></div>
        </div>

        {/* Welcome Section */}
        <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-0 shadow-md mb-5 sm:mb-6">
          <CardContent className="p-5 sm:p-8">
            <h2 className="text-center text-xl sm:text-2xl font-bold text-gray-800">{t.enrollNow}</h2>
            <p className="text-center text-sm sm:text-base text-gray-700 mt-2">{t.enrollSubtitle}</p>
          </CardContent>
        </Card>

        {/* Info Sections Grid */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-5 sm:mb-8">
          {/* Child Information Box */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 12H9m6 0a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-base sm:text-lg">{t.childInformation}</h3>
                <p className="text-gray-600 text-sm mt-1">{t.childInformationDesc}</p>
              </div>
            </div>
          </div>

          {/* Account Setup Box */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-md border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-base sm:text-lg">{t.secureAccount}</h3>
                <p className="text-gray-600 text-sm mt-1">{t.secureAccountDesc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-5 sm:p-10">
            {/* Blue Section Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 sm:p-8 mb-6 sm:mb-10 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">{t.accountSetup}</h3>
                  <p className="text-blue-100 text-sm mt-1">{t.accountSetupDesc}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-7">
              {/* General error message */}
              {Object.keys(errors).length > 0 && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertCircle className="h-5 w-5" />
                  <AlertDescription className="text-red-800 font-medium">
                    {t.checkErrors}
                  </AlertDescription>
                </Alert>
              )}

              {/* Child's First Name */}
              <div className="space-y-3">
                <Label htmlFor="childFirstName" className="text-sm sm:text-base font-bold text-gray-800">{t.childFirstNameLabel}</Label>
                <Input
                  id="childFirstName"
                  type="text"
                  placeholder={t.childFirstNamePlaceholder}
                  value={formData.childFirstName}
                  onChange={(e) => handleInputChange("childFirstName", e.target.value)}
                  className={`h-11 sm:h-12 text-sm sm:text-base ${errors.childFirstName ? "border-red-500 border-2" : "border-gray-200"}`}
                  disabled={isLoading}
                />
                {errors.childFirstName && (
                  <p className="text-sm text-red-600 font-medium">{errors.childFirstName}</p>
                )}
              </div>

              {/* Child's Middle Name (optional) */}
              <div className="space-y-3">
                <Label htmlFor="childMiddleName" className="text-sm sm:text-base font-bold text-gray-800">{t.childMiddleNameLabel}</Label>
                <Input
                  id="childMiddleName"
                  type="text"
                  placeholder={t.childMiddleNamePlaceholder}
                  value={formData.childMiddleName}
                  onChange={(e) => handleInputChange("childMiddleName", e.target.value)}
                  className={`h-11 sm:h-12 text-sm sm:text-base ${errors.childMiddleName ? "border-red-500 border-2" : "border-gray-200"}`}
                  disabled={isLoading}
                />
                {errors.childMiddleName && (
                  <p className="text-sm text-red-600 font-medium">{errors.childMiddleName}</p>
                )}
              </div>

              {/* Child's Last Name */}
              <div className="space-y-3">
                <Label htmlFor="childLastName" className="text-sm sm:text-base font-bold text-gray-800">{t.childLastNameLabel}</Label>
                <Input
                  id="childLastName"
                  type="text"
                  placeholder={t.childLastNamePlaceholder}
                  value={formData.childLastName}
                  onChange={(e) => handleInputChange("childLastName", e.target.value)}
                  className={`h-11 sm:h-12 text-sm sm:text-base ${errors.childLastName ? "border-red-500 border-2" : "border-gray-200"}`}
                  disabled={isLoading}
                />
                {errors.childLastName && (
                  <p className="text-sm text-red-600 font-medium">{errors.childLastName}</p>
                )}
              </div>

              {/* Parent/Guardian Email */}
              <div className="space-y-3">
                <Label htmlFor="parentEmail" className="text-sm sm:text-base font-bold text-gray-800">{t.parentEmailLabel}</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  placeholder={t.parentEmailPlaceholder}
                  value={formData.parentEmail}
                  onChange={(e) => handleInputChange("parentEmail", e.target.value)}
                  className={`h-11 sm:h-12 text-sm sm:text-base ${errors.parentEmail ? "border-red-500 border-2" : "border-gray-200"}`}
                  disabled={isLoading}
                />
                {errors.parentEmail && (
                  <p className="text-sm text-red-600 font-medium">{errors.parentEmail}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {t.emailNote}
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-3">
                <Label htmlFor="phoneNumber" className="text-sm sm:text-base font-bold text-gray-800">{t.phoneLabel}</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder={t.phonePlaceholder}
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                  className={`h-11 sm:h-12 text-sm sm:text-base ${errors.phoneNumber ? "border-red-500 border-2" : "border-gray-200"}`}
                  disabled={isLoading}
                  maxLength={11}
                  inputMode="numeric"
                  pattern="09[0-9]{9}"
                />
                {errors.phoneNumber && (
                  <p className="text-sm text-red-600 font-medium">{errors.phoneNumber}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">{t.phoneNote}</p>
              </div>

              {/* Account Password */}
              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm sm:text-base font-bold text-gray-800">{t.passwordLabel}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={`h-11 sm:h-12 text-sm sm:text-base pr-11 ${errors.password ? "border-red-500 border-2" : "border-gray-200"}`}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                    aria-label={showPassword ? t.hidePassword : t.showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600 font-medium">{errors.password}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">{t.passwordNote}</p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="text-sm sm:text-base font-bold text-gray-800">{t.confirmPasswordLabel}</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className={`h-11 sm:h-12 text-sm sm:text-base pr-11 ${errors.confirmPassword ? "border-red-500 border-2" : "border-gray-200"}`}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                    aria-label={showConfirmPassword ? t.hideConfirmPassword : t.showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-600 font-medium">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Data Privacy Consent */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 sm:p-5 my-5 sm:my-7">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h4 className="font-bold text-gray-800">{t.privacyTitle}</h4>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {t.privacyDesc}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="w-full border-blue-300 hover:bg-blue-100 h-auto py-2 px-3 text-xs sm:text-sm whitespace-normal break-words"
                    disabled={isLoading}
                  >
                    <span className="inline-flex items-center justify-center gap-2 w-full text-center leading-snug">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span>{t.readPrivacy}</span>
                    </span>
                  </Button>
                  {hasAcceptedPrivacy && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-green-800">
                        {t.privacyAccepted} {privacyConsent === 'allow' ? t.allowSuffix : t.denySuffix}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-13 text-sm sm:text-base font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
                  disabled={isLoading}
                >
                  {isLoading ? t.creatingAccount : t.createAccount}
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </form>

            <div className="border-t border-gray-200 mt-6 sm:mt-8 pt-6 sm:pt-8">
              <p className="text-center text-gray-700">
                {t.alreadyHaveAccount}{" "}
                <button
                  onClick={() => navigate("/auth")}
                  className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  {t.signIn}
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 sm:mt-12 text-center space-y-4 px-4 sm:px-6 py-6 sm:py-8 bg-white rounded-2xl shadow-md border border-blue-100">
          <p className="text-gray-700 text-base leading-relaxed">
            <span className="font-bold text-blue-600">{t.schoolName}</span> {t.footerSuffix}
          </p>
          <p className="text-gray-600 text-sm pt-4 border-t border-gray-200">
            {t.questionsContact} <span className="font-semibold text-blue-600">mca.calapan@gmail.com</span>
          </p>
        </div>
      </div>

      {/* Data Privacy Modal */}
      <Dialog open={isPrivacyModalOpen} onOpenChange={setIsPrivacyModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-2xl font-bold text-blue-700 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              {t.privacyModalTitle}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">{t.privacyModalSchoolName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Header Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>{t.dearParents}</strong>
              </p>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                {t.blessingsText}
              </p>
            </div>

            {/* Privacy Act Notice */}
            <div className="space-y-3">
              <h3 className="font-bold text-gray-800 text-lg">{t.privacyActTitle}</h3>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-sm text-gray-700 leading-relaxed italic">
                  {t.privacyQuote}
                </p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                {t.privacyYearPrefix} {activeSchoolYear}.
              </p>
            </div>

            {/* Consent Section */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 text-lg">{t.consentTitle}</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {t.consentDesc}
              </p>

              {/* Radio Options */}
              <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <label className="flex items-start space-x-3 cursor-pointer hover:bg-white p-3 rounded-lg transition-colors">
                  <input
                    type="radio"
                    name="privacy-consent"
                    value="allow"
                    checked={privacyConsent === 'allow'}
                    onChange={(e) => setPrivacyConsent(e.target.value as 'allow')}
                    className="mt-1 h-4 w-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 leading-relaxed">
                    <strong>{t.yesLabel}</strong> {t.allowText}
                  </span>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer hover:bg-white p-3 rounded-lg transition-colors">
                  <input
                    type="radio"
                    name="privacy-consent"
                    value="deny"
                    checked={privacyConsent === 'deny'}
                    onChange={(e) => setPrivacyConsent(e.target.value as 'deny')}
                    className="mt-1 h-4 w-4 accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 leading-relaxed">
                    <strong>{t.noLabel}</strong> {t.denyText}
                  </span>
                </label>
              </div>
            </div>

            {/* Additional Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                {t.thanksText}
              </p>
              <p className="text-sm text-gray-700 mt-3 italic">
                <strong>{t.forKidsSake}</strong>
              </p>
            </div>

            {/* Terms of Service */}
            <div className="space-y-3">
              <h3 className="font-bold text-gray-800 text-lg">{t.termsTitle}</h3>
              <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
                <p>{t.termsIntro}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>{t.term1}</li>
                  <li>{t.term2}</li>
                  <li>{t.term3}</li>
                  <li>{t.term4}</li>
                  <li>{t.term5}</li>
                  <li>{t.term6}</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-3">
            <Button
              onClick={() => {
                if (privacyConsent) {
                  setHasAcceptedPrivacy(true);
                  setIsPrivacyModalOpen(false);
                  toast.success(t.privacyAccepted);
                } else {
                  toast.error(t.selectConsent);
                }
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {t.acceptContinue}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsPrivacyModalOpen(false)}
              className="w-full"
            >
              {t.cancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Register;
