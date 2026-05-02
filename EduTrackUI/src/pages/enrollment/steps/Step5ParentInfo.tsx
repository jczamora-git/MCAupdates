import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Info } from "lucide-react";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useState, useEffect } from "react";
import { EnrollmentFormData } from "../EnrollmentForm";

interface Step5Props {
  formData: EnrollmentFormData;
  updateFormData: (updates: Partial<EnrollmentFormData>) => void;
  errors: Record<string, string>;
  isReturningStudent?: boolean;
  isFirstTimer?: boolean;
}

const parentInfoTourSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div className="text-left">
        <h3 className="font-bold text-lg mb-2">Parent/Guardian Information 👨‍👩‍👧‍👦</h3>
        <p>Please provide contact information for your child's parents or guardians.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#father-name-input',
    content: 'Enter the full name of the father or father figure.',
  },
  {
    target: '#father-contact-input',
    content: 'Enter the father\'s contact number (numbers only).',
  },
  {
    target: '#father-email-input',
    content: 'Enter the father\'s email address (only @gmail.com or @yahoo.com accepted).',
  },
  {
    target: '#mother-name-input',
    content: 'Enter the full name of the mother or mother figure.',
  },
  {
    target: '#mother-contact-input',
    content: 'Enter the mother\'s contact number (numbers only).',
  },
  {
    target: '#mother-email-input',
    content: 'Enter the mother\'s email address (only @gmail.com or @yahoo.com accepted).',
  },
  {
    target: '#guardian-name-input',
    content: 'If applicable, enter the legal guardian\'s full name.',
  },
  {
    target: '#guardian-contact-input',
    content: 'Enter the guardian\'s contact number (numbers only).',
  },
  {
    target: '#guardian-email-input',
    content: 'Enter the guardian\'s email address (only @gmail.com or @yahoo.com accepted). ',
  },
  {
    target: 'body',
    content: 'Remember: At least one parent or guardian contact is required. We will use these contacts for school announcements, emergencies, and enrollment updates.',
    placement: 'center',
  }
];

