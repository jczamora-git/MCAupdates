import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2, QrCode } from "lucide-react";
import { API_ENDPOINTS, apiPost } from "@/lib/api";

type Student = {
  id: string;
  student_number: string;
  full_name: string;
  year_level: string;
  first_name: string;
  last_name: string;
};

type ServiceFee = {
  id: string;
  fee_name: string;
  amount: number;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PAYMENT_STATUS = [
  "Pending",
  "Verified",
  "Approved",
  "Rejected"
];

type SchoolServicePaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  serviceFeeAmount: number;
  serviceFees: ServiceFee[];
  selectedServiceFeeId: string | null;
  onServiceFeeChange: (id: string) => void;
  selectedYear: number;
  userId?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  initialStudent?: Student | null;
  initialMonth?: number;
};

export const SchoolServicePaymentModal = ({
  open,
  onOpenChange,
  students,
  serviceFeeAmount,
  serviceFees,
  selectedServiceFeeId,
  onServiceFeeChange,
  selectedYear,
  userId,
  onSuccess,
  onError,
  initialStudent = null,
  initialMonth = new Date().getMonth() + 1
}: SchoolServicePaymentModalProps) => {
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(initialStudent);
  const [paymentMonth, setPaymentMonth] = useState(initialMonth);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("Approved");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Student search autocomplete
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);

  // GCash QR integration
  const [gcashToken, setGcashToken] = useState<string | null>(null);
  const [gcashSessionLoading, setGcashSessionLoading] = useState(false);
  const [gcashProofReceived, setGcashProofReceived] = useState(false);

  const selectedServiceFee = serviceFees.find(
    (fee) => String(fee.id) === String(selectedServiceFeeId)
  );

  useEffect(() => {
    if (!selectedServiceFeeId && serviceFees.length > 0) {
      onServiceFeeChange(serviceFees[0].id);
    }
  }, [selectedServiceFeeId, serviceFees, onServiceFeeChange]);

  // Initialize student search query when initial student is provided
  useEffect(() => {
    if (initialStudent) {
      setPaymentStudent(initialStudent);
      setStudentSearchQuery(initialStudent.full_name);
    }
  }, [initialStudent]);

  // Update initial month when it changes
  useEffect(() => {
    setPaymentMonth(initialMonth);
  }, [initialMonth]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setPaymentStudent(initialStudent);
    setStudentSearchQuery(initialStudent?.full_name || "");
    setPaymentMonth(initialMonth);
    setPaymentMethod("Cash");
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber("");
    setPaymentStatus("Approved");
    setPaymentRemarks("");
    setGcashToken(null);
    setGcashProofReceived(false);
    setShowStudentSuggestions(false);
  };

  // Filtered student suggestions for autocomplete
  const filteredStudentSuggestions = students.filter(s => {
    if (!studentSearchQuery || studentSearchQuery.trim() === "") return true;
    const query = studentSearchQuery.toLowerCase();
    return (
      s.student_number?.toLowerCase().includes(query) ||
      s.first_name?.toLowerCase().includes(query) ||
      s.last_name?.toLowerCase().includes(query) ||
      s.full_name?.toLowerCase().includes(query)
    );
  }).slice(0, 10);

  // GCash QR handler
  const handleOpenGcashQr = async () => {
    if (!paymentStudent) {
      onError("Please select a student first");
      return;
    }
    setGcashSessionLoading(true);
    setGcashProofReceived(false);
    try {
      const feeName = selectedServiceFee?.fee_name || 'Service Fee';
      const res = await apiPost(API_ENDPOINTS.GCASH_SESSIONS, {
        user_id: paymentStudent.id,
        amount_due: selectedServiceFee?.amount ?? serviceFeeAmount,
        payment_description: `${feeName} - ${MONTHS[paymentMonth - 1]} ${selectedYear}`,
      });
      if (res.success && res.token) {
        setGcashToken(res.token);
        window.open(`${import.meta.env.BASE_URL}admin/gcash-session/${res.token}`, '_blank');
      } else {
        onError(res.message || 'Failed to create GCash session');
      }
    } catch {
      onError('Failed to create GCash session');
    } finally {
      setGcashSessionLoading(false);
    }
  };

  // Storage event listener for GCash proof
  useEffect(() => {
    if (!gcashToken) return;
    const handler = (e: StorageEvent) => {
      if (e.key === `gcash_proof_${gcashToken}` && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.ocr_reference) {
            setReferenceNumber(data.ocr_reference);
          }
          setGcashProofReceived(true);
        } catch {}
        localStorage.removeItem(`gcash_proof_${gcashToken}`);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [gcashToken]);

  const handleSubmit = async () => {
    if (!paymentStudent) {
      onError("Please select a student");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        student_id: paymentStudent.id,
        service_period_month: paymentMonth,
        service_period_year: selectedYear,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference_number: referenceNumber || null,
        status: paymentStatus,
        remarks: paymentRemarks || null,
        received_by: userId,
        service_fee_id: selectedServiceFee?.id,
        service_fee_name: selectedServiceFee?.fee_name
      };

      const res = await apiPost(API_ENDPOINTS.SCHOOL_SERVICE_CREATE_PAYMENT, payload);
      
      if (res?.success) {
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        onError(res?.message || 'Failed to record payment');
      }
    } catch (error: any) {
      onError(error?.message || 'Error recording payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Record Service Fee Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              <strong>Service Fee Payment:</strong> {selectedServiceFee?.fee_name || 'Service Fee'} — ₱{(selectedServiceFee?.amount ?? serviceFeeAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Row 1: Student */}
          <div>
            <Label>Student *</Label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search student by name or ID..."
                value={studentSearchQuery}
                onChange={(e) => {
                  setStudentSearchQuery(e.target.value);
                  setShowStudentSuggestions(true);
                  if (!paymentStudent || e.target.value !== paymentStudent.full_name) {
                    setPaymentStudent(null);
                  }
                }}
                onFocus={() => setShowStudentSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowStudentSuggestions(false), 200);
                }}
              />
              {showStudentSuggestions && filteredStudentSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredStudentSuggestions.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPaymentStudent(student);
                        setStudentSearchQuery(student.full_name);
                        setShowStudentSuggestions(false);
                      }}
                    >
                      <div className="font-medium">{student.full_name}</div>
                      <div className="text-sm text-gray-500">
                        {student.student_number} • {student.year_level}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Service Fee & Service Month */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Service Fee *</Label>
              <Select
                value={selectedServiceFeeId || ""}
                onValueChange={onServiceFeeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service fee" />
                </SelectTrigger>
                <SelectContent>
                  {serviceFees.length > 0 ? (
                    serviceFees.map((fee) => (
                      <SelectItem key={fee.id} value={fee.id}>
                        {fee.fee_name} - ₱{Number(fee.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-fees" disabled>
                      No recurring service fees configured
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Month *</Label>
              <Select value={paymentMonth.toString()} onValueChange={(v) => setPaymentMonth(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Service Period */}
          <div>
            <Label>Service Period</Label>
            <div className="bg-muted p-2 rounded-md flex items-center h-10">
              <p className="font-semibold text-sm">{MONTHS[paymentMonth - 1]} {selectedYear}</p>
            </div>
          </div>

          {/* Row 4: Amount & Payment Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount *</Label>
              <div className="bg-blue-50 p-2 rounded-md border border-blue-200 flex items-center h-10">
                <p className="text-lg font-bold text-blue-700">
                  ₱{(selectedServiceFee?.amount ?? serviceFeeAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div>
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          {/* Row 5: Payment Method & Payment Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Check">Check</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="GCash">GCash</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Status *</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentMethod === "GCash" ? (
            <div className="space-y-3">
              {/* GCash QR uploader */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700 mb-2 font-medium">
                  Let the student upload their GCash screenshot by scanning a QR code.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={handleOpenGcashQr}
                  disabled={gcashSessionLoading || !paymentStudent}
                >
                  {gcashSessionLoading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating session…</>
                    : <><QrCode className="h-4 w-4 mr-2" />Open GCash QR Uploader</>}
                </Button>
                {!paymentStudent && (
                  <p className="text-[10px] text-blue-400 mt-1.5 text-center">Select a student first to enable</p>
                )}
                {gcashProofReceived && (
                  <div className="mt-2 flex items-center gap-2 text-green-700 text-xs font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Proof received — reference auto-filled below
                  </div>
                )}
              </div>
              <div>
                <Label>GCash Reference Number</Label>
                <Input
                  placeholder="Auto-filled from QR upload, or enter manually"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.replace(/\D/g, ""))}
                  className="font-mono"
                />
              </div>
            </div>
          ) : (
            <div>
              <Label>
                {paymentMethod === "Cash" ? "Invoice Number" : "Reference Number"}
                {paymentMethod !== "Cash" && " (Check #, Transaction ID, etc.)"}
              </Label>
              <Input
                placeholder={paymentMethod === "Cash" ? "Enter official receipt invoice number" : "Enter reference number"}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>
          )}

          {/* Row 7: Remarks */}
          <div>
            <Label>Remarks (Optional)</Label>
            <Textarea
              value={paymentRemarks}
              onChange={(e) => setPaymentRemarks(e.target.value)}
              placeholder="Additional notes about this payment..."
              rows={3}
            />
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !paymentStudent}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording...
              </>
            ) : (
              'Record Payment'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
