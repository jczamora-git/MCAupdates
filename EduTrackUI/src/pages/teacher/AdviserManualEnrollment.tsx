import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ArrowLeft, Search, CheckCircle2, AlertCircle, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { API_ENDPOINTS, apiGet } from '@/lib/api';
import EmailLoadingModal from '@/components/EmailLoadingModal';

interface EnrollmentFormData {
  // Enrollment Type
  enrollment_type: 'New Student' | 'Transferee' | 'Returning Student' | 'Continuing Student';
  
  // Student Info
  learner_first_name: string;
  learner_middle_name: string;
  learner_last_name: string;
  birth_date: string;
  gender: string;
  guardian_phone: string;
  grade_level: string;

  // Current Address
  current_address: string;
  current_barangay: string;
  current_municipality: string;
  current_province: string;
  current_zip_code: string;
  current_phone: string;

  // Permanent Address
  permanent_address: string;
  permanent_barangay: string;
  permanent_municipality: string;
  permanent_province: string;
  permanent_zip_code: string;
  same_as_current: boolean;

  // Parent/Guardian
  father_name: string;
  father_contact: string;
  father_email: string;
  mother_name: string;
  mother_contact: string;
  mother_email: string;

  // Special Info
  is_returning_student: boolean;
  is_indigenous_ip: boolean;
  is_4ps_beneficiary: boolean;
  has_disability: boolean;
  disability_type: string;
}

interface Region {
  code: string;
  name: string;
}

interface Province {
  code: string;
  name: string;
}

interface CityMunicipality {
  code: string;
  name: string;
}

interface Barangay {
  code: string;
  name: string;
}

const PSGC_API = "https://psgc.gitlab.io/api";

