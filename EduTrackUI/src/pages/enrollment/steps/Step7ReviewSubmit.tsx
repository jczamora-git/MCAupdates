import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Info, ScrollText, CheckCircle2 } from "lucide-react";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { EnrollmentFormData } from "../EnrollmentForm";

interface Step7Props {
  formData: EnrollmentFormData;
  updateFormData: (updates: Partial<EnrollmentFormData>) => void;
  errors: Record<string, string>;
  isReturningStudent?: boolean;
}

const Step7ReviewSubmit = ({ formData, updateFormData, errors, isReturningStudent = false }: Step7Props) => {
  // Tour State
  const [runTour, setRunTour] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [tourScrollOffset, setTourScrollOffset] = useState(20);
  const hasCheckedReloadReset = useRef(false);

  const reviewSubmitTourSteps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">📋 Final Review & Submit</h3>
          <p>Please carefully review all your enrollment information before submitting.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.student-info',
      content: 'Review your student information to ensure all details are correct.',
    },
    {
      target: '.address-info',
      content: 'Check your address information for accuracy.',
    },
    {
      target: '.parent-guardian-info',
      content: 'Verify parent/guardian contact information is complete and current.',
    },
    ...(formData.enrollment_type === 'Continuing Student' ? [
      {
        target: '.bg-green-50',
        content: 'Your documents are already on file from previous enrollment.',
      },
    ] : [
      {
        target: '.documents-info',
        content: 'Review the documents you confirmed to submit physically during your enrollment visit.',
      },
    ]),
    {
      target: '.bg-amber-50',
      content: 'Please read and agree to the terms and conditions before submitting.',
    },
    {
      target: '.terms-trigger-button',
      content: 'Open the terms modal, then click "I Have Read and Agree" to confirm your agreement.',
    },
    {
      target: '.bg-blue-50',
      content: 'Final reminder: review everything carefully before submitting your enrollment.',
    },
  ];

  useEffect(() => {
    // Auto start tour for step 7
    const hasSeenTour = localStorage.getItem('reviewSubmitTourCompleted');
    if (!hasSeenTour) {
      setRunTour(true);
    }
  }, []);

  useEffect(() => {
    const updateTourScrollOffset = () => {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;

      if (!isMobile) {
        setTourScrollOffset(20);
        return;
      }

      const mobileHeader = document.querySelector('[data-mobile-header="true"]') as HTMLElement | null;
      const headerHeight = mobileHeader?.getBoundingClientRect().height ?? 56;
      setTourScrollOffset(Math.ceil(headerHeight + 16));
    };

    updateTourScrollOffset();
    window.addEventListener('resize', updateTourScrollOffset);

    return () => {
      window.removeEventListener('resize', updateTourScrollOffset);
    };
  }, []);

  useEffect(() => {
    if (hasCheckedReloadReset.current) {
      return;
    }

    hasCheckedReloadReset.current = true;
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isReload = navEntry?.type === 'reload';

    if (isReload && formData.agreed_to_terms) {
      updateFormData({ agreed_to_terms: false });
    }
  }, [formData.agreed_to_terms, updateFormData]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      localStorage.setItem('reviewSubmitTourCompleted', 'true');
    }
  };
  return (
    <div className="space-y-6">
      <p className="text-gray-600">Please review all information before submitting your enrollment application.</p>

      {isReturningStudent && (
        <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            You are re-enrolling for <strong>{formData.grade_level}</strong>. Your enrollment type has been automatically set to <Badge className="bg-green-600 text-white ml-1">{formData.enrollment_type}</Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Student Information Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm student-info">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm">Full Name</p>
              <p className="font-semibold text-gray-900 text-sm sm:text-base">
                {formData.learner_first_name} {formData.learner_middle_name} {formData.learner_last_name}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Birth Date</p>
              <p className="font-semibold text-gray-900">{formData.birth_date}</p>
            </div>
            <div>
              <p className="text-gray-600">Gender</p>
              <p className="font-semibold text-gray-900">{formData.gender}</p>
            </div>
            <div>
              <p className="text-gray-600">Grade Level</p>
              <p className="font-semibold text-gray-900">{formData.grade_level}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm address-info">
          <div>
            <p className="text-gray-600">Current Address</p>
            <p className="font-semibold text-gray-900">
              {formData.current_address}, {formData.current_municipality}, {formData.current_province} {formData.current_zip_code}
            </p>
          </div>
          {!formData.same_as_current && (
            <div>
              <p className="text-gray-600">Permanent Address</p>
              <p className="font-semibold text-gray-900">
                {formData.permanent_address}, {formData.permanent_municipality}, {formData.permanent_province} {formData.permanent_zip_code}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parent/Guardian Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parent/Guardian Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm parent-guardian-info">
          {formData.father_name && (
            <div className="border-t pt-4 first:border-t-0 first:pt-0">
              <p className="text-gray-600 font-semibold">Father</p>
              <p className="font-semibold text-gray-900">{formData.father_name}</p>
              <p className="text-gray-600">{formData.father_contact}</p>
              <p className="text-gray-600">{formData.father_email}</p>
            </div>
          )}
          {formData.mother_name && (
            <div className="border-t pt-4">
              <p className="text-gray-600 font-semibold">Mother</p>
              <p className="font-semibold text-gray-900">{formData.mother_name}</p>
              <p className="text-gray-600">{formData.mother_contact}</p>
              <p className="text-gray-600">{formData.mother_email}</p>
            </div>
          )}
          {formData.guardian_name && (
            <div className="border-t pt-4">
              <p className="text-gray-600 font-semibold">Guardian</p>
              <p className="font-semibold text-gray-900">{formData.guardian_name}</p>
              <p className="text-gray-600">{formData.guardian_contact}</p>
              <p className="text-gray-600">{formData.guardian_email}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Special Information Review */}
      {(formData.enrollment_type || formData.is_indigenous_ip || formData.is_4ps_beneficiary || formData.has_disability) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Special Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm special-info">
            {formData.enrollment_type && (
              <p className="text-gray-900">
                <strong>✓ Enrollment Type:</strong> {formData.enrollment_type}
              </p>
            )}
            {formData.is_indigenous_ip && (
              <p className="text-gray-900">
                <strong>✓ Indigenous Peoples Member</strong>
              </p>
            )}
            {formData.is_4ps_beneficiary && (
              <p className="text-gray-900">
                <strong>✓ 4Ps Beneficiary</strong>
              </p>
            )}
            {formData.has_disability && (
              <p className="text-gray-900">
                <strong>✓ Learner with Disability</strong> - {formData.disability_type}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents Review - Different for Continuing vs Returning Students */}
      {formData.enrollment_type === 'Continuing Student' ? (
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-base text-green-900">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm documents-info">
            <p className="text-green-800">
              <strong>✓ Documents on File</strong> - Your academic documents from previous years are already on file and do not need to be re-uploaded.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Documents for Physical Submission ({formData.physicalDocumentNames?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm documents-info">
            {formData.physicalDocumentNames && formData.physicalDocumentNames.length > 0 ? (
              <>
                <p className="text-gray-700 mb-2">
                  <strong>You will bring the following documents during your enrollment visit:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1">
                  {formData.physicalDocumentNames.map((docName, index) => (
                    <li key={index} className="text-gray-900">
                      {docName}
                    </li>
                  ))}
                </ul>
                <p className="text-purple-700 mt-3 text-xs">
                  📋 Please bring clear, readable copies of all documents listed above for verification.
                </p>
              </>
            ) : (
              <p className="text-yellow-700">
                No documents marked for physical submission. Please return to Step 6 and confirm which documents you will bring.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Terms and Conditions */}
      <Card className="bg-amber-50 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-amber-900 flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Terms and Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-amber-900 leading-relaxed">Please read the full terms and conditions before agreeing.</p>

          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto terms-trigger-button"
            onClick={() => setShowTermsModal(true)}
          >
            View Terms and Conditions
          </Button>

          {errors.agreed_to_terms && <p className="text-red-600 text-sm">{errors.agreed_to_terms}</p>}
        </CardContent>
      </Card>

      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b bg-gradient-to-r from-amber-50 to-yellow-50">
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <ScrollText className="h-5 w-5" />
              Terms and Conditions
            </DialogTitle>
            <DialogDescription className="text-amber-900/80">
              By submitting this enrollment application, you agree to the following:
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 py-4 overflow-y-auto max-h-[52vh]">
          <ul className="list-decimal list-inside space-y-3 text-sm text-gray-700 leading-relaxed">
            <li>
              All information provided is accurate and truthful to the best of your knowledge.
            </li>
            <li>
              You grant Maranatha Preschool & Elementary School permission to contact you using the phone numbers and email addresses provided.
            </li>
            <li>
              You agree to the school's policies and procedures as outlined in the Parent-Student Handbook.
            </li>
            <li>
              You understand that enrollment is subject to approval by the school administration.
            </li>
            <li>
              All documents submitted will be kept confidential and used only for school purposes.
            </li>
            <li>
              The school may request additional documents or information to complete the enrollment process.
            </li>
            <li>
              You understand the school's fee structure and payment terms for the school year.
            </li>
            <li>
              You agree to comply with the school's attendance and academic performance standards.
            </li>
          </ul>
          </div>

          <div className="px-5 py-4 border-t bg-muted/30 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setShowTermsModal(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                updateFormData({ agreed_to_terms: true });
                setShowTermsModal(false);
              }}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              I Have Read and Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Final Review Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please review all information carefully. Once submitted, you'll receive a confirmation email with your enrollment ID and status tracking information.
        </AlertDescription>
      </Alert>

      <Joyride
        steps={reviewSubmitTourSteps}
        run={runTour}
        scrollOffset={tourScrollOffset}
        disableScrolling={false}
        spotlightPadding={5}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#2563eb',
            zIndex: 1000,
          },
        }}
        locale={{
          last: 'Finish',
          skip: 'Skip',
        }}
      />
    </div>
  );
};

export default Step7ReviewSubmit;
