import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, Download, FileText, CheckCircle2, XCircle, AlertCircle, Clock, Eye, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, API_ENDPOINTS } from '@/lib/api';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface EnrollmentDetail {
  id: number;
  status: 'Pending' | 'Incomplete' | 'Under Review' | 'Approved' | 'Rejected';
  submitted_date: string;
  first_reviewed_date?: string;
  approved_date?: string;
  rejected_date?: string;
  rejection_reason?: string;
  rejection_note?: string;

  // Academic Period
  academic_period_id: number;
  school_year: string;
  quarter: '1st Quarter' | '2nd Quarter' | '3rd Quarter' | '4th Quarter';
  
  // Tracking fields
  enrollment_period_id?: number | null;
  created_user_id?: number | null;
  created_student_id?: number | null;
  approved_by?: number | null;
  last_reviewed_by?: number | null;

  // Student Info
  learner_first_name: string;
  learner_middle_name: string;
  learner_last_name: string;
  birth_date: string;
  gender: string;
  psa_birth_cert_number: string;
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

  // Special Info
  is_returning_student: boolean;
  is_indigenous_ip: boolean;
  is_4ps_beneficiary: boolean;
  has_disability: boolean;
  disability_type: string;
  special_language: string;

  // Parent Info
  father_name: string;
  father_contact: string;
  father_email: string;
  mother_name: string;
  mother_contact: string;
  mother_email: string;
  guardian_name: string;
  guardian_contact: string;
  guardian_email: string;

  // Documents with resubmission support
  documents: Array<{
    id: number;
    file_name: string;
    file_type: string;
    file_path: string;
    document_type: string;
    verification_status: 'Verified' | 'Pending' | 'Rejected';
    uploaded_date?: string;
    verified_date?: string;
    file_url: string;
    
    // Resubmission fields
    submission_method: 'Uploaded' | 'Physical' | 'Both';
    rejection_reason?: 'Wrong Document Type' | 'Unclear/Illegible' | 'Incomplete Information' | 'Document Expired' | 'Does Not Match Requirements' | 'Invalid Format' | 'Other';
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
    verified_by?: number | null;
    verified_by_name?: string;
  }>;
}

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  'Pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="w-5 h-5" /> },
  'Incomplete': { bg: 'bg-orange-100', text: 'text-orange-800', icon: <AlertCircle className="w-5 h-5" /> },
  'Under Review': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <Clock className="w-5 h-5" /> },
  'Approved': { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle2 className="w-5 h-5" /> },
  'Rejected': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="w-5 h-5" /> },
};