const Step5ParentInfo = ({ formData, updateFormData, errors, isReturningStudent = false, isFirstTimer = true }: Step5Props) => {
  // Tour State
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    // Auto start tour for step 5
    const hasSeenTour = localStorage.getItem('hasSeenParentInfoTour');
    if (!hasSeenTour) {
      setRunTour(true);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      localStorage.setItem('hasSeenParentInfoTour', 'true');
    }
  };

  // Validate email - only allow Gmail and Yahoo
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Optional field
    const emailRegex = /^[^\s@]+@(gmail\.com|yahoo\.com)$/i;
    return emailRegex.test(email);
  };

  const sanitizePhoneInput = (value: string): string => {
    let digits = value.replace(/\D/g, "");
    if (!digits) return "";

    if (!digits.startsWith("0")) {
      digits = `0${digits}`;
    }
    if (digits.length >= 2 && digits[1] !== "9") {
      digits = `09${digits.slice(2)}`;
    }

    return digits.slice(0, 11);
  };

  const sanitizeNameInput = (value: string): string => {
    return value
      .replace(/[^A-Za-z.\s]/g, "")
      .replace(/\s{2,}/g, " ")
      .trimStart();
  };

  // Handle email input with validation message
  const handleEmailChange = (email: string, fieldName: string) => {
    updateFormData({ [fieldName]: email });
  };
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-blue-600 to-blue-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-white" />
            <div>
              <CardTitle className="text-white text-xl">Parent/Guardian Information</CardTitle>
              <p className="text-orange-100 text-sm mt-1">Provide contact information for at least one parent or guardian</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!isFirstTimer && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Parent/Guardian information from your previous enrollment has been pre-filled. Update if contact details have changed.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
      <Card className="bg-orange-50 border-orange-200">
        <CardHeader>
          <CardTitle className="text-lg text-orange-900">Father / Father Figure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fatherName" className="text-gray-700 font-semibold">
              Full Name
            </Label>
            <Input
              id="father-name-input"
              value={formData.father_name}
              onChange={(e) => updateFormData({ father_name: sanitizeNameInput(e.target.value) })}
              placeholder="e.g., Father Name"
              className="mt-2"
            />
            {/* <p className="text-gray-500 text-sm mt-1">Letters and period only (e.g., Jr.)</p> */}
          </div>

          <div>
            <Label htmlFor="fatherContact" className="text-gray-700 font-semibold">
              Contact Number
            </Label>
            <Input
              id="father-contact-input"
              type="tel"
              value={formData.father_contact}
              onChange={(e) => updateFormData({ father_contact: sanitizePhoneInput(e.target.value) })}
              inputMode="numeric"
              pattern="09[0-9]{9}"
              maxLength={11}
              placeholder="e.g., 09XXXXXXXXX"
              className="mt-2"
            />
            <p className="text-gray-500 text-sm mt-1">Numbers only</p>
          </div>

          <div>
            <Label htmlFor="fatherEmail" className="text-gray-700 font-semibold">
              Email Address
            </Label>
            <Input
              id="father-email-input"
              type="email"
              value={formData.father_email}
              onChange={(e) => handleEmailChange(e.target.value, "father_email")}
              placeholder="e.g., father@gmail.com"
              className={`mt-2 ${formData.father_email && !validateEmail(formData.father_email) ? "border-red-500" : ""}`}
            />
            {formData.father_email && !validateEmail(formData.father_email) && (
              <p className="text-red-600 text-sm mt-1">Only @gmail.com and @yahoo.com are accepted</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mother Information */}
      <Card className="bg-pink-50 border-pink-200">
        <CardHeader>
          <CardTitle className="text-lg text-pink-900">Mother / Mother Figure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="motherName" className="text-gray-700 font-semibold">
              Full Name
            </Label>
            <Input
              id="mother-name-input"
              value={formData.mother_name}
              onChange={(e) => updateFormData({ mother_name: sanitizeNameInput(e.target.value) })}
              placeholder="e.g., Mother Name"
              className="mt-2"
            />
            {/* <p className="text-gray-500 text-sm mt-1">Letters and period only (e.g., Jr.)</p> */}
          </div>

          <div>
            <Label htmlFor="motherContact" className="text-gray-700 font-semibold">
              Contact Number
            </Label>
            <Input
              id="mother-contact-input"
              type="tel"
              value={formData.mother_contact}
              onChange={(e) => updateFormData({ mother_contact: sanitizePhoneInput(e.target.value) })}
              inputMode="numeric"
              pattern="09[0-9]{9}"
              maxLength={11}
              placeholder="e.g., 09XXXXXXXXX"
              className="mt-2"
            />
            <p className="text-gray-500 text-sm mt-1">Numbers only</p>
          </div>

          <div>
            <Label htmlFor="motherEmail" className="text-gray-700 font-semibold">
              Email Address
            </Label>
            <Input
              id="mother-email-input"
              type="email"
              value={formData.mother_email}
              onChange={(e) => handleEmailChange(e.target.value, "mother_email")}
              placeholder="e.g., mother@gmail.com"
              className={`mt-2 ${formData.mother_email && !validateEmail(formData.mother_email) ? "border-red-500" : ""}`}
            />
            {formData.mother_email && !validateEmail(formData.mother_email) && (
              <p className="text-red-600 text-sm mt-1">Only @gmail.com and @yahoo.com are accepted</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Guardian Information */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-lg text-green-900">Legal Guardian (If Applicable)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="guardianName" className="text-gray-700 font-semibold">
              Full Name
            </Label>
            <Input
              id="guardian-name-input"
              value={formData.guardian_name}
              onChange={(e) => updateFormData({ guardian_name: sanitizeNameInput(e.target.value) })}
              placeholder="e.g., Guardian Name"
              className="mt-2"
            />
            {/* <p className="text-gray-500 text-sm mt-1">Only if parents are not available. </p> */}
          </div>

          <div>
            <Label htmlFor="guardianContact" className="text-gray-700 font-semibold">
              Contact Number
            </Label>
            <Input
              id="guardian-contact-input"
              type="tel"
              value={formData.guardian_contact}
              onChange={(e) => updateFormData({ guardian_contact: sanitizePhoneInput(e.target.value) })}
              inputMode="numeric"
              pattern="09[0-9]{9}"
              maxLength={11}
              placeholder="e.g., 09XXXXXXXXX"
              className="mt-2"
            />
            <p className="text-gray-500 text-sm mt-1">Numbers only</p>
          </div>

          <div>
            <Label htmlFor="guardianEmail" className="text-gray-700 font-semibold">
              Email Address
            </Label>
            <Input
              id="guardian-email-input"
              type="email"
              value={formData.guardian_email}
              onChange={(e) => handleEmailChange(e.target.value, "guardian_email")}
              placeholder="e.g., guardian@gmail.com"
              className={`mt-2 ${formData.guardian_email && !validateEmail(formData.guardian_email) ? "border-red-500" : ""}`}
            />
            {formData.guardian_email && !validateEmail(formData.guardian_email) && (
              <p className="text-red-600 text-sm mt-1">Only @gmail.com and @yahoo.com are accepted</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Error */}
      {errors.parents && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{errors.parents}</div>}

      {/* Info */}
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <p className="text-orange-900 text-sm">
          ℹ️ <strong>Important:</strong> We will use these contacts for school announcements, emergencies, and enrollment updates.
        </p>
      </div>

      <Joyride
        steps={parentInfoTourSteps}
        run={runTour}
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
    </div>
  );
};

export default Step5ParentInfo;
