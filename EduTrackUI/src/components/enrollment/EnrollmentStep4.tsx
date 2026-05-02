import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';

interface EnrollmentStep4Props {
  enrollment: any;
  actionLoading: boolean;
  handleApprove: (options?: { preserveStudentId?: boolean }) => void;
  handleReject: () => void;
}

export function EnrollmentStep4({ 
  enrollment, 
  actionLoading,
  handleApprove,
  handleReject 
}: EnrollmentStep4Props) {
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Check if this is a continuing/returning student with an existing student record
  // created_student_id means a student profile already exists for this user
  const isExistingStudent = (enrollment.enrollment_type === 'Continuing Student' || enrollment.enrollment_type === 'Returning Student') 
    && enrollment.created_student_id;

  const studentFullName = [
    enrollment.learner_first_name,
    enrollment.learner_middle_name,
    enrollment.learner_last_name
  ].filter(Boolean).join(' ') || 'N/A';

  const resolvedSection = enrollment.section_name || enrollment.section || (enrollment.section_id ? `Section ID ${enrollment.section_id}` : 'Auto-assign based on year level');
  const mcafId = enrollment.student_id || enrollment.formatted_student_id || 'To be generated upon approval';
  
  const handleApproveClick = () => {
    setIsApproveModalOpen(true);
  };

  const handleRejectClick = () => {
    setIsRejectModalOpen(true);
  };

  const handleConfirmApprove = () => {
    handleApprove({ 
      preserveStudentId: isExistingStudent 
    });
    setIsApproveModalOpen(false);
  };

  const handleConfirmReject = () => {
    handleReject();
    setIsRejectModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Enrollment Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Enrollment Summary</h2>
          <p className="text-purple-100 text-sm mt-1">Review all enrollment details before approval</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">Student Name</p>
              <p className="text-lg font-bold text-gray-900">
                {enrollment.learner_first_name} {enrollment.learner_middle_name} {enrollment.learner_last_name}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">Grade Level</p>
              <p className="text-lg font-bold text-gray-900">{enrollment.grade_level || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">School Year</p>
              <p className="text-lg font-bold text-gray-900">{enrollment.school_year || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">Birth Date</p>
              <p className="text-lg font-bold text-gray-900">
                {enrollment.birth_date ? new Date(enrollment.birth_date).toLocaleDateString() : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">Gender</p>
              <p className="text-lg font-bold text-gray-900">{enrollment.gender || '—'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">Contact Number</p>
              <p className="text-lg font-bold text-gray-900">{enrollment.current_phone || '—'}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-500 mb-1">Current Address</p>
            <p className="text-base text-gray-900">
              {[
                enrollment.current_address,
                enrollment.current_barangay,
                enrollment.current_municipality,
                enrollment.current_province,
                enrollment.current_zip_code
              ].filter(Boolean).join(', ') || '—'}
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Father's Name</p>
                <p className="text-base text-gray-900">{enrollment.father_name || '—'}</p>
                <p className="text-sm text-gray-600">{enrollment.father_contact || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">Mother's Name</p>
                <p className="text-base text-gray-900">{enrollment.mother_name || '—'}</p>
                <p className="text-sm text-gray-600">{enrollment.mother_contact || '—'}</p>
              </div>
            </div>
            {enrollment.guardian_name && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-500 mb-2">Legal Guardian</p>
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                  <p className="text-base font-semibold text-gray-900">{enrollment.guardian_name}</p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-700">
                    <span>📞 {enrollment.guardian_contact || '—'}</span>
                    <span>✉️ {enrollment.guardian_email || '—'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-500 mb-2">Special Information</p>
            <div className="flex flex-wrap gap-2">
              {enrollment.is_returning_student && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  Returning Student
                </span>
              )}
              {enrollment.is_indigenous_ip && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                  Indigenous/IP
                </span>
              )}
              {enrollment.is_4ps_beneficiary && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  4Ps Beneficiary
                </span>
              )}
              {enrollment.has_disability && (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">
                  Has Disability: {enrollment.disability_type}
                </span>
              )}
              {!enrollment.is_returning_student && !enrollment.is_indigenous_ip && !enrollment.is_4ps_beneficiary && !enrollment.has_disability && (
                <span className="text-sm text-gray-500">None</span>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-500 mb-2">Documents Status</p>
            <div className="flex items-center gap-2">
              {enrollment.documents?.length > 0 ? (
                <>
                  <span className="text-base font-semibold text-gray-900">
                    {enrollment.documents.filter((d: any) => d.verification_status === 'Verified').length} / {enrollment.documents.length}
                  </span>
                  <span className="text-sm text-gray-600">documents verified</span>
                </>
              ) : (
                <span className="text-sm text-gray-500">No documents uploaded</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Actions */}
      {enrollment.status === 'Pending' || enrollment.status === 'Incomplete' || enrollment.status === 'Under Review' || enrollment.status === 'Verified' ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Enrollment Actions</h2>
            <p className="text-purple-100 text-sm mt-1">Make final approval decision</p>
          </div>
          
          {/* Warning for existing students */}
          {isExistingStudent && (
            <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">Existing Student Record</p>
                  <p className="text-sm text-blue-700 mt-1">
                    This is a {enrollment.enrollment_type} with an existing student profile (Record ID: {enrollment.created_student_id}). 
                    The student ID will NOT be updated during approval.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-6">
            <div className="flex gap-4">
              <Button
                size="lg"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-base"
                onClick={handleApproveClick}
                disabled={actionLoading}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {actionLoading ? 'Processing...' : 'Approve Enrollment'}
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-6 text-base"
                onClick={handleRejectClick}
                disabled={actionLoading}
              >
                <XCircle className="w-5 h-5 mr-2" />
                {actionLoading ? 'Processing...' : 'Reject Enrollment'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`rounded-lg border-2 p-6 ${
          enrollment.status === 'Approved' 
            ? 'border-green-300 bg-green-50' 
            : enrollment.status === 'Rejected'
            ? 'border-red-300 bg-red-50'
            : 'border-blue-300 bg-blue-50'
        }`}>
          <div className="flex items-center gap-3">
            {enrollment.status === 'Approved' ? (
              <>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-lg font-bold text-green-900">Enrollment Approved</p>
                  <p className="text-sm text-green-700 mt-1">
                    This enrollment was approved on {enrollment.approved_date ? new Date(enrollment.approved_date).toLocaleDateString() : 'N/A'}
                  </p>
                  {enrollment.student_id && (
                    <div className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-800 border border-green-200 rounded text-sm font-bold">
                      Student ID: {enrollment.student_id}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-lg font-bold text-red-900">Enrollment Rejected</p>
                  <p className="text-sm text-red-700 mt-1">
                    Reason: {enrollment.rejection_reason || 'No reason provided'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Final Review Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Final Review Checklist</p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
              <li>All student information is accurate and complete</li>
              <li>Contact details are verified</li>
              <li>Required documents are reviewed (if applicable)</li>
              <li>Special needs or accommodations noted</li>
              <li>Grade level placement is appropriate</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Enrollment Approval</DialogTitle>
            <DialogDescription>
              Please review the student details before final approval.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <div className="flex justify-between gap-3">
              <span className="text-sm font-semibold text-muted-foreground">Student Name</span>
              <span className="text-sm font-medium text-right">{studentFullName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-sm font-semibold text-muted-foreground">Grade</span>
              <span className="text-sm font-medium text-right">{enrollment.grade_level || 'N/A'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-sm font-semibold text-muted-foreground">Section</span>
              <span className="text-sm font-medium text-right">{resolvedSection}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-sm font-semibold text-muted-foreground">MCAF ID</span>
              <span className="text-sm font-medium text-right">{mcafId}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsApproveModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirmApprove} disabled={actionLoading}>
              {actionLoading ? 'Processing...' : 'Yes, Approve Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Enrollment Rejection</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this student enrollment? This action will mark the enrollment as rejected.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Student: {studentFullName}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmReject} disabled={actionLoading}>
              {actionLoading ? 'Processing...' : 'Yes, Reject Enrollment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
