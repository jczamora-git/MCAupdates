import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Upload, X, CheckCircle2, File, FileText, Package, Info } from "lucide-react";
import { API_ENDPOINTS } from "@/lib/api";
import { EnrollmentFormData } from "../EnrollmentForm";

/**
 * Step 6: Document Submission  
 * NOTE: File upload functionality has been disabled. All documents are submitted physically during enrollment.
 * - Upload-related state variables and handlers are commented out
 * - Upload UI (drag-drop, file list) has been removed
 * - Only physical document checklist is active
 * To re-enable uploads: restore code from git history and uncomment relevant sections
 */

interface Step6Props {
  formData: EnrollmentFormData;
  updateFormData: (updates: Partial<EnrollmentFormData>) => void;
  errors: Record<string, string>;
  isReturningStudent?: boolean;
  isFirstTimer?: boolean;
}

interface PhysicalDocStatus {
  [key: string]: boolean; // document type -> will submit physically
}

interface DocumentRequirement {
  id: number;
  grade_level?: string;
  enrollment_type?: 'New Student' | 'Returning Student' | 'Transferee' | null;
  document_name: string;
  description?: string | null;
  is_required: boolean;
  is_active: boolean;
}

const Step6DocumentUpload = ({ formData, updateFormData, errors, isReturningStudent = false, isFirstTimer = true }: Step6Props) => {
  // File upload features commented out - all documents handled physically
  // Uncomment these states to re-enable file uploads in the future
  // const [dragActive, setDragActive] = useState(false);
  // const [uploadedFiles, setUploadedFiles] = useState<Array<{ file: File; name: string; documentType?: string }>>([]);
  const [physicalDocs, setPhysicalDocs] = useState<PhysicalDocStatus>({});
  const [documentRequirements, setDocumentRequirements] = useState<DocumentRequirement[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Tour State
  const [runTour, setRunTour] = useState(false);
  const [tourScrollOffset, setTourScrollOffset] = useState(20);

  const normalizeEnrollmentType = (): 'New Student' | 'Returning Student' | 'Transferee' => {
    const rawType = String(formData.enrollment_type || '').trim().toLowerCase();

    if (rawType.includes('transf')) return 'Transferee';
    if (rawType.includes('return') || rawType.includes('continu')) return 'Returning Student';
    if (rawType.includes('new')) return 'New Student';

    return isReturningStudent ? 'Returning Student' : 'New Student';
  };

  const filterRequirementsForEnrollment = (
    requirements: DocumentRequirement[],
    gradeLevel: string,
    enrollmentType: 'New Student' | 'Returning Student' | 'Transferee'
  ) => {
    const targetGrade = String(gradeLevel || '').trim().toLowerCase();
    const targetType = String(enrollmentType || '').trim().toLowerCase();
    const targetTypeShort = targetType.split(' ')[0] || '';

    const matched = requirements.filter((req) => {
      if (!req?.is_active) return false;

      const rowGrade = String(req.grade_level || '').trim().toLowerCase();
      if (rowGrade !== targetGrade) return false;

      const rowTypeRaw = req.enrollment_type === null ? '' : String(req.enrollment_type || '').trim();
      const rowType = rowTypeRaw.toLowerCase();
      const rowTypeShort = rowType.split(' ')[0] || '';

      return (
        rowType === '' ||
        rowType === 'all types' ||
        rowType === targetType ||
        rowTypeShort === targetTypeShort
      );
    });

    const bestByDocument = new Map<string, DocumentRequirement>();

    matched.forEach((req) => {
      const key = String(req.document_name || '').trim().toLowerCase();
      if (!key) return;

      const rowType = req.enrollment_type ? String(req.enrollment_type).trim().toLowerCase() : '';
      const rowTypeShort = rowType.split(' ')[0] || '';
      const specific = rowType === targetType || rowTypeShort === targetTypeShort;
      const score = specific ? 2 : 1;

      const current = bestByDocument.get(key) as (DocumentRequirement & { _score?: number; display_order?: number }) | undefined;
      if (!current) {
        bestByDocument.set(key, { ...req, _score: score } as DocumentRequirement);
        return;
      }

      const currentScore = (current as any)._score || 0;
      if (score > currentScore) {
        bestByDocument.set(key, { ...req, _score: score } as DocumentRequirement);
        return;
      }

      const reqOrder = Number((req as any).display_order) || 0;
      const currentOrder = Number((current as any).display_order) || 0;
      if (score === currentScore && reqOrder < currentOrder) {
        bestByDocument.set(key, { ...req, _score: score } as DocumentRequirement);
      }
    });

    return Array.from(bestByDocument.values())
      .map((req: any) => {
        if ('_score' in req) {
          const { _score, ...rest } = req;
          return rest as DocumentRequirement;
        }
        return req as DocumentRequirement;
      });
  };

  const documentUploadTourSteps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">📄 Document Submission</h3>
          <p>Review required documents for physical submission during your enrollment visit.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    ...(formData.enrollment_type === 'Continuing Student' ? [
      {
        target: '#continuing-docs-alert',
        content: 'As a continuing student, your documents are already on file. No submission required!',
        placement: 'top' as const,
      },
    ] : [
      {
        target: '#document-guidance-alert',
        content: 'Review the information about document requirements for your enrollment type.',
        placement: 'top' as const,
      },
      /* Commented out - was used when file uploads were enabled
      {
        target: '.bg-orange-50',
        content: 'Remember: all uploads are optional. You can proceed without documents.',
      },
      {
        target: '[class*="border-dashed"]',
        content: 'Drag and drop your files here, or click to select files. Supports PDF, JPG, PNG up to 10MB each.',
      },
      {
        target: 'input[type="file"]',
        content: 'Click this area to browse and select multiple files from your computer.',
      },
      */
      {
        target: '#required-doc-first-item',
        content: 'Review the documents you need to bring in person during enrollment.',
        placement: 'top' as const,
      },
      {
        target: '#required-doc-first-checkbox',
        content: 'Check this box to confirm you will bring each document physically.',
        placement: 'top' as const,
      },
    ]),
  ];

  const togglePhysicalDoc = (docId: string) => {
    setPhysicalDocs(prev => ({
      ...prev,
      [docId]: !prev[docId]
    }));
  };

  // File upload handlers commented out - uncomment to re-enable file uploads
  // const handleFiles = (files: FileList | null) => {
  //   if (!files) return;

  //   const newFiles: File[] = [];
  //   for (let i = 0; i < files.length; i++) {
  //     const file = files[i];

  //     // Validate file type
  //     const validTypes = ["application/pdf", "image/jpeg", "image/png"];
  //     if (!validTypes.includes(file.type)) {
  //       continue;
  //     }

  //     // Validate file size (max 10MB)
  //     if (file.size > 10 * 1024 * 1024) {
  //       continue;
  //     }

  //     newFiles.push(file);
  //     setUploadedFiles((prev) => [
  //       ...prev,
  //       { file, name: file.name },
  //     ]);
  //   }

  //   updateFormData({ documents: [...formData.documents, ...newFiles] });
  // };

  useEffect(() => {
    const grade = formData.grade_level?.trim();
    if (!grade) {
      setDocumentRequirements([]);
      setDocumentsError(null);
      setDocumentsLoading(false);
      return;
    }

    const controller = new AbortController();
    const enrollmentType = normalizeEnrollmentType();

    const loadRequirements = async () => {
      setDocumentsLoading(true);
      setDocumentsError(null);

      try {
        const response = await fetch(API_ENDPOINTS.DOCUMENT_REQUIREMENTS_FOR_ENROLLMENT(grade, enrollmentType), {
          credentials: "include",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Failed to load document requirements");
        }

        const payload = await response.json();
        const requirements = payload?.data || payload?.requirements || [];
        const activeRequirements = requirements.filter((req: DocumentRequirement) => Boolean(req.is_active));

        if (activeRequirements.length > 0) {
          setDocumentRequirements(activeRequirements);
          return;
        }

        const fallbackResponse = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS, {
          credentials: "include",
          signal: controller.signal
        });

        if (!fallbackResponse.ok) {
          setDocumentRequirements([]);
          return;
        }

        const fallbackPayload = await fallbackResponse.json();
        const fallbackRows = fallbackPayload?.data || fallbackPayload?.requirements || [];
        const fallbackFiltered = filterRequirementsForEnrollment(fallbackRows, grade, enrollmentType);
        setDocumentRequirements(fallbackFiltered);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching document requirements:", error);
        setDocumentsError("Unable to load document requirements at this time.");
        setDocumentRequirements([]);
      } finally {
        if (!controller.signal.aborted) {
          setDocumentsLoading(false);
        }
      }
    };

    loadRequirements();

    return () => controller.abort();
  }, [formData.grade_level, formData.enrollment_type, isReturningStudent]);

  useEffect(() => {
    // Auto start tour for step 6
    const hasSeenTour = localStorage.getItem('documentUploadTourCompleted');
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

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      localStorage.setItem('documentUploadTourCompleted', 'true');
    }
  };

  // File removal and drag-drop handlers commented out - uncomment to re-enable file uploads
  // const removeFile = (index: number) => {
  //   setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  //   updateFormData({
  //     documents: formData.documents.filter((_, i) => i !== index),
  //   });
  // };

  // const handleDrag = (e: React.DragEvent) => {
  //   e.preventDefault();
  //   e.stopPropagation();
  //   if (e.type === "dragenter" || e.type === "dragover") {
  //     setDragActive(true);
  //   } else if (e.type === "dragleave") {
  //     setDragActive(false);
  //   }
  // };

  // const handleDrop = (e: React.DragEvent) => {
  //   e.preventDefault();
  //   e.stopPropagation();
  //   setDragActive(false);
  //   handleFiles(e.dataTransfer.files);
  // };

  const requiredDocumentList = documentRequirements.filter(req => req.is_required);
  const optionalDocumentList = documentRequirements.filter(req => !req.is_required);
  const allDocumentOptions = [...requiredDocumentList, ...optionalDocumentList];

  // Validate physical document submission
  useEffect(() => {
    // Skip validation for continuing students (no docs required)
    if (formData.enrollment_type === 'Continuing Student') {
      setValidationError(null);
      // only update parent if value would change
      if (formData.documentsValid !== true) updateFormData({ documentsValid: true, physicalDocumentNames: [] });
      return;
    }

    // Skip if no required documents loaded yet
    if (requiredDocumentList.length === 0 || documentsLoading) {
      setValidationError(null);
      return;
    }

    // Check if all required documents are marked for physical submission
    const uncheckedDocs = requiredDocumentList.filter(doc => {
      const docKey = doc.id.toString();
      return !physicalDocs[docKey];
    });

    // Get list of all documents marked for physical submission
    const physicalDocNames = allDocumentOptions
      .filter(doc => physicalDocs[doc.id.toString()])
      .map(doc => doc.document_name);

    const newValid = uncheckedDocs.length === 0;
    if (!newValid) {
      const docNames = uncheckedDocs.map(d => d.document_name).join(', ');
      const message = `Please confirm you will bring the following required document${uncheckedDocs.length > 1 ? 's' : ''} physically: ${docNames}`;
      if (validationError !== message) setValidationError(message);
    } else {
      if (validationError !== null) setValidationError(null);
    }

    // only update parent when validity actually changes to avoid re-render loops
    const physicalDocsChanged = JSON.stringify(formData.physicalDocumentNames) !== JSON.stringify(physicalDocNames);
    if (formData.documentsValid !== newValid || physicalDocsChanged) {
      updateFormData({ documentsValid: newValid, physicalDocumentNames: physicalDocNames });
    }
  }, [physicalDocs, requiredDocumentList, formData.enrollment_type, documentsLoading]);

  return (
    <div className="space-y-6">
      {/* Header Card - Only show for non-continuing students */}
      {formData.enrollment_type !== 'Continuing Student' && (
        <Card className="border-0 shadow-md bg-gradient-to-r from-blue-600 to-blue-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-white" />
              <div>
                <CardTitle className="text-white text-xl">Required Documents</CardTitle>
                <p className="text-orange-100 text-sm mt-1">Bring required documents physically during your enrollment visit (file uploads are disabled)</p>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-6">
      {formData.enrollment_type === 'Continuing Student' && !isFirstTimer ? (
        <>
          <Alert id="continuing-docs-alert" className="bg-green-50 border-green-200">
            <Info className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              As a continuing student, your academic documents are already on file. <strong>No document upload is required.</strong> You can proceed directly to review and submit your enrollment.
            </AlertDescription>
          </Alert>
        </>
      ) : formData.enrollment_type === 'Continuing Student' ? (
        <>
          <Alert id="continuing-docs-alert" className="bg-green-50 border-green-200">
            <Info className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              As a continuing student, your academic documents from previous years are on file. <strong>No document upload is required.</strong> You can proceed directly to review and submit your enrollment.
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <>
          <Alert id="document-guidance-alert" className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              {isFirstTimer 
                ? "Please review the required documents below. You'll need to bring them during your enrollment visit for verification."
                : "Please review the document requirements. Confirm which documents you'll bring during your enrollment visit."}
            </AlertDescription>
          </Alert>
          
          {/* Alert about optional uploads commented out - was used when file uploads were enabled
          <Alert className="bg-orange-50 border-orange-200">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              {isFirstTimer 
                ? <>All document uploads are <strong>optional</strong>. You can proceed with your enrollment without uploading documents.</>
                : "Returning students should provide updated documents or indicate physical submission. You can still proceed if documents are being submitted physically."}
            </AlertDescription>
          </Alert>
          */}
        </>
      )}

      {documentsError && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {documentsError}
          </AlertDescription>
        </Alert>
      )}

      {/* Documents Checklist - Physical Submission Only */}
      {formData.enrollment_type !== 'Continuing Student' && (
      <Card id="required-docs-card">
        <CardHeader>
          <CardTitle className="text-base">Required Documents for Physical Submission</CardTitle>
          <p className="text-sm text-gray-600 mt-1">Check the box to confirm you'll bring each document in person during enrollment</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {documentsLoading ? (
            <p className="text-sm text-gray-500">Loading document requirements...</p>
          ) : requiredDocumentList.length === 0 ? (
            <p className="text-sm text-gray-500">
              No required documents configured for {formData.grade_level || "this grade"}. You can upload anything you already have.
            </p>
          ) : (
            requiredDocumentList.map((doc, index) => {
              const docKey = doc.id.toString();
              return (
                <div id={index === 0 ? "required-doc-first-item" : undefined} key={doc.id} className={`p-4 rounded-lg border-2 transition-all ${
                  physicalDocs[docKey] ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 break-words">{doc.document_name}</p>
                      {doc.description && (
                        <p className="text-sm text-gray-600 break-words">{doc.description}</p>
                      )}
                    </div>
                    <div className="flex w-full sm:w-auto items-start sm:items-center gap-2 justify-start sm:justify-end">
                      <Checkbox
                        id={index === 0 ? "required-doc-first-checkbox" : `physical-${docKey}`}
                        checked={physicalDocs[docKey] || false}
                        onCheckedChange={() => togglePhysicalDoc(docKey)}
                        className="mt-1 sm:mt-0"
                      />
                      <Label htmlFor={index === 0 ? "required-doc-first-checkbox" : `physical-${docKey}`} className="text-sm font-medium cursor-pointer flex items-center gap-1 leading-snug break-words">
                        <Package className="w-4 h-4 shrink-0" />
                        Submit Physically
                      </Label>
                    </div>
                  </div>
                  {physicalDocs[docKey] && (
                    <div className="mt-3 p-2 bg-purple-100 border border-purple-200 rounded">
                      <p className="text-xs font-semibold text-purple-800">
                        ✓ You will submit this document face-to-face during enrollment
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      )}

      {/* Validation Error */}
      {validationError && formData.enrollment_type !== 'Continuing Student' && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Action Required:</strong> {validationError}
          </AlertDescription>
        </Alert>
      )}

      {/* Physical Documents Summary */}
      {Object.values(physicalDocs).some(v => v) && (
        <Alert className="bg-purple-50 border-purple-300">
          <Package className="h-5 w-5 text-purple-600" />
          <AlertDescription className="text-purple-900">
            <p className="font-semibold mb-2">Documents to Submit Face-to-Face ({Object.values(physicalDocs).filter(v => v).length}):</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {Object.entries(physicalDocs)
                .filter(([_, checked]) => checked)
                .map(([docId]) => {
                  const doc = allDocumentOptions.find(d => d.id.toString() === docId);
                  return doc ? <li key={docId}>{doc.document_name}</li> : null;
                })}
            </ul>
            <p className="text-xs mt-3 text-purple-700">
              Please bring these documents when you visit the school for enrollment processing.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Tips */}
      {formData.enrollment_type !== 'Continuing Student' && (
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Important:</strong> All document verification will be done during your in-person enrollment visit. Please bring clear, readable copies of all required documents. Make sure photo copies and original documents are available for verification.
        </AlertDescription>
      </Alert>
      )}

      <Joyride
        steps={documentUploadTourSteps}
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
    </div>
  );
};

export default Step6DocumentUpload;
