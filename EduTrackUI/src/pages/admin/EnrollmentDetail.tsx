import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, FileText, ChevronLeft, ChevronRight, Coins, Receipt, Calendar, CreditCard } from 'lucide-react';
import { API_ENDPOINTS } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { EnrollmentStep1 } from '@/components/enrollment/EnrollmentStep1';
import { EnrollmentStep2 } from '@/components/enrollment/EnrollmentStep2';
import { EnrollmentStep3 } from '@/components/enrollment/EnrollmentStep3';
import { EnrollmentStep4 } from '@/components/enrollment/EnrollmentStep4';

interface PaymentHistory {
  id: string;
  receipt_number: string;
  payment_type: string;
  payment_for: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  status: string;
  reference_number?: string;
}

// Mock payment data for enrollment
const MOCK_ENROLLMENT_PAYMENTS: PaymentHistory[] = [
  {
    id: '1',
    receipt_number: 'RCP-202401-0100',
    payment_type: 'Enrollment Fee',
    payment_for: 'Enrollment Fee S.Y. 2024-2025',
    amount: 2500.00,
    payment_method: 'Cash',
    payment_date: '2024-01-10',
    status: 'Approved'
  },
  {
    id: '2',
    receipt_number: 'RCP-202401-0101',
    payment_type: 'Tuition Installment',
    payment_for: '1st Quarter Tuition Fee',
    amount: 5000.00,
    payment_method: 'GCash',
    payment_date: '2024-01-15',
    status: 'Approved',
    reference_number: 'GC-20240115-ABC123'
  },
  {
    id: '3',
    receipt_number: 'RCP-202401-0102',
    payment_type: 'Miscellaneous',
    payment_for: 'School Supplies and Uniform',
    amount: 3500.00,
    payment_method: 'Bank Transfer',
    payment_date: '2024-01-20',
    status: 'Verified',
    reference_number: 'BT-20240120-XYZ789'
  }
];

interface Document {
  id: number;
  file_name: string;
  document_type: string;
  verification_status: 'Pending' | 'Verified' | 'Rejected';
  verified_date: string | null;
  file_path: string;
  
  // Resubmission fields
  submission_method: 'Uploaded' | 'Physical' | 'Both';
  rejection_reason?: string;
  verification_notes?: string;
  resubmission_count: number;
  is_current_version: boolean;
  previous_version_id?: number | null;
  resubmission_requested_date?: string | null;
  resubmitted_date?: string | null;
  
  // Physical verification
  physical_verification_status: 'Not Required' | 'Pending' | 'Checked' | 'Missing';
  physical_verified_by?: number | null;
  physical_verified_date?: string | null;
}

interface EnrollmentData {
  id: number;
  status: 'Pending' | 'Incomplete' | 'Under Review' | 'Approved' | 'Rejected';
  submitted_date: string;
  approved_date: string | null;
  rejected_date: string | null;
  rejection_reason: string | null;
  rejection_note?: string | null;
  
  // Academic Period
  academic_period_id: number;
  school_year: string;
  quarter: '1st Quarter' | '2nd Quarter' | '3rd Quarter' | '4th Quarter';
  grade_level: string;
  
  // Enrollment Type
  enrollment_type?: 'New Student' | 'Continuing Student' | 'Returning Student' | 'Transferee';
  
  // Tracking
  enrollment_period_id?: number | null;
  created_user_id?: number | null;
  created_student_id?: number | null;
  approved_by?: number | null;
  last_reviewed_by?: number | null;
  
  documents: Document[];
  learner_first_name?: string;
  learner_middle_name?: string;
  learner_last_name?: string;
  birth_date?: string;
  gender?: string;
  psa_birth_cert_number?: string;
  current_address?: string;
  current_barangay?: string;
  current_municipality?: string;
  current_province?: string;
  current_zip_code?: string;
  current_phone?: string;
  permanent_address?: string;
  permanent_barangay?: string;
  permanent_municipality?: string;
  permanent_province?: string;
  permanent_zip_code?: string;
  same_as_current?: boolean;
  father_name?: string;
  father_contact?: string;
  father_email?: string;
  mother_name?: string;
  mother_contact?: string;
  mother_email?: string;
  is_returning_student?: boolean;
  is_indigenous_ip?: boolean;
  is_4ps_beneficiary?: boolean;
  has_disability?: boolean;
  disability_type?: string;
  payments?: PaymentHistory[];
  total_paid?: number;
  total_required?: number;
  payment_status?: 'Unpaid' | 'Partial' | 'Fully Paid';
}

