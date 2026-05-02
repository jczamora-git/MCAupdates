import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Info, Lock, Phone } from "lucide-react";
import { EnrollmentFormData } from "../EnrollmentForm";
import { useAuth } from "@/hooks/useAuth";

interface Step1Props {
  formData: EnrollmentFormData;
  updateFormData: (updates: Partial<EnrollmentFormData>) => void;
  errors: Record<string, string>;
  isReturningStudent?: boolean;
  isFirstTimer?: boolean;
  currentGrade?: string;
  nextGrade?: string;
}

const yearLevels = [
  "Nursery 1",
  "Nursery 2",
  "Kinder",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
];

const Step1StudentInfo = ({ formData, updateFormData, errors, isReturningStudent = false, isFirstTimer = true, currentGrade = "", nextGrade = "" }: Step1Props) => {
  const { user } = useAuth();
  
  // Pre-populate name from user profile on mount
  useEffect(() => {
    if (!user) return;

    const updates: Partial<EnrollmentFormData> = {};
    if (!formData.learner_first_name && user.first_name) updates.learner_first_name = user.first_name;
    if (!formData.learner_middle_name && user.middle_name) updates.learner_middle_name = user.middle_name;
    if (!formData.learner_last_name && user.last_name) updates.learner_last_name = user.last_name;

    if (Object.keys(updates).length > 0) {
      updateFormData(updates);
    }
  }, [user, formData.learner_first_name, formData.learner_middle_name, formData.learner_last_name, updateFormData]);

  const today = new Date();
  const maxDateString = today.toISOString().split("T")[0];

  const sanitizeNameInput = (value: string): string => {
    return value
      .replace(/[^A-Za-z.\s]/g, "")
      .replace(/\s{2,}/g, " ")
      .trimStart();
  };

  const sanitizePhoneInput = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    return digits.slice(0, 11);
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader id="student-info-form-header" className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <User className="h-6 w-6" />
          <div>
            <CardTitle className="text-white text-xl">Student Information</CardTitle>
            <p className="text-orange-100 text-sm mt-1">Provide your child's basic details</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Grade Level Info for Returning Students */}
        {isReturningStudent && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              {isFirstTimer 
                ? `You are enrolling for ${nextGrade}. This is your first enrollment as a student.`
                : `You are currently in ${currentGrade}. You will be enrolling for ${nextGrade}.`
              }
            </AlertDescription>
          </Alert>
        )}
        
        {!isFirstTimer && (
          <Alert className="bg-green-50 border-green-200">
            <Info className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Your information from your previous enrollment has been pre-filled. Please review and update if anything has changed.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* First Name */}
          <div>
            <Label htmlFor="firstName" className="text-gray-700 font-semibold text-sm sm:text-base">
              First Name *
            </Label>
            <Input
              id="firstName"
              value={formData.learner_first_name}
              onChange={(e) => updateFormData({ learner_first_name: sanitizeNameInput(e.target.value) })}
              placeholder="e.g., Michela"
              className={`mt-2 text-sm sm:text-base ${errors.learner_first_name ? "border-red-500" : ""}`}
            />
            {errors.learner_first_name && <p className="text-red-600 text-xs sm:text-sm mt-1">{errors.learner_first_name}</p>}
          </div>

          {/* Middle Name */}
          <div>
            <Label htmlFor="middleName" className="text-gray-700 font-semibold text-sm sm:text-base">
              Middle Name
            </Label>
            <Input
              id="middleName"
              value={formData.learner_middle_name}
              onChange={(e) => updateFormData({ learner_middle_name: sanitizeNameInput(e.target.value) })}
              placeholder="e.g., Madrigal"
              className="mt-2 text-sm sm:text-base"
            />
          </div>

          {/* Last Name */}
          <div className="col-span-1 sm:col-span-2">
            <Label htmlFor="lastName" className="text-gray-700 font-semibold text-sm sm:text-base">
              Last Name *
            </Label>
            <Input
              id="lastName"
              value={formData.learner_last_name}
              onChange={(e) => updateFormData({ learner_last_name: sanitizeNameInput(e.target.value) })}
              placeholder="e.g., Caraco"
              className={`mt-2 text-sm sm:text-base ${errors.learner_last_name ? "border-red-500" : ""}`}
            />
            {errors.learner_last_name && <p className="text-red-600 text-xs sm:text-sm mt-1">{errors.learner_last_name}</p>}
          </div>
        </div>

        {/* <p className="text-gray-500 text-xs sm:text-sm -mt-3">Names accept letters and period only (e.g., Jr.)</p> */}

      {/* Birth Date */}
      <div>
        <Label htmlFor="birthDate" className="text-gray-700 font-semibold">
          Birth Date *
        </Label>
        <Input
          id="birthDate"
          type="date"
          value={formData.birth_date}
          onChange={(e) => updateFormData({ birth_date: e.target.value })}
          max={maxDateString}
          className={`mt-2 ${errors.birth_date ? "border-red-500" : ""}`}
        />
        <p className="text-gray-500 text-sm mt-1">Child must be 3 years old or older</p>
        {errors.birth_date && <p className="text-red-600 text-sm mt-1">{errors.birth_date}</p>}
      </div>

      {/* Gender */}
      <div id="gender-container">
        <Label htmlFor="gender" className="text-gray-700 font-semibold">
          Gender *
        </Label>
        <RadioGroup
          id="gender-select"
          value={formData.gender}
          onValueChange={(value) => updateFormData({ gender: value as "Male" | "Female" })}
          className={`mt-3 flex flex-col sm:flex-row gap-3 sm:gap-6 rounded-md border p-3 ${errors.gender ? "border-red-500" : "border-input"}`}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Male" id="gender-male" />
            <Label htmlFor="gender-male" className="font-normal cursor-pointer">Male</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="Female" id="gender-female" />
            <Label htmlFor="gender-female" className="font-normal cursor-pointer">Female</Label>
          </div>
        </RadioGroup>
        {errors.gender && <p className="text-red-600 text-sm mt-1">{errors.gender}</p>}
      </div>

      <div className="col-span-1 sm:col-span-2">
        <Label htmlFor="guardianPhone" className="text-gray-700 font-semibold">
          Guardian Phone Number
        </Label>
        <div className="relative mt-2">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="guardianPhone"
            type="tel"
            value={formData.guardian_phone}
            onChange={(e) => updateFormData({ guardian_phone: sanitizePhoneInput(e.target.value) })}
            placeholder="09XX-XXX-XXXX"
            className="pl-9"
            inputMode="numeric"
            pattern="09[0-9]{9}"
            maxLength={11}
          />
        </div>
      </div>

      {/* Grade Level */}
      <div id="grade-level-container" className="col-span-1 sm:col-span-2">
        <Label htmlFor="gradeLevel" className="text-gray-700 font-semibold">
          Grade Level Applying For *
        </Label>
        
        {isReturningStudent ? (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <Input
                id="gradeLevel"
                value={formData.grade_level}
                disabled
                className="bg-gray-100 cursor-not-allowed text-gray-700 font-semibold"
              />
              <Badge className="bg-blue-500 text-white flex items-center gap-1 px-3 py-1 whitespace-nowrap">
                <Lock className="h-3 w-3" />
                Auto-Assigned
              </Badge>
            </div>
            <p className="text-blue-600 text-sm mt-2">
              Grade level is automatically set to your next level ({formData.grade_level})
            </p>
          </div>
        ) : (
          <Select value={formData.grade_level} onValueChange={(value) => updateFormData({ grade_level: value })}>
            <SelectTrigger id="grade-level-select" className={`mt-2 ${errors.grade_level ? "border-red-500" : ""}`}>
              <SelectValue placeholder="Select grade level" />
            </SelectTrigger>
            <SelectContent>
              {yearLevels.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {errors.grade_level && <p className="text-red-600 text-sm mt-1">{errors.grade_level}</p>}
      </div>
    </CardContent>
    </Card>
  );
};

export default Step1StudentInfo;
