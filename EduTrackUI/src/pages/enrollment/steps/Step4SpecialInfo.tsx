import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useState, useEffect } from "react";
import { EnrollmentFormData } from "../EnrollmentForm";

interface Step4Props {
  formData: EnrollmentFormData;
  updateFormData: (updates: Partial<EnrollmentFormData>) => void;
  errors: Record<string, string>;
  isReturningStudent?: boolean;
  isFirstTimer?: boolean;
}

const specialInfoTourSteps: Step[] = [
  {
    target: 'body',
    content: (
      <div className="text-left">
        <h3 className="font-bold text-lg mb-2">Special Information 📋</h3>
        <p>Please answer these important questions about your child for proper support and records.</p>
      </div>
    ),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#enrollment-type-display',
    content: 'This shows your enrollment type that was selected earlier.',
  },
  {
    target: '#indigenous-ip-section',
    content: 'Check this if your child belongs to an Indigenous Peoples group.',
  },
  {
    target: '#four-ps-section',
    content: 'Check this if your child is a beneficiary of the 4Ps program.',
  },
  {
    target: '#disability-section',
    content: 'Check this if your child has any disability or special needs.',
  },
  {
    target: '#disability-type-input',
    content: 'If you checked disability above, please specify the type here.',
  },
  {
    target: '#special-language-input',
    content: 'If your child needs special language or communication support, mention it here. These questions are optional - if none apply to your child, you can skip them.',
  }
];

const Step4SpecialInfo = ({ formData, updateFormData, errors, isReturningStudent = false, isFirstTimer = true }: Step4Props) => {
  // Tour State
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    // Auto start tour for step 4
    const hasSeenTour = localStorage.getItem('hasSeenSpecialInfoTour');
    if (!hasSeenTour) {
      setRunTour(true);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
      localStorage.setItem('hasSeenSpecialInfoTour', 'true');
    }
  };

  const getEnrollmentTypeInfo = () => {
    switch (formData.enrollment_type) {
      case 'New Student':
        return { label: 'New Student', description: 'First time enrolling at Maranatha', color: 'blue' };
      case 'Continuing Student':
        return { label: 'Continuing Student', description: 'Currently enrolled, progressing to next grade', color: 'green' };
      case 'Returning Student':
        return { label: 'Returning Student', description: 'Previously enrolled, returning to Maranatha', color: 'green' };
      case 'Transferee':
        return { label: 'Transferee', description: 'Transferring from another school', color: 'purple' };
      default:
        return { label: 'Not specified', description: 'Enrollment type not selected', color: 'gray' };
    }
  };

  const typeInfo = getEnrollmentTypeInfo();

  return (
    <div className="space-y-6">
      <p className="text-gray-600">Please answer the following questions about your child.</p>

      {!isFirstTimer && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Your special information from your previous enrollment has been pre-filled.
          </AlertDescription>
        </Alert>
      )}

      {/* Enrollment Type - Display Only */}
      <div id="enrollment-type-display" className={`p-4 bg-${typeInfo.color}-50 rounded-lg border-2 border-${typeInfo.color}-200`}>
        <Label className="text-gray-700 font-semibold mb-2 block">
          Enrollment Type
        </Label>
        <div className="flex items-center gap-3">
          <Badge className={`bg-${typeInfo.color}-600 text-white px-3 py-1 text-sm`}>
            {typeInfo.label}
          </Badge>
          <p className="text-gray-600 text-sm">{typeInfo.description}</p>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {isReturningStudent ? "Automatically set for continuing students." : "This was selected at the start of the enrollment process."}
        </p>
      </div>

      {/* Indigenous IP */}
      <div id="indigenous-ip-section" className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <Checkbox
          id="indigenousIP"
          checked={formData.is_indigenous_ip}
          onCheckedChange={(checked) => updateFormData({ is_indigenous_ip: checked as boolean })}
        />
        <div className="flex-1">
          <Label htmlFor="indigenousIP" className="text-gray-700 font-semibold cursor-pointer">
            Is the child a member of an Indigenous Peoples (IP) group?
          </Label>
          <p className="text-gray-500 text-sm mt-1">For DepEd records and cultural support programs</p>
        </div>
      </div>

      {/* 4Ps Beneficiary */}
      <div id="four-ps-section" className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <Checkbox
          id="fourPsBeneficiary"
          checked={formData.is_4ps_beneficiary}
          onCheckedChange={(checked) => updateFormData({ is_4ps_beneficiary: checked as boolean })}
        />
        <div className="flex-1">
          <Label htmlFor="fourPsBeneficiary" className="text-gray-700 font-semibold cursor-pointer">
            Is the child a beneficiary of the 4Ps program?
          </Label>
          <p className="text-gray-500 text-sm mt-1">Pantawid Pamilyang Pilipino Program (Conditional Cash Transfer)</p>
        </div>
      </div>

      {/* Learner with Disability */}
      <div id="disability-section" className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <Checkbox
          id="hasDisability"
          checked={formData.has_disability}
          onCheckedChange={(checked) => updateFormData({ has_disability: checked as boolean })}
        />
        <div className="flex-1">
          <Label htmlFor="hasDisability" className="text-gray-700 font-semibold cursor-pointer">
            Does the child have a disability or special needs?
          </Label>
          <p className="text-gray-500 text-sm mt-1">We provide inclusive support and accommodations</p>
        </div>
      </div>

      {/* Disability Type (Conditional) */}
      {formData.has_disability && (
        <div>
          <Label htmlFor="disabilityType" className="text-gray-700 font-semibold">
            Please specify the type of disability *
          </Label>
          <Input
            id="disability-type-input"
            value={formData.disability_type}
            onChange={(e) => updateFormData({ disability_type: e.target.value })}
            placeholder="e.g., Hearing Impairment, Visual Impairment, Physical Disability, Autism Spectrum Disorder, etc."
            className={`mt-2 ${errors.disability_type ? "border-red-500" : ""}`}
          />
          {errors.disability_type && <p className="text-red-600 text-sm mt-1">{errors.disability_type}</p>}
        </div>
      )}

      {/* Special Language */}
      <div>
        <Label htmlFor="specialLanguage" className="text-gray-700 font-semibold">
          Special Language or Communication Needs
        </Label>
        <Input
          id="special-language-input"
          value={formData.special_language}
          onChange={(e) => updateFormData({ special_language: e.target.value })}
          placeholder="e.g., English, Sign Language, Speech Therapy, etc."
          className="mt-2"
        />
        <p className="text-gray-500 text-sm mt-1">If applicable, any special language or communication support needed</p>
      </div>

      <Joyride
        steps={specialInfoTourSteps}
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
  );
};

export default Step4SpecialInfo;