const grades = ['Nursery 1', 'Nursery 2', 'Kinder', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
const enrollmentTypes: Array<'New Student' | 'Transferee' | 'Returning Student' | 'Continuing Student'> = ['New Student', 'Transferee', 'Returning Student', 'Continuing Student'];
const adviserEnrollmentTypes: Array<'New Student' | 'Transferee' | 'Returning Student' | 'Continuing Student'> = ['New Student', 'Transferee', 'Returning Student', 'Continuing Student'];

const initialData: EnrollmentFormData = {
  enrollment_type: 'New Student',
  learner_first_name: '',
  learner_middle_name: '',
  learner_last_name: '',
  birth_date: '',
  gender: '',
  guardian_phone: '',
  grade_level: '',
  current_address: '',
  current_barangay: '',
  current_municipality: '',
  current_province: '',
  current_zip_code: '',
  current_phone: '',
  permanent_address: '',
  permanent_barangay: '',
  permanent_municipality: '',
  permanent_province: '',
  permanent_zip_code: '',
  same_as_current: true,
  father_name: '',
  father_contact: '',
  father_email: '',
  mother_name: '',
  mother_contact: '',
  mother_email: '',
  is_returning_student: false,
  is_indigenous_ip: false,
  is_4ps_beneficiary: false,
  has_disability: false,
  disability_type: '',
};

export default function AdviserManualEnrollment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdviser = user?.role === 'teacher';
  const [formData, setFormData] = useState<EnrollmentFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchSection, setShowSearchSection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previousEnrollmentFound, setPreviousEnrollmentFound] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [adviserLevels, setAdviserLevels] = useState<string[]>([]);
  const [adviserLevel, setAdviserLevel] = useState('');
  const [eligibleStudents, setEligibleStudents] = useState<any[]>([]);
  const [eligibleStudentsLoading, setEligibleStudentsLoading] = useState(false);

  const enrollmentTypeOptions = isAdviser ? adviserEnrollmentTypes : enrollmentTypes;
  const gradeOptions = isAdviser && adviserLevel ? [adviserLevel] : grades;

  // Enrollment conflict modal state
  const [isEnrollmentConflictModalOpen, setIsEnrollmentConflictModalOpen] = useState(false);
  const [conflictEnrollmentData, setConflictEnrollmentData] = useState<any>(null);
  const [conflictMessage, setConflictMessage] = useState('');
  const [conflictType, setConflictType] = useState<'already-enrolled' | 'already-submitted'>('already-enrolled');

  // Enrollment period state
  const [activeEnrollmentPeriodId, setActiveEnrollmentPeriodId] = useState<number | null>(null);

  // Account creation state
  const [createAccount, setCreateAccount] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [createMissingAccount, setCreateMissingAccount] = useState(false);
  const [hasPortalAccount, setHasPortalAccount] = useState<boolean | null>(null);
  const [isCheckingPortalAccount, setIsCheckingPortalAccount] = useState(false);

  // Email loading modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Get enrollment type from router state on mount
  useEffect(() => {
    const state = location.state as { enrollmentType?: string } | null;
    if (state?.enrollmentType && enrollmentTypes.includes(state.enrollmentType as any)) {
      setFormData(prev => ({ ...prev, enrollment_type: state.enrollmentType as any }));
      setShowSearchSection(state.enrollmentType === 'Returning Student' || state.enrollmentType === 'Continuing Student');
    }
  }, [location.state]);

  useEffect(() => {
    if (!isAdviser) return;

    let cachedLevels: string[] = [];
    try {
      const cached = localStorage.getItem('adviserLevels');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          cachedLevels = parsed;
        }
      }
    } catch (error) {
      cachedLevels = [];
    }

    if (cachedLevels.length > 0) {
      setAdviserLevels(cachedLevels);
    }

    const fetchLevels = async () => {
      try {
        const response = await apiGet(API_ENDPOINTS.TEACHER_ADVISER_LEVELS);
        if (response.success && Array.isArray(response.data)) {
          setAdviserLevels(response.data);
          localStorage.setItem('adviserLevels', JSON.stringify(response.data));
        }
      } catch (error) {
        console.error('Error fetching adviser levels:', error);
      }
    };

    fetchLevels();
  }, [isAdviser]);

  useEffect(() => {
    if (!isAdviser) return;
    if (!adviserLevel && adviserLevels.length > 0) {
      setAdviserLevel(adviserLevels[0]);
    }
  }, [adviserLevels, adviserLevel, isAdviser]);

  useEffect(() => {
    if (!isAdviser || !adviserLevel) return;
    setFormData(prev => ({
      ...prev,
      grade_level: adviserLevel
    }));
  }, [adviserLevel, isAdviser]);

  useEffect(() => {
    setShowSearchSection(
      isAdviser
        ? formData.enrollment_type === 'Returning Student' || formData.enrollment_type === 'Continuing Student'
        : formData.enrollment_type === 'Returning Student' || formData.enrollment_type === 'Continuing Student'
    );
  }, [formData.enrollment_type, isAdviser]);

  useEffect(() => {
    if (formData.enrollment_type === 'Returning Student') {
      setCreateAccount(false);
      setAccountPhone('');
    } else {
      setCreateMissingAccount(false);
      setHasPortalAccount(null);
    }
  }, [formData.enrollment_type]);

  useEffect(() => {
    if (!isAdviser) return;
    if (!adviserEnrollmentTypes.includes(formData.enrollment_type as any)) {
      setFormData(prev => ({ ...prev, enrollment_type: 'New Student' }));
    }
  }, [formData.enrollment_type, isAdviser]);

  useEffect(() => {
    if (!isAdviser) return;
    if (formData.enrollment_type !== 'Continuing Student') {
      setEligibleStudents([]);
      setShowSearchResults(false);
      setPreviousEnrollmentFound(false);
      setSelectedStudentId(null);
    }
  }, [formData.enrollment_type, isAdviser]);

  // Check for open enrollment period, fallback to latest if not open
  useEffect(() => {
    const checkEnrollmentPeriod = async () => {
      try {
        // First try to get active (open) enrollment period
        const response = await fetch('/api/enrollment-periods/active', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.status === 'Open') {
            setActiveEnrollmentPeriodId(data.data.id || null);
            return;
          }
        }

        // If no open period, get the latest enrollment period
        const latestResponse = await fetch('/api/enrollment-periods/latest', { credentials: 'include' });
        if (latestResponse.ok) {
          const latestData = await latestResponse.json();
          if (latestData.success && latestData.data) {
            setActiveEnrollmentPeriodId(latestData.data.id || null);
          }
        }
      } catch (error) {
        console.error('Error fetching enrollment period:', error);
      }
    };
    checkEnrollmentPeriod();
  }, []);

  // Current Address State
  const [currentRegions, setCurrentRegions] = useState<Region[]>([]);
  const [currentProvinces, setCurrentProvinces] = useState<Province[]>([]);
  const [currentMunicipalities, setCurrentMunicipalities] = useState<CityMunicipality[]>([]);
  const [currentBarangays, setCurrentBarangays] = useState<Barangay[]>([]);
  
  const [showCurrentProvinceDropdown, setShowCurrentProvinceDropdown] = useState(false);
  const [showCurrentMunicipalityDropdown, setShowCurrentMunicipalityDropdown] = useState(false);
  const [showCurrentBarangayDropdown, setShowCurrentBarangayDropdown] = useState(false);
  
  const [filteredCurrentProvinces, setFilteredCurrentProvinces] = useState<Province[]>([]);
  const [filteredCurrentMunicipalities, setFilteredCurrentMunicipalities] = useState<CityMunicipality[]>([]);
  const [filteredCurrentBarangays, setFilteredCurrentBarangays] = useState<Barangay[]>([]);
  const [currentRegionCode, setCurrentRegionCode] = useState<string>("");

  // Permanent Address State
  const [permRegions, setPermRegions] = useState<Region[]>([]);
  const [permProvinces, setPermProvinces] = useState<Province[]>([]);
  const [permMunicipalities, setPermMunicipalities] = useState<CityMunicipality[]>([]);
  const [permBarangays, setPermBarangays] = useState<Barangay[]>([]);
  
  const [showPermProvinceDropdown, setShowPermProvinceDropdown] = useState(false);
  const [showPermMunicipalityDropdown, setShowPermMunicipalityDropdown] = useState(false);
  const [showPermBarangayDropdown, setShowPermBarangayDropdown] = useState(false);
  
  const [filteredPermProvinces, setFilteredPermProvinces] = useState<Province[]>([]);
  const [filteredPermMunicipalities, setFilteredPermMunicipalities] = useState<CityMunicipality[]>([]);
  const [filteredPermBarangays, setFilteredPermBarangays] = useState<Barangay[]>([]);
  const [permRegionCode, setPermRegionCode] = useState<string>("");

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const response = await fetch(`${PSGC_API}/regions.json`);
        const data = await response.json();
        setCurrentRegions(data);
        setPermRegions(data);
      } catch (error) {
        console.error("Error fetching regions:", error);
      }
    };
    fetchRegions();
  }, []);

  useEffect(() => {
    if (!currentRegionCode) {
      setCurrentProvinces([]);
      setFilteredCurrentProvinces([]);
      return;
    }
    const fetchProvinces = async () => {
      try {
        const response = await fetch(`${PSGC_API}/regions/${currentRegionCode}/provinces.json`);
        const data = await response.json();
        setCurrentProvinces(data);
        setFilteredCurrentProvinces(data);
      } catch (error) {
        console.error("Error fetching provinces:", error);
      }
    };
    fetchProvinces();
  }, [currentRegionCode]);

  useEffect(() => {
    if (!formData.current_province) {
      setCurrentMunicipalities([]);
      setFilteredCurrentMunicipalities([]);
      return;
    }
    const fetchMunicipalities = async () => {
      try {
        const province = currentProvinces.find(p => p.name === formData.current_province);
        if (!province) return;
        const response = await fetch(`${PSGC_API}/provinces/${province.code}/cities-municipalities.json`);
        const data = await response.json();
        setCurrentMunicipalities(data);
        setFilteredCurrentMunicipalities(data);
      } catch (error) {
        console.error("Error fetching municipalities:", error);
      }
    };
    fetchMunicipalities();
  }, [formData.current_province, currentProvinces]);

  useEffect(() => {
    if (!formData.current_municipality) {
      setCurrentBarangays([]);
      setFilteredCurrentBarangays([]);
      return;
    }
    const fetchBarangays = async () => {
      try {
        const municipality = currentMunicipalities.find(m => m.name === formData.current_municipality);
        if (!municipality) return;
        const response = await fetch(`${PSGC_API}/cities-municipalities/${municipality.code}/barangays.json`);
        const data = await response.json();
        setCurrentBarangays(data);
        setFilteredCurrentBarangays(data);
      } catch (error) {
        console.error("Error fetching barangays:", error);
      }
    };
    fetchBarangays();
  }, [formData.current_municipality, currentMunicipalities]);

  useEffect(() => {
    if (!permRegionCode) {
      setPermProvinces([]);
      setFilteredPermProvinces([]);
      return;
    }
    const fetchProvinces = async () => {
      try {
        const response = await fetch(`${PSGC_API}/regions/${permRegionCode}/provinces.json`);
        const data = await response.json();
        setPermProvinces(data);
        setFilteredPermProvinces(data);
      } catch (error) {
        console.error("Error fetching provinces:", error);
      }
    };
    fetchProvinces();
  }, [permRegionCode]);

  useEffect(() => {
    if (!formData.permanent_province) {
      setPermMunicipalities([]);
      setFilteredPermMunicipalities([]);
      return;
    }
    const fetchMunicipalities = async () => {
      try {
        const province = permProvinces.find(p => p.name === formData.permanent_province);
        if (!province) return;
        const response = await fetch(`${PSGC_API}/provinces/${province.code}/cities-municipalities.json`);
        const data = await response.json();
        setPermMunicipalities(data);
        setFilteredPermMunicipalities(data);
      } catch (error) {
        console.error("Error fetching municipalities:", error);
      }
    };
    fetchMunicipalities();
  }, [formData.permanent_province, permProvinces]);

  useEffect(() => {
    if (!formData.permanent_municipality) {
      setPermBarangays([]);
      setFilteredPermBarangays([]);
      return;
    }
    const fetchBarangays = async () => {
      try {
        const municipality = permMunicipalities.find(m => m.name === formData.permanent_municipality);
        if (!municipality) return;
        const response = await fetch(`${PSGC_API}/cities-municipalities/${municipality.code}/barangays.json`);
        const data = await response.json();
        setPermBarangays(data);
        setFilteredPermBarangays(data);
      } catch (error) {
        console.error("Error fetching barangays:", error);
      }
    };
    fetchBarangays();
  }, [formData.permanent_municipality, permMunicipalities]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const sanitizeNumericInput = (value: string, maxLength?: number) => {
    const digits = value.replace(/\D/g, '');
    return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits;
  };

  const sanitizePhoneInput = (value: string) => {
    let digits = value.replace(/\D/g, '');
    if (!digits) return '';

    if (!digits.startsWith('0')) {
      digits = `0${digits}`;
    }
    if (digits.length >= 2 && digits[1] !== '9') {
      digits = `09${digits.slice(2)}`;
    }

    return digits.slice(0, 11);
  };

  const searchPreviousEnrollment = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a student name',
        variant: 'destructive'
      });
      return;
    }

    setSearchLoading(true);
    try {
      const response = await apiGet(`${API_ENDPOINTS.ENROLLMENTS}/latest?student_name=${encodeURIComponent(searchQuery)}`);
      
      if (response.success && response.data) {
        // Pre-fill the form with previous enrollment data
        const enrollment = response.data;
        setFormData(prev => ({
          ...prev,
          learner_first_name: enrollment.learner_first_name || '',
          learner_middle_name: enrollment.learner_middle_name || '',
          learner_last_name: enrollment.learner_last_name || '',
          birth_date: enrollment.birth_date || '',
          gender: enrollment.gender || '',
          guardian_phone: enrollment.guardian_phone || '',
          grade_level: enrollment.grade_level || '',
          current_address: enrollment.current_address || '',
          current_barangay: enrollment.current_barangay || '',
          current_municipality: enrollment.current_municipality || '',
          current_province: enrollment.current_province || '',
          current_zip_code: enrollment.current_zip_code || '',
          current_phone: enrollment.current_phone || '',
          permanent_address: enrollment.permanent_address || '',
          permanent_barangay: enrollment.permanent_barangay || '',
          permanent_municipality: enrollment.permanent_municipality || '',
          permanent_province: enrollment.permanent_province || '',
          permanent_zip_code: enrollment.permanent_zip_code || '',
          same_as_current: enrollment.same_as_current || false,
          father_name: enrollment.father_name || '',
          father_contact: enrollment.father_contact || '',
          father_email: enrollment.father_email || '',
          mother_name: enrollment.mother_name || '',
          mother_contact: enrollment.mother_contact || '',
          mother_email: enrollment.mother_email || '',
        }));
        setPreviousEnrollmentFound(true);
        toast({
          title: 'Success',
          description: 'Previous enrollment data loaded. You can edit before submitting.'
        });
      } else {
        toast({
          title: 'Not Found',
          description: 'No previous enrollment found for this student',
          variant: 'destructive'
        });
        setPreviousEnrollmentFound(false);
      }
    } catch (error) {
      console.error('Error searching enrollment:', error);
      toast({
        title: 'Error',
        description: 'Failed to search previous enrollment',
        variant: 'destructive'
      });
      setPreviousEnrollmentFound(false);
    } finally {
      setSearchLoading(false);
    }
  };

  // Get next grade level for continuing students
  const getNextGradeLevel = (currentGrade: string): string => {
    const gradeIndex = grades.indexOf(currentGrade);
    if (gradeIndex >= 0 && gradeIndex < grades.length - 1) {
      return grades[gradeIndex + 1];
    }
    return currentGrade; // If at last grade, stay same
  };

  const checkPortalAccount = async (studentId: number) => {
    setIsCheckingPortalAccount(true);
    setHasPortalAccount(null);
    setCreateMissingAccount(false);
    try {
      const response = await apiGet(API_ENDPOINTS.STUDENT_PORTAL_ACCOUNT(studentId));
      if (response?.success) {
        const hasAccount = Boolean(response?.has_account);
        setHasPortalAccount(hasAccount);
        if (hasAccount) {
          setCreateMissingAccount(false);
        }
      } else {
        setHasPortalAccount(false);
      }
    } catch (error) {
      console.error('Error checking portal account:', error);
      setHasPortalAccount(null);
    } finally {
      setIsCheckingPortalAccount(false);
    }
  };

  const searchStudentBasicInfo = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a student name',
        variant: 'destructive'
      });
      return;
    }

    setSearchLoading(true);
    try {
      // Search from students table for basic info
      const response = await apiGet(`${API_ENDPOINTS.STUDENTS}?search=${encodeURIComponent(searchQuery)}`);
      
      if (response.success && response.data && response.data.length > 0) {
        // Check if multiple results - if so, show dropdown list
        if (response.data.length > 1) {
          setSearchResults(response.data);
          setShowSearchResults(true);
          setSearchLoading(false);
          return;
        }
        
        const student = response.data[0]; // Take first match
        let enrollmentData = null;
        const studentId = Number(student?.id ?? 0);
        setSelectedStudentId(Number.isFinite(studentId) && studentId > 0 ? studentId : null);

        if (formData.enrollment_type === 'Returning Student' && studentId > 0) {
          await checkPortalAccount(studentId);
        } else {
          setHasPortalAccount(null);
          setCreateMissingAccount(false);
        }
        
        // Try to fetch latest enrollment for this student
        try {
          const enrollmentResponse = await apiGet(`${API_ENDPOINTS.ENROLLMENTS}/latest?student_name=${encodeURIComponent(searchQuery)}`);
          if (enrollmentResponse.success && enrollmentResponse.data) {
            enrollmentData = enrollmentResponse.data;
          }
        } catch (enrollmentError) {
          console.log('No enrollment record found, using basic student info');
        }
        
        // Check if enrollment is for the same academic period as the selected one
        if (enrollmentData && enrollmentData.enrollment_id && formData.enrollment_type !== 'New Student' && formData.enrollment_type !== 'Transferee') {
          // Only check for returning/continuing students
          // Note: enrollment_id might be from form or we'd need to fetch academic_period_id from the enrollment
          // For now we can check if an enrollment exists for this student in the current period by attempting to show conflict
          
          if (enrollmentData.status === 'Approved') {
            setConflictType('already-enrolled');
            setConflictMessage(`${enrollmentData.learner_first_name} ${enrollmentData.learner_last_name} is already enrolled in this academic period.`);
          } else {
            setConflictType('already-submitted');
            setConflictMessage(`${enrollmentData.learner_first_name} ${enrollmentData.learner_last_name} has already submitted an enrollment application (Status: ${enrollmentData.status}). Please resolve this enrollment first.`);
          }
          
          setConflictEnrollmentData(enrollmentData);
          setIsEnrollmentConflictModalOpen(true);
          return; // Don't proceed with pre-fill
        }
        
        // Use enrollment data if available, otherwise use student data
        const sourceData = enrollmentData || student;
        
        // For continuing students, get their current grade and calculate next grade
        let currentGrade = sourceData.year_level || student.year_level || '';
        let nextGrade = currentGrade;
        
        if (formData.enrollment_type === 'Continuing Student' && currentGrade) {
          nextGrade = getNextGradeLevel(currentGrade);
        }
        
        // Pre-fill the form with data from enrollment (preferred) or student record (fallback)
        setFormData(prev => ({
          ...prev,
          learner_first_name: sourceData.learner_first_name || sourceData.first_name || '',
          learner_middle_name: sourceData.learner_middle_name || sourceData.middle_name || '',
          learner_last_name: sourceData.learner_last_name || sourceData.last_name || '',
          birth_date: sourceData.birth_date || '',
          gender: sourceData.gender || '',
          guardian_phone: sourceData.guardian_phone || '',
          grade_level: formData.enrollment_type === 'Continuing Student' ? nextGrade : currentGrade,
          // Address info: prefer enrollment data, then student data
          current_address: sourceData.current_address || '',
          current_barangay: sourceData.current_barangay || '',
          current_municipality: sourceData.current_municipality || '',
          current_province: sourceData.current_province || '',
          current_zip_code: sourceData.current_zip_code || '',
          current_phone: sourceData.current_phone || '',
          permanent_address: sourceData.permanent_address || '',
          permanent_barangay: sourceData.permanent_barangay || '',
          permanent_municipality: sourceData.permanent_municipality || '',
          permanent_province: sourceData.permanent_province || '',
          permanent_zip_code: sourceData.permanent_zip_code || '',
          same_as_current: sourceData.same_as_current || false,
          // Parent info
          father_name: sourceData.father_name || '',
          father_contact: sourceData.father_contact || '',
          father_email: sourceData.father_email || '',
          mother_name: sourceData.mother_name || '',
          mother_contact: sourceData.mother_contact || '',
          mother_email: sourceData.mother_email || '',
        }));
        setPreviousEnrollmentFound(true);
        
        const dataSource = enrollmentData ? 'enrollment' : 'student';
        toast({
          title: 'Success',
          description: `${dataSource === 'enrollment' ? 'Enrollment' : 'Student'} found${formData.enrollment_type === 'Continuing Student' ? ` - Grade auto-set to ${nextGrade}` : ''}. You can edit before submitting.`
        });
      } else {
        toast({
          title: 'Not Found',
          description: 'No student or enrollment record found with that name',
          variant: 'destructive'
        });
        setPreviousEnrollmentFound(false);
      }
    } catch (error) {
      console.error('Error searching student/enrollment:', error);
      toast({
        title: 'Error',
        description: 'Failed to search records',
        variant: 'destructive'
      });
      setPreviousEnrollmentFound(false);
    } finally {
      setSearchLoading(false);
    }
  };

  const loadEligibleStudents = async () => {
    if (!adviserLevel) {
      toast({
        title: 'Error',
        description: 'Adviser level is required to load eligible students',
        variant: 'destructive'
      });
      return;
    }

    setEligibleStudentsLoading(true);
    try {
      const response = await apiGet(API_ENDPOINTS.ADVISER_ELIGIBLE_STUDENTS(adviserLevel));
      if (response.success) {
        setEligibleStudents(Array.isArray(response.data) ? response.data : []);
        setShowSearchResults(false);
        setPreviousEnrollmentFound(false);
      } else {
        throw new Error(response.message || 'Failed to load eligible students');
      }
    } catch (error) {
      console.error('Error loading eligible students:', error);
      toast({
        title: 'Error',
        description: 'Failed to load eligible students',
        variant: 'destructive'
      });
    } finally {
      setEligibleStudentsLoading(false);
    }
  };


  const handleSelectStudentFromResults = async (selectedStudent: any) => {
    setShowSearchResults(false);
    setSearchLoading(true);
    setPreviousEnrollmentFound(false);
    try {
      let enrollmentData = null;
      
      // Try to fetch latest enrollment for this selected student
      try {
        const fullName = `${selectedStudent.first_name} ${selectedStudent.last_name}`;
        console.log('Fetching enrollment for:', fullName);
        const enrollmentResponse = await apiGet(`${API_ENDPOINTS.ENROLLMENTS}/latest?student_name=${encodeURIComponent(fullName)}`);
        console.log('Enrollment response:', enrollmentResponse);
        
        if (enrollmentResponse.success && enrollmentResponse.data) {
          enrollmentData = enrollmentResponse.data;
          console.log('Found enrollment data:', enrollmentData);
        } else {
          console.log('No enrollment found or success is false');
        }
      } catch (enrollmentError) {
        console.log('Error fetching enrollment:', enrollmentError);
      }
      
      // Check if enrollment exists and is for a returning/continuing student
      if (enrollmentData && enrollmentData.enrollment_id) {
        console.log('Enrollment exists with ID:', enrollmentData.enrollment_id);
        console.log('Enrollment type:', formData.enrollment_type);
        console.log('Enrollment status:', enrollmentData.status);
        
        // Only check for returning/continuing students
        if (formData.enrollment_type !== 'New Student' && formData.enrollment_type !== 'Transferee') {
          console.log('Checking conflict for:', formData.enrollment_type);
          
          if (enrollmentData.status === 'Approved') {
            setConflictType('already-enrolled');
            setConflictMessage(`${enrollmentData.learner_first_name} ${enrollmentData.learner_last_name} is already enrolled in this academic period.`);
          } else {
            setConflictType('already-submitted');
            setConflictMessage(`${enrollmentData.learner_first_name} ${enrollmentData.learner_last_name} has already submitted an enrollment application (Status: ${enrollmentData.status}). Please resolve this enrollment first.`);
          }
          
          setConflictEnrollmentData(enrollmentData);
          console.log('Setting conflict modal to open');
          setIsEnrollmentConflictModalOpen(true);
          setSearchLoading(false);
          return; // Don't proceed with pre-fill
        }
      }
      
      // Use enrollment data if available, otherwise use student data
      const sourceData = enrollmentData || selectedStudent;
      
      // For continuing students, get their current grade and calculate next grade
      let currentGrade = sourceData.year_level || selectedStudent.year_level || '';
      let nextGrade = currentGrade;
      
      if (formData.enrollment_type === 'Continuing Student' && currentGrade) {
        nextGrade = getNextGradeLevel(currentGrade);
      }

      const targetGrade = isAdviser && adviserLevel
        ? adviserLevel
        : (formData.enrollment_type === 'Continuing Student' ? nextGrade : currentGrade);

      
      // Pre-fill the form with data from enrollment (preferred) or student record (fallback)
      setFormData(prev => ({
        ...prev,
        learner_first_name: sourceData.learner_first_name || sourceData.first_name || '',
        learner_middle_name: sourceData.learner_middle_name || sourceData.middle_name || '',
        learner_last_name: sourceData.learner_last_name || sourceData.last_name || '',
        birth_date: sourceData.birth_date || '',
        gender: sourceData.gender || '',
        guardian_phone: sourceData.guardian_phone || '',
        grade_level: targetGrade,
        // Address info: prefer enrollment data, then student data
        current_address: sourceData.current_address || '',
        current_barangay: sourceData.current_barangay || '',
        current_municipality: sourceData.current_municipality || '',
        current_province: sourceData.current_province || '',
        current_zip_code: sourceData.current_zip_code || '',
        current_phone: sourceData.current_phone || '',
        permanent_address: sourceData.permanent_address || '',
        permanent_barangay: sourceData.permanent_barangay || '',
        permanent_municipality: sourceData.permanent_municipality || '',
        permanent_province: sourceData.permanent_province || '',
        permanent_zip_code: sourceData.permanent_zip_code || '',
        same_as_current: sourceData.same_as_current || false,
        // Parent info
        father_name: sourceData.father_name || '',
        father_contact: sourceData.father_contact || '',
        father_email: sourceData.father_email || '',
        mother_name: sourceData.mother_name || '',
        mother_contact: sourceData.mother_contact || '',
        mother_email: sourceData.mother_email || '',
      }));
      setPreviousEnrollmentFound(true);
      let parsedStudentId: number | null = null;
      if (selectedStudent?.id !== undefined && selectedStudent?.id !== null) {
        const numericId = Number(selectedStudent.id);
        if (Number.isFinite(numericId)) {
          parsedStudentId = numericId;
        }
      }
      setSelectedStudentId(parsedStudentId);

      if (formData.enrollment_type === 'Returning Student' && parsedStudentId) {
        await checkPortalAccount(parsedStudentId);
      } else {
        setHasPortalAccount(null);
        setCreateMissingAccount(false);
      }
      
      const dataSource = enrollmentData ? 'enrollment' : 'student';
      toast({
        title: 'Success',
        description: `${dataSource === 'enrollment' ? 'Enrollment' : 'Student'} found${formData.enrollment_type === 'Continuing Student' ? ` - Grade auto-set to ${nextGrade}` : ''}. You can edit before submitting.`
      });
    } catch (error) {
      console.error('Error selecting student:', error);
      toast({
        title: 'Error',
        description: 'Failed to load student information',
        variant: 'destructive'
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleCurrentProvinceChange = (value: string) => {
    handleChange('current_province', value);
    if (value.length > 0) {
      const filtered = currentProvinces.filter(p => 
        p.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCurrentProvinces(filtered.slice(0, 10));
      setShowCurrentProvinceDropdown(true);
    } else {
      setFilteredCurrentProvinces(currentProvinces.slice(0, 10));
      setShowCurrentProvinceDropdown(true);
    }
  };

  const handleCurrentMunicipalityChange = (value: string) => {
    handleChange('current_municipality', value);
    if (value.length > 0) {
      const filtered = currentMunicipalities.filter(m => 
        m.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCurrentMunicipalities(filtered.slice(0, 10));
      setShowCurrentMunicipalityDropdown(true);
    } else {
      setShowCurrentMunicipalityDropdown(false);
    }
  };

  const handleCurrentBarangayChange = (value: string) => {
    handleChange('current_barangay', value);
    if (value.length > 0) {
      const filtered = currentBarangays.filter(b => 
        b.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredCurrentBarangays(filtered.slice(0, 10));
      setShowCurrentBarangayDropdown(true);
    } else {
      setShowCurrentBarangayDropdown(false);
    }
  };

  const handlePermProvinceChange = (value: string) => {
    handleChange('permanent_province', value);
    if (value.length > 0) {
      const filtered = permProvinces.filter(p => 
        p.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredPermProvinces(filtered.slice(0, 10));
      setShowPermProvinceDropdown(true);
    } else {
      setFilteredPermProvinces(permProvinces.slice(0, 10));
      setShowPermProvinceDropdown(true);
    }
  };

  const handlePermMunicipalityChange = (value: string) => {
    handleChange('permanent_municipality', value);
    if (value.length > 0) {
      const filtered = permMunicipalities.filter(m => 
        m.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredPermMunicipalities(filtered.slice(0, 10));
      setShowPermMunicipalityDropdown(true);
    } else {
      setShowPermMunicipalityDropdown(false);
    }
  };

  const handlePermBarangayChange = (value: string) => {
    handleChange('permanent_barangay', value);
    if (value.length > 0) {
      const filtered = permBarangays.filter(b => 
        b.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredPermBarangays(filtered.slice(0, 10));
      setShowPermBarangayDropdown(true);
    } else {
      setShowPermBarangayDropdown(false);
    }
  };

  const selectCurrentProvince = (province: Province) => {
    handleChange('current_province', province.name);
    setShowCurrentProvinceDropdown(false);
  };

  const selectCurrentMunicipality = (municipality: CityMunicipality) => {
    handleChange('current_municipality', municipality.name);
    setShowCurrentMunicipalityDropdown(false);
  };

  const selectCurrentBarangay = (barangay: Barangay) => {
    handleChange('current_barangay', barangay.name);
    setShowCurrentBarangayDropdown(false);
  };

  const selectPermProvince = (province: Province) => {
    handleChange('permanent_province', province.name);
    setShowPermProvinceDropdown(false);
  };

  const selectPermMunicipality = (municipality: CityMunicipality) => {
    handleChange('permanent_municipality', municipality.name);
    setShowPermMunicipalityDropdown(false);
  };

  const selectPermBarangay = (barangay: Barangay) => {
    handleChange('permanent_barangay', barangay.name);
    setShowPermBarangayDropdown(false);
  };

  const handleAddressSync = (checked: boolean) => {
    handleChange('same_as_current', checked);
    if (checked) {
      setFormData(prev => ({
        ...prev,
        permanent_address: prev.current_address,
        permanent_barangay: prev.current_barangay,
        permanent_municipality: prev.current_municipality,
        permanent_province: prev.current_province,
        permanent_zip_code: prev.current_zip_code,
      }));
      setPermRegionCode(currentRegionCode);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.learner_first_name.trim()) newErrors.learner_first_name = 'First name required';
    if (!formData.learner_last_name.trim()) newErrors.learner_last_name = 'Last name required';
    if (!formData.birth_date) {
      newErrors.birth_date = 'Birth date required';
    } else {
      // Validate that child is at least 3 years old
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      
      // Calculate age in years
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();
      
      // If birthday hasn't occurred this year, subtract 1
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }
      
      if (age < 3) {
        newErrors.birth_date = `Child must be at least 3 years old. Current age: ${age} year${age !== 1 ? 's' : ''}`;
      }
    }
    if (!formData.gender) newErrors.gender = 'Gender required';
    if (!formData.grade_level) newErrors.grade_level = 'Grade level required';
    if (isAdviser && formData.enrollment_type === 'Continuing Student' && !selectedStudentId) {
      newErrors.selected_student_id = 'Select an eligible student for continuing enrollment';
    }
    if (!formData.current_address.trim()) newErrors.current_address = 'Current address required';
    if (!formData.current_barangay.trim()) newErrors.current_barangay = 'Current barangay required';
    if (!formData.current_municipality.trim()) newErrors.current_municipality = 'Current municipality required';
    if (!formData.current_province.trim()) newErrors.current_province = 'Current province required';
    
    // Only validate permanent address if not using same as current
    if (!formData.same_as_current) {
      if (!formData.permanent_address.trim()) newErrors.permanent_address = 'Permanent address required';
      if (!formData.permanent_barangay.trim()) newErrors.permanent_barangay = 'Permanent barangay required';
      if (!formData.permanent_municipality.trim()) newErrors.permanent_municipality = 'Permanent municipality required';
      if (!formData.permanent_province.trim()) newErrors.permanent_province = 'Permanent province required';
    }

    if (createAccount) {
      const trimmedEmail = accountEmail.trim();
      const trimmedPhone = accountPhone.trim();

      if (!trimmedEmail && !trimmedPhone) {
        newErrors.account_email = 'Account email or phone is required';
        newErrors.account_phone = 'Account email or phone is required';
      }
      if (trimmedPhone && !/^09\d{9}$/.test(trimmedPhone)) {
        newErrors.account_phone = 'Use 11 digits starting with 09';
      }
    }

    if (formData.enrollment_type === 'Returning Student' && createMissingAccount) {
      const trimmedEmail = accountEmail.trim();
      const trimmedGuardianPhone = formData.guardian_phone.trim();

      if (!selectedStudentId) {
        newErrors.selected_student_id = 'Select a returning student record';
      }
      if (!trimmedEmail && !trimmedGuardianPhone) {
        newErrors.account_email = 'Account email or guardian phone is required';
        newErrors.guardian_phone = 'Account email or guardian phone is required';
      }
      if (trimmedGuardianPhone && !/^09\d{9}$/.test(trimmedGuardianPhone)) {
        newErrors.guardian_phone = 'Use 11 digits starting with 09';
      }
    }

    if (formData.current_phone && !/^09\d{9}$/.test(formData.current_phone)) {
      newErrors.current_phone = 'Use 11 digits starting with 09';
    }
    if (formData.father_contact && !/^09\d{9}$/.test(formData.father_contact)) {
      newErrors.father_contact = 'Use 11 digits starting with 09';
    }
    if (formData.mother_contact && !/^09\d{9}$/.test(formData.mother_contact)) {
      newErrors.mother_contact = 'Use 11 digits starting with 09';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    // Show email modal if account creation is enabled
    if (createAccount || createMissingAccount) {
      setShowEmailModal(true);
      setEmailSuccess(false);
    }

    try {
      const formDataObj = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          formDataObj.append(key, value ? '1' : '0');
        } else {
          formDataObj.append(key, value);
        }
      });

      // Add enrollment period ID
      if (activeEnrollmentPeriodId) {
        formDataObj.append('enrollment_period_id', String(activeEnrollmentPeriodId));
      }

      if (formData.enrollment_type === 'Continuing Student' && selectedStudentId) {
        formDataObj.append('selected_student_id', String(selectedStudentId));
      }

      if (createAccount) {
        formDataObj.append('create_account', '1');
        formDataObj.append('account_email', accountEmail);
        formDataObj.append('account_phone', accountPhone);
      }

      if (createMissingAccount) {
        if (selectedStudentId) {
          formDataObj.append('returning_student_id', String(selectedStudentId));
        }
        formDataObj.append('create_missing_account', '1');
        formDataObj.append('account_email', accountEmail);
        if (formData.guardian_phone.trim()) {
          formDataObj.append('account_phone', formData.guardian_phone.trim());
        }
      }

      const response = await fetch(API_ENDPOINTS.ADVISER_ENROLLMENT_SUBMIT, {
        method: 'POST',
        credentials: 'include',
        body: formDataObj
      });

      if (!response.ok) {
        throw new Error('Failed to create enrollment');
      }

      // Set email success if account was created
      if (createAccount || createMissingAccount) {
        setEmailSuccess(true);
      } else {
        // If no account creation, show success toast and navigate immediately
        toast({
          title: 'Success',
          description: 'Enrollment created successfully'
        });
        navigate('/admin/enrollments');
      }
    } catch (error) {
      console.error('Error creating enrollment:', error);
      setShowEmailModal(false); // Hide modal on error
      toast({
        title: 'Error',
        description: 'Failed to create enrollment',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailModalComplete = () => {
    setShowEmailModal(false);
    if (emailSuccess) {
      toast({
        title: 'Success',
        description: 'Enrollment created successfully'
      });
      navigate('/admin/enrollments');
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-6">
        {/* Back Navigation */}
        <button
          onClick={() => navigate('/admin/enrollments')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Enrollments
        </button>

        {/* Page Header */}
        <div>
          <h1 className="text-4xl font-bold text-blue-600">New Enrollment</h1>
          <p className="text-gray-600 mt-2">Add a new student enrollment record</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Enrollment Type Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Enrollment Type</h2>
              <p className="text-indigo-100 text-sm mt-1">Select the type of enrollment</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label className="font-medium text-gray-700">Type *</Label>
                <select
                  aria-label="Enrollment type"
                  value={formData.enrollment_type}
                  disabled
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 cursor-not-allowed focus:outline-none text-gray-600"
                >
                  {enrollmentTypeOptions.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">Enrollment type is pre-selected from the enrollment management modal.</p>
              </div>

              <div>
                <Label className="font-medium text-gray-700">Adviser Level *</Label>
                <select
                  aria-label="Adviser level"
                  value={adviserLevel}
                  onChange={(e) => setAdviserLevel(e.target.value)}
                  disabled={adviserLevels.length <= 1}
                  className={`mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none ${
                    adviserLevels.length <= 1 ? 'bg-gray-50 cursor-not-allowed text-gray-600' : 'bg-white text-gray-900'
                  }`}
                >
                  <option value="" disabled>Select adviser level</option>
                  {adviserLevels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Manual entries are limited to your assigned level.
                </p>
              </div>

              {/* Search Previous Enrollment Section */}
              {showSearchSection && (
                <div className="pt-4 border-t border-gray-200">
                  {formData.enrollment_type === 'Returning Student' ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="font-medium text-gray-700 text-sm">Search Student Record (Optional)</Label>
                        <p className="text-xs text-gray-500 mt-1">Find and pre-fill data from previous enrollment or student record.</p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Enter student name..."
                          className="flex-1"
                          onKeyPress={(e) => e.key === 'Enter' && searchStudentBasicInfo()}
                        />
                        <Button
                          type="button"
                          onClick={searchStudentBasicInfo}
                          disabled={searchLoading}
                          variant="outline"
                          className="gap-2"
                        >
                          <Search className="w-4 h-4" />
                          {searchLoading ? 'Searching...' : 'Search'}
                        </Button>
                      </div>

                      {showSearchResults && searchResults.length > 0 && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-lg">
                          <div className="bg-blue-50 px-4 py-2 border-b border-gray-200">
                            <p className="text-sm font-medium text-gray-700">Found {searchResults.length} student{searchResults.length > 1 ? 's' : ''} - Select one:</p>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {searchResults.map((student) => (
                              <button
                                key={student.student_id}
                                type="button"
                                onClick={() => handleSelectStudentFromResults(student)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{student.first_name} {student.last_name}</p>
                                    <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                                  </div>
                                  <div className="text-right ml-4">
                                    {student.year_level && (
                                      <p className="text-sm text-gray-600">Grade: {student.year_level}</p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {previousEnrollmentFound && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="text-sm text-green-700">Student data loaded and ready to edit</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="font-medium text-gray-700 text-sm">Eligible Continuing Students</Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Shows students one level below your adviser level whose enrollment date is not in the current school year.
                        </p>
                      </div>
                      <div>
                        <Button
                          type="button"
                          onClick={loadEligibleStudents}
                          disabled={eligibleStudentsLoading}
                          variant="outline"
                          className="gap-2"
                        >
                          <Search className="w-4 h-4" />
                          {eligibleStudentsLoading ? 'Loading...' : 'Load eligible students'}
                        </Button>
                      </div>

                      {eligibleStudents.length > 0 && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-lg">
                          <div className="bg-blue-50 px-4 py-2 border-b border-gray-200">
                            <p className="text-sm font-medium text-gray-700">Found {eligibleStudents.length} student{eligibleStudents.length > 1 ? 's' : ''} - Select one:</p>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {eligibleStudents.map((student) => (
                              <button
                                key={student.id || student.student_id}
                                type="button"
                                onClick={() => handleSelectStudentFromResults(student)}
                                disabled={eligibleStudentsLoading}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors disabled:opacity-50"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{student.first_name} {student.last_name}</p>
                                    <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                                  </div>
                                  <div className="text-right ml-4">
                                    {student.year_level && (
                                      <p className="text-sm text-gray-600">Grade: {student.year_level}</p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {previousEnrollmentFound && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="text-sm text-green-700">Student data loaded and ready to edit</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Optional Account Creation */}
          {formData.enrollment_type === 'Returning Student' ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Missing Account</h2>
                <p className="text-teal-100 text-sm mt-1">Create a portal account when a returning student has none</p>
              </div>
              <div className="p-6 space-y-4">
                {!selectedStudentId ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
                    Search and select a student to check portal account status.
                  </div>
                ) : isCheckingPortalAccount ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
                    Checking account status...
                  </div>
                ) : hasPortalAccount ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Account active for this student.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                      <Checkbox
                        id="create_missing_account"
                        checked={createMissingAccount}
                        onCheckedChange={(checked) => {
                          const enabled = Boolean(checked);
                          setCreateMissingAccount(enabled);
                          if (!enabled) {
                            setAccountEmail('');
                            setErrors(prev => {
                              const next = { ...prev };
                              delete next.account_email;
                              delete next.guardian_phone;
                              return next;
                            });
                          }
                        }}
                      />
                      <Label htmlFor="create_missing_account" className="font-medium text-gray-700 cursor-pointer">
                        Create missing account for this student
                      </Label>
                    </div>

                    {createMissingAccount && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="account_email" className="font-medium text-gray-700">Account Email (optional)</Label>
                          <Input
                            id="account_email"
                            type="email"
                            value={accountEmail}
                            onChange={(e) => setAccountEmail(e.target.value)}
                            className={`mt-2 ${errors.account_email ? 'border-red-500' : ''}`}
                            placeholder="student@example.com"
                          />
                          {errors.account_email && (
                            <p className="text-sm text-red-600 mt-1">{errors.account_email}</p>
                          )}
                        </div>

                        <div>
                          <Label className="font-medium text-gray-700">Guardian Phone (fallback)</Label>
                          <Input
                            value={formData.guardian_phone}
                            readOnly
                            className={`mt-2 ${errors.guardian_phone ? 'border-red-500' : ''}`}
                            placeholder="09XX-XXX-XXXX"
                          />
                          {errors.guardian_phone && (
                            <p className="text-sm text-red-600 mt-1">{errors.guardian_phone}</p>
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                              <strong>Secure Setup:</strong> A password setup link will be sent to the provided email address.
                              If no email is provided, the guardian phone number will be used as the primary contact.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-4">
                <h2 className="text-lg font-semibold text-white">Optional Account Creation</h2>
                <p className="text-teal-100 text-sm mt-1">Create a student user account for payments</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Checkbox
                    id="create_account"
                    checked={createAccount}
                    onCheckedChange={(checked) => {
                      const enabled = Boolean(checked);
                      setCreateAccount(enabled);
                      if (!enabled) {
                        setAccountEmail('');
                        setAccountPhone('');
                        setErrors(prev => {
                          const next = { ...prev };
                          delete next.account_email;
                          delete next.account_phone;
                          return next;
                        });
                      }
                    }}
                  />
                  <Label htmlFor="create_account" className="font-medium text-gray-700 cursor-pointer">
                    Create user account for this student
                  </Label>
                </div>

                {createAccount && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="account_email" className="font-medium text-gray-700">Account Email *</Label>
                      <Input
                        id="account_email"
                        type="email"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        className={`mt-2 ${errors.account_email ? 'border-red-500' : ''}`}
                        placeholder="student@example.com"
                      />
                      {errors.account_email && (
                        <p className="text-sm text-red-600 mt-1">{errors.account_email}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="account_phone" className="font-medium text-gray-700">Account Contact Number *</Label>
                      <Input
                        id="account_phone"
                        type="tel"
                        value={accountPhone}
                        onChange={(e) => setAccountPhone(sanitizePhoneInput(e.target.value))}
                        inputMode="numeric"
                        pattern="09[0-9]{9}"
                        maxLength={11}
                        className={`mt-2 ${errors.account_phone ? 'border-red-500' : ''}`}
                        placeholder="09XX-XXX-XXXX"
                      />
                      {errors.account_phone && (
                        <p className="text-sm text-red-600 mt-1">{errors.account_phone}</p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          <strong>Secure Setup:</strong> A password setup link will be sent to the provided email address after enrollment creation.
                          The student/parent can set their password securely through the email link.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Student Information Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Student Information</h2>
              <p className="text-blue-100 text-sm mt-1">Enter basic student details</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="learner_first_name" className="font-medium text-gray-700">First Name *</Label>
                  <Input
                    id="learner_first_name"
                    value={formData.learner_first_name}
                    onChange={(e) => handleChange('learner_first_name', e.target.value)}
                    className={`mt-2 ${errors.learner_first_name ? 'border-red-500' : ''}`}
                    placeholder="Juan"
                  />
                  {errors.learner_first_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.learner_first_name}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="learner_middle_name" className="font-medium text-gray-700">Middle Name</Label>
                  <Input
                    id="learner_middle_name"
                    value={formData.learner_middle_name}
                    onChange={(e) => handleChange('learner_middle_name', e.target.value)}
                    className="mt-2"
                    placeholder="Dela"
                  />
                </div>
                <div>
                  <Label htmlFor="learner_last_name" className="font-medium text-gray-700">Last Name *</Label>
                  <Input
                    id="learner_last_name"
                    value={formData.learner_last_name}
                    onChange={(e) => handleChange('learner_last_name', e.target.value)}
                    className={`mt-2 ${errors.learner_last_name ? 'border-red-500' : ''}`}
                    placeholder="Cruz"
                  />
                  {errors.learner_last_name && (
                    <p className="text-sm text-red-600 mt-1">{errors.learner_last_name}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="birth_date" className="font-medium text-gray-700">Birth Date *</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => handleChange('birth_date', e.target.value)}
                    className={`mt-2 ${errors.birth_date ? 'border-red-500' : ''}`}
                  />
                  {errors.birth_date && (
                    <p className="text-sm text-red-600 mt-1">{errors.birth_date}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="gender" className="font-medium text-gray-700">Gender *</Label>
                  <select
                    id="gender"
                    aria-label="Select gender"
                    value={formData.gender}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    className={`mt-2 w-full px-3 py-2 border rounded-md text-sm ${
                      errors.gender ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {errors.gender && (
                    <p className="text-sm text-red-600 mt-1">{errors.gender}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="grade_level" className="font-medium text-gray-700">Grade Level *</Label>
                  <select
                    id="grade_level"
                    aria-label="Select grade level"
                    value={formData.grade_level}
                    onChange={(e) => handleChange('grade_level', e.target.value)}
                    disabled
                    className={`mt-2 w-full px-3 py-2 border rounded-md text-sm ${
                      errors.grade_level ? 'border-red-500' : 'border-gray-300'
                    } bg-gray-50 cursor-not-allowed text-gray-600`}
                  >
                    <option value="">Select grade level</option>
                    {gradeOptions.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                  {errors.grade_level && (
                    <p className="text-sm text-red-600 mt-1">{errors.grade_level}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="guardian_phone" className="font-medium text-gray-700">Guardian Phone Number</Label>
                  <div className="relative mt-2">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="guardian_phone"
                      type="tel"
                      value={formData.guardian_phone}
                      onChange={(e) => handleChange('guardian_phone', sanitizePhoneInput(e.target.value))}
                      className="pl-9"
                      inputMode="numeric"
                      pattern="09[0-9]{9}"
                      maxLength={11}
                      placeholder="09XX-XXX-XXXX"
                    />
                  </div>
                  {errors.guardian_phone && (
                    <p className="text-sm text-red-600 mt-1">{errors.guardian_phone}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Current Address Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold text-white">Current Address</h2>
              <p className="text-emerald-100 text-sm mt-1">Where does the student currently reside?</p>
            </div>
            <div className="p-6 space-y-6 relative">
              <div>
                <Label htmlFor="current_address" className="font-medium text-gray-700">Street Address *</Label>
                <Input
                  id="current_address"
                  value={formData.current_address}
                  onChange={(e) => handleChange('current_address', e.target.value)}
                  className={`mt-2 ${errors.current_address ? 'border-red-500' : ''}`}
                  placeholder="Street address"
                />
                {errors.current_address && (
                  <p className="text-sm text-red-600 mt-1">{errors.current_address}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="current_region" className="font-medium text-gray-700">Region</Label>
                <select
                  id="current_region"
                  aria-label="Select current region"
                  value={currentRegionCode}
                  onChange={(e) => setCurrentRegionCode(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select region</option>
                  {currentRegions.map(region => (
                    <option key={region.code} value={region.code}>{region.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                <div className="space-y-2 relative">
                  <Label htmlFor="current_province" className="font-medium text-gray-700">Province *</Label>
                  <Input
                    id="current_province"
                    value={formData.current_province}
                    onChange={(e) => handleCurrentProvinceChange(e.target.value)}
                    onFocus={() => setShowCurrentProvinceDropdown(true)}
                    placeholder="Search province..."
                    className={errors.current_province ? 'border-red-500' : ''}
                  />
                  {showCurrentProvinceDropdown && filteredCurrentProvinces.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md max-h-48 overflow-y-auto z-50 mt-1 shadow-lg">
                      {filteredCurrentProvinces.map(province => (
                        <button
                          key={province.code}
                          type="button"
                          onClick={() => selectCurrentProvince(province)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                        >
                          {province.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.current_province && (
                    <p className="text-sm text-red-600">{errors.current_province}</p>
                  )}
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="current_municipality" className="font-medium text-gray-700">Municipality *</Label>
                  <Input
                    id="current_municipality"
                    value={formData.current_municipality}
                    onChange={(e) => handleCurrentMunicipalityChange(e.target.value)}
                    onFocus={() => setShowCurrentMunicipalityDropdown(true)}
                    placeholder="Search municipality..."
                    className={errors.current_municipality ? 'border-red-500' : ''}
                  />
                  {showCurrentMunicipalityDropdown && filteredCurrentMunicipalities.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md max-h-48 overflow-y-auto z-50 mt-1 shadow-lg">
                      {filteredCurrentMunicipalities.map(municipality => (
                        <button
                          key={municipality.code}
                          type="button"
                          onClick={() => selectCurrentMunicipality(municipality)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                        >
                          {municipality.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.current_municipality && (
                    <p className="text-sm text-red-600">{errors.current_municipality}</p>
                  )}
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="current_barangay" className="font-medium text-gray-700">Barangay *</Label>
                  <Input
                    id="current_barangay"
                    value={formData.current_barangay}
                    onChange={(e) => handleCurrentBarangayChange(e.target.value)}
                    onFocus={() => setShowCurrentBarangayDropdown(true)}
                    placeholder="Search barangay..."
                    className={errors.current_barangay ? 'border-red-500' : ''}
                  />
                  {showCurrentBarangayDropdown && filteredCurrentBarangays.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md max-h-48 overflow-y-auto z-50 mt-1 shadow-lg">
                      {filteredCurrentBarangays.map(barangay => (
                        <button
                          key={barangay.code}
                          type="button"
                          onClick={() => selectCurrentBarangay(barangay)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                        >
                          {barangay.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.current_barangay && (
                    <p className="text-sm text-red-600">{errors.current_barangay}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="current_zip_code" className="font-medium text-gray-700">Zip Code</Label>
                  <Input
                    id="current_zip_code"
                    value={formData.current_zip_code}
                    onChange={(e) => handleChange('current_zip_code', sanitizeNumericInput(e.target.value, 4))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    className="mt-2"
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label htmlFor="current_phone" className="font-medium text-gray-700">Phone Number</Label>
                  <Input
                    id="current_phone"
                    type="tel"
                    value={formData.current_phone}
                    onChange={(e) => handleChange('current_phone', sanitizePhoneInput(e.target.value))}
                    inputMode="numeric"
                    pattern="09[0-9]{9}"
                    maxLength={11}
                    className="mt-2"
                    placeholder="09XX-XXX-XXXX"
                  />
                  {errors.current_phone && (
                    <p className="text-sm text-red-600 mt-1">{errors.current_phone}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Permanent Address Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold text-white">Permanent Address</h2>
              <p className="text-purple-100 text-sm mt-1">Student's permanent residential address</p>
            </div>
            <div className="p-6 space-y-6 relative">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Checkbox
                  id="same_as_current"
                  checked={formData.same_as_current}
                  onCheckedChange={(checked) => handleAddressSync(checked as boolean)}
                />
                <Label htmlFor="same_as_current" className="font-medium text-gray-700 cursor-pointer">
                  Same as current address
                </Label>
              </div>

              {!formData.same_as_current && (
                <>
                  <div>
                    <Label htmlFor="permanent_address" className="font-medium text-gray-700">Street Address *</Label>
                    <Input
                      id="permanent_address"
                      value={formData.permanent_address}
                      onChange={(e) => handleChange('permanent_address', e.target.value)}
                      className={`mt-2 ${errors.permanent_address ? 'border-red-500' : ''}`}
                      placeholder="Street address"
                    />
                    {errors.permanent_address && (
                      <p className="text-sm text-red-600 mt-1">{errors.permanent_address}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="perm_region" className="font-medium text-gray-700">Region</Label>
                    <select
                      id="perm_region"
                      aria-label="Select permanent region"
                      value={permRegionCode}
                      onChange={(e) => setPermRegionCode(e.target.value)}
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">Select region</option>
                      {permRegions.map(region => (
                        <option key={region.code} value={region.code}>{region.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                    <div className="space-y-2 relative">
                      <Label htmlFor="permanent_province" className="font-medium text-gray-700">Province *</Label>
                      <Input
                        id="permanent_province"
                        value={formData.permanent_province}
                        onChange={(e) => handlePermProvinceChange(e.target.value)}
                        onFocus={() => setShowPermProvinceDropdown(true)}
                        placeholder="Search province..."
                        className={errors.permanent_province ? 'border-red-500' : ''}
                      />
                      {showPermProvinceDropdown && filteredPermProvinces.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md max-h-48 overflow-y-auto z-50 mt-1 shadow-lg">
                          {filteredPermProvinces.map(province => (
                            <button
                              key={province.code}
                              type="button"
                              onClick={() => selectPermProvince(province)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                            >
                              {province.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {errors.permanent_province && (
                        <p className="text-sm text-red-600">{errors.permanent_province}</p>
                      )}
                    </div>

                    <div className="space-y-2 relative">
                      <Label htmlFor="permanent_municipality" className="font-medium text-gray-700">Municipality *</Label>
                      <Input
                        id="permanent_municipality"
                        value={formData.permanent_municipality}
                        onChange={(e) => handlePermMunicipalityChange(e.target.value)}
                        onFocus={() => setShowPermMunicipalityDropdown(true)}
                        placeholder="Search municipality..."
                        className={errors.permanent_municipality ? 'border-red-500' : ''}
                      />
                      {showPermMunicipalityDropdown && filteredPermMunicipalities.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md max-h-48 overflow-y-auto z-50 mt-1 shadow-lg">
                          {filteredPermMunicipalities.map(municipality => (
                            <button
                              key={municipality.code}
                              type="button"
                              onClick={() => selectPermMunicipality(municipality)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                            >
                              {municipality.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {errors.permanent_municipality && (
                        <p className="text-sm text-red-600">{errors.permanent_municipality}</p>
                      )}
                    </div>

                    <div className="space-y-2 relative">
                      <Label htmlFor="permanent_barangay" className="font-medium text-gray-700">Barangay *</Label>
                      <Input
                        id="permanent_barangay"
                        value={formData.permanent_barangay}
                        onChange={(e) => handlePermBarangayChange(e.target.value)}
                        onFocus={() => setShowPermBarangayDropdown(true)}
                        placeholder="Search barangay..."
                        className={errors.permanent_barangay ? 'border-red-500' : ''}
                      />
                      {showPermBarangayDropdown && filteredPermBarangays.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md max-h-48 overflow-y-auto z-50 mt-1 shadow-lg">
                          {filteredPermBarangays.map(barangay => (
                            <button
                              key={barangay.code}
                              type="button"
                              onClick={() => selectPermBarangay(barangay)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                            >
                              {barangay.name}
                            </button>
                          ))}
                        </div>
                      )}
                      {errors.permanent_barangay && (
                        <p className="text-sm text-red-600">{errors.permanent_barangay}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="permanent_zip_code" className="font-medium text-gray-700">Zip Code</Label>
                    <Input
                      id="permanent_zip_code"
                      value={formData.permanent_zip_code}
                      onChange={(e) => handleChange('permanent_zip_code', sanitizeNumericInput(e.target.value, 4))}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      className="mt-2"
                      placeholder="12345"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Parent/Guardian Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Parent/Guardian Information</h2>
              <p className="text-amber-100 text-sm mt-1">Contact information for parent or guardian</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="father_name" className="font-medium text-gray-700">Father's Name</Label>
                  <Input
                    id="father_name"
                    value={formData.father_name}
                    onChange={(e) => handleChange('father_name', e.target.value)}
                    className="mt-2"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <Label htmlFor="mother_name" className="font-medium text-gray-700">Mother's Name</Label>
                  <Input
                    id="mother_name"
                    value={formData.mother_name}
                    onChange={(e) => handleChange('mother_name', e.target.value)}
                    className="mt-2"
                    placeholder="Full name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="father_contact" className="font-medium text-gray-700">Father's Contact</Label>
                  <Input
                    id="father_contact"
                    type="tel"
                    value={formData.father_contact}
                    onChange={(e) => handleChange('father_contact', sanitizePhoneInput(e.target.value))}
                    inputMode="numeric"
                    pattern="09[0-9]{9}"
                    maxLength={11}
                    className="mt-2"
                    placeholder="09XX-XXX-XXXX"
                  />
                  {errors.father_contact && (
                    <p className="text-sm text-red-600 mt-1">{errors.father_contact}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="mother_contact" className="font-medium text-gray-700">Mother's Contact</Label>
                  <Input
                    id="mother_contact"
                    type="tel"
                    value={formData.mother_contact}
                    onChange={(e) => handleChange('mother_contact', sanitizePhoneInput(e.target.value))}
                    inputMode="numeric"
                    pattern="09[0-9]{9}"
                    maxLength={11}
                    className="mt-2"
                    placeholder="09XX-XXX-XXXX"
                  />
                  {errors.mother_contact && (
                    <p className="text-sm text-red-600 mt-1">{errors.mother_contact}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="father_email" className="font-medium text-gray-700">Father's Email</Label>
                  <Input
                    id="father_email"
                    type="email"
                    value={formData.father_email}
                    onChange={(e) => handleChange('father_email', e.target.value)}
                    className="mt-2"
                    placeholder="father@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="mother_email" className="font-medium text-gray-700">Mother's Email</Label>
                  <Input
                    id="mother_email"
                    type="email"
                    value={formData.mother_email}
                    onChange={(e) => handleChange('mother_email', e.target.value)}
                    className="mt-2"
                    placeholder="mother@example.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Special Information Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Special Information</h2>
              <p className="text-pink-100 text-sm mt-1">Additional student details</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    id="is_returning_student"
                    checked={formData.is_returning_student}
                    onCheckedChange={(checked) => handleChange('is_returning_student', checked)}
                  />
                  <Label htmlFor="is_returning_student" className="font-medium text-gray-700 cursor-pointer">
                    Returning Student
                  </Label>
                </div>

                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    id="is_indigenous_ip"
                    checked={formData.is_indigenous_ip}
                    onCheckedChange={(checked) => handleChange('is_indigenous_ip', checked)}
                  />
                  <Label htmlFor="is_indigenous_ip" className="font-medium text-gray-700 cursor-pointer">
                    Indigenous/IP
                  </Label>
                </div>

                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    id="is_4ps_beneficiary"
                    checked={formData.is_4ps_beneficiary}
                    onCheckedChange={(checked) => handleChange('is_4ps_beneficiary', checked)}
                  />
                  <Label htmlFor="is_4ps_beneficiary" className="font-medium text-gray-700 cursor-pointer">
                    4Ps Beneficiary
                  </Label>
                </div>

                <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  <Checkbox
                    id="has_disability"
                    checked={formData.has_disability}
                    onCheckedChange={(checked) => handleChange('has_disability', checked)}
                  />
                  <Label htmlFor="has_disability" className="font-medium text-gray-700 cursor-pointer">
                    Has Disability
                  </Label>
                </div>
              </div>

              {formData.has_disability && (
                <div>
                  <Label htmlFor="disability_type" className="font-medium text-gray-700">Disability Type</Label>
                  <Input
                    id="disability_type"
                    value={formData.disability_type}
                    onChange={(e) => handleChange('disability_type', e.target.value)}
                    className="mt-2"
                    placeholder="Specify disability type"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/enrollments')}
              className="px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
            >
              {isSubmitting ? 'Creating...' : '+ Add Enrollment'}
            </Button>
          </div>
        </form>

        {/* Enrollment Conflict Modal */}
        <Dialog open={isEnrollmentConflictModalOpen} onOpenChange={setIsEnrollmentConflictModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
                <div>
                  <DialogTitle>
                    {conflictType === 'already-enrolled' ? 'Student Already Enrolled' : 'Enrollment Already Submitted'}
                  </DialogTitle>
                </div>
              </div>
            </DialogHeader>
            <DialogDescription className="space-y-4 pt-4">
              <p className="text-base text-gray-700">{conflictMessage}</p>
              
            {conflictEnrollmentData && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="border-b border-gray-200 pb-3">
                    <p className="font-semibold text-gray-900">
                      {conflictEnrollmentData.learner_first_name} {conflictEnrollmentData.learner_last_name}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Type:</span>
                      <span className="text-gray-600">{conflictEnrollmentData.enrollment_type || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className="text-gray-600">{conflictEnrollmentData.status || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Grade Level:</span>
                      <span className="text-gray-600">{conflictEnrollmentData.grade_level || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-sm text-gray-600">
                {conflictType === 'already-enrolled' 
                  ? 'To enroll this student again, please check the existing enrollment record.'
                  : 'Please review and process the existing enrollment before creating a new one.'}
              </p>
            </DialogDescription>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEnrollmentConflictModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Email Loading Modal */}
        <EmailLoadingModal
          isOpen={showEmailModal}
          isSuccess={emailSuccess}
          emailType="confirmation"
          customMessage="Creating enrollment and sending account setup email..."
          customSuccessMessage="Enrollment created and account setup email sent successfully"
          onComplete={handleEmailModalComplete}
          autoCloseDuration={3000}
        />
      </div>
    </DashboardLayout>
  );
}