const statusConfig = {
  'Pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <AlertCircle className="w-5 h-5" /> },
  'Incomplete': { bg: 'bg-orange-100', text: 'text-orange-800', icon: <AlertCircle className="w-5 h-5" /> },
  'Under Review': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <AlertCircle className="w-5 h-5" /> },
  'Verified': { bg: 'bg-teal-100', text: 'text-teal-800', icon: <CheckCircle className="w-5 h-5" /> },
  'Approved': { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="w-5 h-5" /> },
  'Rejected': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="w-5 h-5" /> },
};

// Map enrollment status to step number
const getStepFromStatus = (status: string): number => {
  switch (status) {
    case 'Pending':
      return 1;
    case 'Under Review':
      return 2;
    case 'Verified':
      return 3;
    case 'Approved':
    case 'Rejected':
      return 4;
    default:
      return 1;
  }
};

export default function EnrollmentDetail() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [editedEnrollment, setEditedEnrollment] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!enrollmentId) return;
    fetchEnrollmentDetail();
  }, [enrollmentId]);

  const fetchEnrollmentDetail = async () => {
    try {
      setLoading(true);
      const url = API_ENDPOINTS.ADMIN_ENROLLMENT_DETAIL(enrollmentId!);
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch enrollment details');
      }

      const data = await response.json();
      if (data.success) {
        setEnrollment(data.data);
        // Set current step based on enrollment status
        const stepFromStatus = getStepFromStatus(data.data.status);
        setCurrentStep(stepFromStatus);
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to load enrollment',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching enrollment:', error);
      toast({
        title: 'Error',
        description: 'Error loading enrollment details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedEnrollment(null);
      setIsEditing(false);
    } else {
      setEditedEnrollment(JSON.parse(JSON.stringify(enrollment)));
      setIsEditing(true);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    if (editedEnrollment) {
      setEditedEnrollment(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleSaveChanges = async () => {
    if (!editedEnrollment || !enrollmentId) return;
    
    try {
      setActionLoading(true);
      setEnrollment(editedEnrollment);
      setEditedEnrollment(null);
      setIsEditing(false);
      toast({
        title: 'Success',
        description: 'Enrollment updated successfully'
      });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: 'Error',
        description: 'Error saving changes',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (options?: { preserveStudentId?: boolean }) => {
    if (!enrollmentId) return;
    
    try {
      setActionLoading(true);
      const url = API_ENDPOINTS.ADMIN_ENROLLMENT_APPROVE(enrollmentId);
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preserveStudentId: options?.preserveStudentId || false }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: `Enrollment approved! Student ID: ${data.student_id}`
        });
        setEnrollment(prev => prev ? { 
          ...prev, 
          status: 'Approved', 
          student_id: data.student_id,
          created_student_id: data.id,
          approved_date: new Date().toISOString()
        } : null);
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to approve enrollment',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error approving enrollment:', error);
      toast({
        title: 'Error',
        description: 'Error approving enrollment',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!enrollmentId) return;
    
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      setActionLoading(true);
      const url = API_ENDPOINTS.ADMIN_ENROLLMENT_REJECT(enrollmentId);
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Enrollment rejected'
        });
        setEnrollment(prev => prev ? { ...prev, status: 'Rejected', rejection_reason: reason } : null);
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to reject enrollment',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error rejecting enrollment:', error);
      toast({
        title: 'Error',
        description: 'Error rejecting enrollment',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDocument = async (documentId: number) => {
    try {
      setActionLoading(true);
      const url = API_ENDPOINTS.ADMIN_DOCUMENT_VERIFY(documentId);
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Document verified'
        });
        fetchEnrollmentDetail();
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to verify document',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error verifying document:', error);
      toast({
        title: 'Error',
        description: 'Error verifying document',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDocument = async (documentId: number) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      setActionLoading(true);
      const url = API_ENDPOINTS.ADMIN_DOCUMENT_REJECT(documentId);
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Document rejected'
        });
        fetchEnrollmentDetail();
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to reject document',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error rejecting document:', error);
      toast({
        title: 'Error',
        description: 'Error rejecting document',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex-1 space-y-6 p-6">
          <button
            onClick={() => navigate('/admin/enrollments')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Enrollments
          </button>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading enrollment details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!enrollment) {
    return (
      <DashboardLayout>
        <div className="flex-1 space-y-6 p-6">
          <button
            onClick={() => navigate('/admin/enrollments')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Enrollments
          </button>
          <div className="bg-white rounded-lg shadow-sm border-2 border-red-200 p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <p className="text-red-700 font-medium text-lg">Enrollment not found</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const status = statusConfig[enrollment.status];

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Update enrollment status
  const updateEnrollmentStatus = async (newStatus: string) => {
    if (!enrollmentId) return false;
    
    try {
      setActionLoading(true);
      const response = await fetch(API_ENDPOINTS.ENROLLMENT_STATUS(enrollmentId), {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchEnrollmentDetail();
        
        // Invalidate notification queries to update sidebar/notification bell
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        queryClient.invalidateQueries({ queryKey: ['notifications', 'enrollment-count'] });
        
        toast({
          title: 'Success',
          description: `Enrollment status updated to ${newStatus}`,
        });
        return true;
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to update status',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Error updating enrollment status',
        variant: 'destructive',
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Step completion handlers
  const handleStep1Complete = async () => {
    const success = await updateEnrollmentStatus('Under Review');
    if (success) {
      handleNextStep();
    }
  };

  const handleStep2Complete = async () => {
    const success = await updateEnrollmentStatus('Verified');
    if (success) {
      handleNextStep();
    }
  };

  const handleStep3Complete = async () => {
    if (!enrollment) return;

    const currentStatus = (enrollment.status || '').toLowerCase();
    const needsStatusUpdate = currentStatus !== 'verified' && currentStatus !== 'approved' && currentStatus !== 'rejected';

    if (needsStatusUpdate) {
      const success = await updateEnrollmentStatus('Verified');
      if (success) {
        handleNextStep();
      }
      return;
    }

    handleNextStep();
  };

  const handleStep4Approve = async (options?: { preserveStudentId?: boolean }) => {
    await handleApprove(options);
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-6 max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/admin/enrollments')}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Enrollments
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-blue-600">Enrollment #{enrollment.id}</h1>
            <p className="text-gray-600 mt-2">
              {enrollment.school_year || 'N/A'} {enrollment.quarter && `- ${enrollment.quarter}`} | {enrollment.grade_level}
            </p>
            {enrollment.created_student_id && (
              <p className="text-sm text-green-600 font-semibold mt-1">
                ✓ Student Record Created: #{enrollment.created_student_id}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isEditing && enrollment.status !== 'Approved' && enrollment.status !== 'Rejected' && (
              <Button onClick={handleEditToggle} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                Edit Enrollment
              </Button>
            )}
            {isEditing && (
              <>
                <Button onClick={handleSaveChanges} className="bg-green-600 hover:bg-green-700 text-white font-semibold" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button onClick={handleEditToggle} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold" disabled={actionLoading}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 -z-10">
              <div className={`h-full bg-blue-500 transition-all duration-300 ${
                enrollment.status === 'Rejected' ? 'w-0' : 
                currentStep === 1 ? 'w-1/4' : 
                currentStep === 2 ? 'w-2/4' : 
                currentStep === 3 ? 'w-3/4' : 'w-full'
              }`}></div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => handleStepClick(1)} className="flex flex-col items-center flex-1 group transition-all">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white mb-3 transition-all ${
                  currentStep === 1 ? 'bg-blue-500 ring-4 ring-blue-100 scale-110' :
                  currentStep > 1 ? 'bg-green-500 cursor-pointer hover:scale-105' : 'bg-gray-300'
                }`}>
                  {currentStep > 1 ? '✓' : '1'}
                </div>
                <p className={`text-sm font-semibold text-center transition-colors ${
                  currentStep === 1 ? 'text-blue-600' : 'text-gray-900 group-hover:text-blue-600'
                }`}>Enrollment Info</p>
                <p className="text-xs text-gray-500 mt-1 text-center">Check student data</p>
              </button>

              <button onClick={() => handleStepClick(2)} className="flex flex-col items-center flex-1 group transition-all">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white mb-3 transition-all ${
                  currentStep === 2 ? 'bg-blue-500 ring-4 ring-blue-100 scale-110' :
                  currentStep > 2 ? 'bg-green-500 cursor-pointer hover:scale-105' : 'bg-gray-300'
                }`}>
                  {currentStep > 2 ? '✓' : '2'}
                </div>
                <p className={`text-sm font-semibold text-center transition-colors ${
                  currentStep === 2 ? 'text-blue-600' : 'text-gray-900 group-hover:text-blue-600'
                }`}>Documents</p>
                <p className="text-xs text-gray-500 mt-1 text-center">Verify documents</p>
              </button>

              <button onClick={() => handleStepClick(3)} className="flex flex-col items-center flex-1 group transition-all">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white mb-3 transition-all ${
                  currentStep === 3 ? 'bg-blue-500 ring-4 ring-blue-100 scale-110' :
                  currentStep > 3 ? 'bg-green-500 cursor-pointer hover:scale-105' : 'bg-gray-300'
                }`}>
                  {currentStep > 3 ? '✓' : '3'}
                </div>
                <p className={`text-sm font-semibold text-center transition-colors ${
                  currentStep === 3 ? 'text-blue-600' : 'text-gray-900 group-hover:text-blue-600'
                }`}>Payment</p>
                <p className="text-xs text-gray-500 mt-1 text-center">Review payments</p>
              </button>

              <button onClick={() => handleStepClick(4)} className="flex flex-col items-center flex-1 group transition-all">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white mb-3 transition-all ${
                  enrollment.status === 'Rejected' ? 'bg-red-500' : enrollment.status === 'Approved' ? 'bg-green-500' :
                  currentStep === 4 ? 'bg-blue-500 ring-4 ring-blue-100 scale-110' : 'bg-gray-300'
                }`}>
                  {enrollment.status === 'Rejected' ? '✕' : enrollment.status === 'Approved' ? '✓' : '4'}
                </div>
                <p className={`text-sm font-semibold text-center transition-colors ${
                  currentStep === 4 ? 'text-blue-600' : 'text-gray-900 group-hover:text-blue-600'
                }`}>Approval</p>
                <p className="text-xs text-gray-500 mt-1 text-center">Final decision</p>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              {currentStep === 1 ? <span>Review enrollment information and check all required fields are completed.</span> :
               currentStep === 2 ? <span>Verify submitted documents. Document verification is required to maintain complete system records before final approval.</span> :
               currentStep === 3 ? <span>Review payment history and verify all required fees have been paid.</span> :
               enrollment.status === 'Approved' ? <span className="text-green-700 font-medium">✓ Enrollment has been approved.</span> :
               enrollment.status === 'Rejected' ? <span className="text-red-700 font-medium">✕ Enrollment has been rejected. Reason: {enrollment.rejection_reason}</span> :
               <span>Review all information and make final approval decision.</span>
              }
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className={`px-6 py-4 ${
            currentStep === 1 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
            currentStep === 2 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
            currentStep === 3 ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-purple-500 to-purple-600'
          }`}>
            <h2 className="text-2xl font-bold text-white">
              {currentStep === 1 ? 'Step 1: Enrollment Information' :
               currentStep === 2 ? 'Step 2: Document Verification' :
               currentStep === 3 ? 'Step 3: Payment Review' : 'Step 4: Final Approval'}
            </h2>
            <p className="text-white/90 text-sm mt-1">
              {currentStep === 1 ? 'Review and verify all student enrollment details' :
               currentStep === 2 ? 'Check required documents and verification status' :
               currentStep === 3 ? 'Review payment history and verify all fees' :
               'Review all information and make final approval decision'}
            </p>
          </div>

          <div className="p-6">
            {currentStep === 1 && (
              <EnrollmentStep1
                enrollment={enrollment}
                editedEnrollment={editedEnrollment}
                isEditing={isEditing}
                handleFieldChange={handleFieldChange}
                status={status}
                onComplete={handleStep1Complete}
              />
            )}
            {currentStep === 2 && (
              <EnrollmentStep2
                enrollment={enrollment}
                actionLoading={actionLoading}
                handleVerifyDocument={handleVerifyDocument}
                handleRejectDocument={handleRejectDocument}
                onComplete={handleStep2Complete}
                onRefresh={fetchEnrollmentDetail}
              />
            )}
            {currentStep === 3 && (
              <EnrollmentStep3
                enrollment={enrollment}
                onComplete={handleStep3Complete}
              />
            )}
            {currentStep === 4 && (
              <EnrollmentStep4
                enrollment={enrollment}
                actionLoading={actionLoading}
                handleApprove={handleStep4Approve}
                handleReject={handleReject}
              />
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Button
            onClick={handlePreviousStep}
            disabled={currentStep === 1}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          {currentStep < 4 ? (
            <Button onClick={handleNextStep} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              Next Step
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="text-sm text-gray-500">Final step - Make your decision above</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