export const EnrollmentApprovalDetail = () => {
  const navigate = useNavigate();
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const { user } = useRoleBasedAuth(['admin', 'teacher']);
  
  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);
  
  // Document rejection
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [showDocRejectDialog, setShowDocRejectDialog] = useState(false);
  const [docRejectionReason, setDocRejectionReason] = useState<string>('');
  const [docRejectionNotes, setDocRejectionNotes] = useState<string>('');
  
  // Document history
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [documentHistory, setDocumentHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !enrollmentId) return;
    fetchEnrollmentDetail();
  }, [user, enrollmentId]);

  const fetchEnrollmentDetail = async () => {
    try {
      setLoading(true);
      const response = await apiGet(`/api/admin/enrollments/${enrollmentId}`);
      
      if (response.success && response.data) {
        setEnrollment(response.data);
      } else {
        throw new Error('Failed to load enrollment details');
      }
    } catch (error) {
      console.error('Error fetching enrollment:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load enrollment');
      navigate('/admin/enrollments');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!enrollment) return;

    try {
      setSubmitting(true);
      const response = await apiPost(`/api/admin/enrollments/${enrollment.id}/approve`, {
        status: 'Approved'
      });

      if (response.success) {
        toast.success('Enrollment approved successfully');
        setEnrollment({ ...enrollment, status: 'Approved' });
        setTimeout(() => navigate('/admin/enrollments'), 2000);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve enrollment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!enrollment || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiPost(`/api/admin/enrollments/${enrollment.id}/reject`, {
        status: 'Rejected',
        rejection_reason: rejectionReason
      });

      if (response.success) {
        toast.success('Enrollment rejected');
        setEnrollment({ ...enrollment, status: 'Rejected', rejection_reason: rejectionReason });
        setShowRejectDialog(false);
        setTimeout(() => navigate('/admin/enrollments'), 2000);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject enrollment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyDocument = async (documentId: number) => {
    try {
      const response = await apiPost(`/api/admin/enrollments/documents/${documentId}/verify`, {
        status: 'Verified'
      });

      if (response.success) {
        toast.success('Document verified');
        fetchEnrollmentDetail();
      }
    } catch (error) {
      toast.error('Failed to verify document');
    }
  };

  const handleRejectDocument = async () => {
    if (!selectedDocumentId || !docRejectionReason || !docRejectionNotes.trim()) {
      toast.error('Please select a rejection reason and provide notes');
      return;
    }

    try {
      const response = await apiPost(`/api/admin/documents/${selectedDocumentId}/reject`, {
        rejection_reason: docRejectionReason,
        notes: docRejectionNotes
      });

      if (response.success) {
        toast.success('Document rejected. Resubmission requested.');
        setShowDocRejectDialog(false);
        setDocRejectionReason('');
        setDocRejectionNotes('');
        setSelectedDocumentId(null);
        fetchEnrollmentDetail();
      }
    } catch (error) {
      toast.error('Failed to reject document');
    }
  };

  const handleVerifyPhysicalDocument = async (documentId: number) => {
    try {
      const response = await apiPost(`/api/admin/documents/${documentId}/verify-physical`, {});

      if (response.success) {
        toast.success('Physical document verified');
        fetchEnrollmentDetail();
      }
    } catch (error) {
      toast.error('Failed to verify physical document');
    }
  };

  const fetchDocumentHistory = async (enrollmentId: number, documentType: string) => {
    try {
      const response = await apiGet(`/api/admin/documents/${enrollmentId}/history/${encodeURIComponent(documentType)}`);
      if (response.success) {
        setDocumentHistory(response.data || []);
        setShowHistoryDialog(true);
      }
    } catch (error) {
      toast.error('Failed to load document history');
    }
  };

  if (!user) {
    return <div>Access Denied</div>;
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6 text-center py-12">
          <p className="text-gray-600">Loading enrollment details...</p>
        </CardContent>
      </Card>
    );
  }

  if (!enrollment) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Enrollment not found</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const status = statusColors[enrollment.status];
  const studentName = `${enrollment.learner_first_name} ${enrollment.learner_middle_name ? enrollment.learner_middle_name + ' ' : ''}${enrollment.learner_last_name}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          onClick={() => navigate('/admin/enrollments')}
          variant="ghost"
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Enrollments
        </Button>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${status.bg}`}>
          {status.icon}
          <span className={`font-semibold ${status.text}`}>{enrollment.status}</span>
        </div>
      </div>

      {/* Main Info */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-white text-2xl">{studentName}</CardTitle>
              <p className="text-blue-100 mt-1">
                Enrollment ID: {enrollment.id} | {enrollment.school_year} - {enrollment.quarter}
              </p>
              {enrollment.created_student_id && (
                <p className="text-blue-100 mt-1">
                  Student Record Created: #{enrollment.created_student_id}
                </p>
              )}
            </div>
            <Badge className="bg-white text-blue-700">{enrollment.grade_level}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Submitted</p>
              <p className="font-semibold">{new Date(enrollment.submitted_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Birth Date</p>
              <p className="font-semibold">{new Date(enrollment.birth_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Gender</p>
              <p className="font-semibold">{enrollment.gender}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Information */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Student Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">First Name</p>
              <p className="font-semibold">{enrollment.learner_first_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Middle Name</p>
              <p className="font-semibold">{enrollment.learner_middle_name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Last Name</p>
              <p className="font-semibold">{enrollment.learner_last_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">PSA Birth Certificate</p>
              <p className="font-semibold">{enrollment.psa_birth_cert_number || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Address */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Current Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Address</p>
            <p className="font-semibold">{enrollment.current_address}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Barangay</p>
              <p className="font-semibold">{enrollment.current_barangay}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Municipality</p>
              <p className="font-semibold">{enrollment.current_municipality}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Province</p>
              <p className="font-semibold">{enrollment.current_province}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Zip Code</p>
              <p className="font-semibold">{enrollment.current_zip_code}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-600">Contact Number</p>
              <p className="font-semibold">{enrollment.current_phone}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permanent Address */}
      {!enrollment.same_as_current && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Permanent Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-semibold">{enrollment.permanent_address}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Barangay</p>
                <p className="font-semibold">{enrollment.permanent_barangay}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Municipality</p>
                <p className="font-semibold">{enrollment.permanent_municipality}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Province</p>
                <p className="font-semibold">{enrollment.permanent_province}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Zip Code</p>
                <p className="font-semibold">{enrollment.permanent_zip_code}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Special Information */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Special Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              {enrollment.is_returning_student ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-gray-400" />
              )}
              <span>Returning Student</span>
            </div>
            <div className="flex items-center gap-2">
              {enrollment.is_indigenous_ip ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-gray-400" />
              )}
              <span>Indigenous Person (IP)</span>
            </div>
            <div className="flex items-center gap-2">
              {enrollment.is_4ps_beneficiary ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-gray-400" />
              )}
              <span>4Ps Program Beneficiary</span>
            </div>
            <div className="flex items-center gap-2">
              {enrollment.has_disability ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-gray-400" />
              )}
              <span>Has Disability</span>
            </div>
          </div>
          {enrollment.has_disability && enrollment.disability_type && (
            <div>
              <p className="text-sm text-gray-600">Disability Type</p>
              <p className="font-semibold">{enrollment.disability_type}</p>
            </div>
          )}
          {enrollment.special_language && (
            <div>
              <p className="text-sm text-gray-600">Special Language</p>
              <p className="font-semibold">{enrollment.special_language}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parent/Guardian Information */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Parent/Guardian Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {(enrollment.father_name || enrollment.father_contact) && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Father</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-semibold">{enrollment.father_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Contact</p>
                  <p className="font-semibold">{enrollment.father_contact}</p>
                </div>
                {enrollment.father_email && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold">{enrollment.father_email}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(enrollment.mother_name || enrollment.mother_contact) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Mother</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold">{enrollment.mother_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Contact</p>
                    <p className="font-semibold">{enrollment.mother_contact}</p>
                  </div>
                  {enrollment.mother_email && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold">{enrollment.mother_email}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {(enrollment.guardian_name || enrollment.guardian_contact) && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Guardian</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold">{enrollment.guardian_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Contact</p>
                    <p className="font-semibold">{enrollment.guardian_contact}</p>
                  </div>
                  {enrollment.guardian_email && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-semibold">{enrollment.guardian_email}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Submitted Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollment.documents.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No documents uploaded. Documents can be collected during walk-in process.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {enrollment.documents.filter(d => d.is_current_version).map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{doc.document_type}</p>
                        <Badge variant="outline" className="text-xs">
                          {doc.submission_method}
                        </Badge>
                        {doc.resubmission_count > 0 && (
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                            Resubmitted {doc.resubmission_count}x
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{doc.file_name}</p>
                      {doc.uploaded_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          Uploaded: {new Date(doc.uploaded_date).toLocaleDateString()}
                        </p>
                      )}
                      
                      {/* Rejection Info */}
                      {doc.verification_status === 'Rejected' && doc.rejection_reason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs font-semibold text-red-800">Rejected: {doc.rejection_reason}</p>
                          {doc.verification_notes && (
                            <p className="text-xs text-red-700 mt-1">{doc.verification_notes}</p>
                          )}
                          {doc.resubmission_requested_date && (
                            <p className="text-xs text-red-600 mt-1">
                              Resubmission requested: {new Date(doc.resubmission_requested_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Physical Verification Status */}
                      {doc.submission_method !== 'Uploaded' && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-600">Physical Document:</span>
                          <Badge
                            variant="outline"
                            className={
                              doc.physical_verification_status === 'Checked'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : doc.physical_verification_status === 'Missing'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }
                          >
                            {doc.physical_verification_status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={
                        doc.verification_status === 'Verified'
                          ? 'bg-green-100 text-green-800'
                          : doc.verification_status === 'Rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {doc.verification_status}
                    </Badge>
                    
                    {/* View Document */}
                    {doc.submission_method !== 'Physical' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <Eye className="w-4 h-4" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{doc.document_type}</DialogTitle>
                            <DialogDescription>{doc.file_name}</DialogDescription>
                          </DialogHeader>
                          <div className="bg-gray-100 rounded-lg p-4 text-center">
                            {doc.file_url?.endsWith('.pdf') ? (
                              <embed
                                src={doc.file_url}
                                type="application/pdf"
                                width="100%"
                                height="500px"
                              />
                            ) : (
                              <img
                                src={doc.file_url}
                                alt={doc.document_type}
                                className="max-w-full h-auto"
                              />
                            )}
                          </div>
                          <div className="flex gap-2 justify-end mt-4">
                            <Button
                              onClick={() => handleVerifyDocument(doc.id)}
                              className="bg-green-600 hover:bg-green-700 gap-2"
                              disabled={doc.verification_status === 'Verified'}
                            >
                              <Check className="w-4 h-4" />
                              Verify
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedDocumentId(doc.id);
                                setShowDocRejectDialog(true);
                              }}
                              variant="destructive"
                              className="gap-2"
                              disabled={doc.verification_status === 'Rejected'}
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    
                    {/* Verify Physical */}
                    {doc.submission_method !== 'Uploaded' && doc.physical_verification_status !== 'Checked' && (
                      <Button
                        onClick={() => handleVerifyPhysicalDocument(doc.id)}
                        variant="outline"
                        size="sm"
                        className="gap-2 border-green-200 text-green-700 hover:bg-green-50"
                      >
                        <Check className="w-4 h-4" />
                        Check Physical
                      </Button>
                    )}
                    
                    {/* View History */}
                    {doc.resubmission_count > 0 && (
                      <Button
                        onClick={() => fetchDocumentHistory(enrollment.id, doc.document_type)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Clock className="w-4 h-4" />
                        History ({doc.resubmission_count + 1})
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Rejection Dialog */}
      <Dialog open={showDocRejectDialog} onOpenChange={setShowDocRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
            <DialogDescription>
              Select a rejection reason and provide additional notes. The student will be notified to resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doc-rejection-reason">Rejection Reason *</Label>
              <select
                id="doc-rejection-reason"
                value={docRejectionReason}
                onChange={(e) => setDocRejectionReason(e.target.value)}
                className="w-full mt-2 px-3 py-2 border rounded-md"
              >
                <option value="">Select a reason...</option>
                <option value="Wrong Document Type">Wrong Document Type</option>
                <option value="Unclear/Illegible">Unclear/Illegible</option>
                <option value="Incomplete Information">Incomplete Information</option>
                <option value="Document Expired">Document Expired</option>
                <option value="Does Not Match Requirements">Does Not Match Requirements</option>
                <option value="Invalid Format">Invalid Format</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="doc-rejection-notes">Additional Notes *</Label>
              <Textarea
                id="doc-rejection-notes"
                placeholder="Explain what needs to be corrected..."
                value={docRejectionNotes}
                onChange={(e) => setDocRejectionNotes(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDocRejectDialog(false);
                  setDocRejectionReason('');
                  setDocRejectionNotes('');
                  setSelectedDocumentId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectDocument}
                disabled={!docRejectionReason || !docRejectionNotes.trim()}
                variant="destructive"
              >
                Reject & Request Resubmission
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document Version History</DialogTitle>
            <DialogDescription>
              All submissions for this document type
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {documentHistory.map((version, index) => (
              <div key={version.id} className="p-3 border rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{version.file_name}</p>
                      {version.is_current_version && (
                        <Badge className="bg-blue-100 text-blue-800">Current</Badge>
                      )}
                      {index === 0 && version.resubmission_count > 0 && (
                        <Badge variant="outline">v{version.resubmission_count + 1}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Uploaded: {new Date(version.upload_date).toLocaleString()}
                    </p>
                    {version.verified_date && (
                      <p className="text-xs text-gray-500">
                        Verified: {new Date(version.verified_date).toLocaleString()} by {version.verified_by_name}
                      </p>
                    )}
                    {version.verification_status === 'Rejected' && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-xs font-semibold text-red-800">Rejected: {version.rejection_reason}</p>
                        <p className="text-xs text-red-700 mt-1">{version.verification_notes}</p>
                      </div>
                    )}
                  </div>
                  <Badge
                    className={
                      version.verification_status === 'Verified'
                        ? 'bg-green-100 text-green-800'
                        : version.verification_status === 'Rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {version.verification_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason */}
      {enrollment.status === 'Rejected' && enrollment.rejection_reason && (
        <Card className="border-0 shadow-md bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Rejection Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-800">{enrollment.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {enrollment.status !== 'Approved' && enrollment.status !== 'Rejected' && (
        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-0 bg-white p-4 border-t rounded-lg shadow-md">
          <Button
            onClick={handleApprove}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 text-white gap-2 flex-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? 'Approving...' : 'Approve Enrollment'}
          </Button>

          <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="flex-1 gap-2">
                <XCircle className="w-4 h-4" />
                Reject Enrollment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject Enrollment</DialogTitle>
                <DialogDescription>
                  Provide a reason for rejecting this enrollment. The parent will be notified.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="reason">Rejection Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., Missing required documents, Form 137 not submitted..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="mt-2"
                    rows={4}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={submitting || !rejectionReason.trim()}
                    variant="destructive"
                  >
                    {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default EnrollmentApprovalDetail;
