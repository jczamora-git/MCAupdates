import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertCircle, CheckCircle2, Clock, XCircle, Mail, ChevronLeft, FileCheck, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiGet, API_ENDPOINTS } from "@/lib/api";

interface EnrollmentStatus {
  id: number;
  confirmation_number: string;
  status: "Pending" | "Incomplete" | "Under Review" | "Verified" | "Approved" | "Rejected";
  enrollment_type?: string;
  submitted_date: string;
  first_reviewed_date: string | null;
  approved_date: string | null;
  rejected_date: string | null;
  student_name: string;
  grade_level: string;
  documents: {
    type: string;
    status: "Verified" | "Not Uploaded" | "Pending" | "Rejected";
    uploaded?: string;
    verified?: string;
  }[];
  documents_count?: number;
  documents_verified?: number;
  timeline: Array<{
    date: string;
    event: string;
  }>;
  next_steps: string;
  rejection_reason?: string;
  created_student_id?: number;
}

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode; badgeBg: string; badgeText: string }> = {
  Pending: {
    bg: "bg-yellow-50 border-yellow-300",
    text: "text-yellow-900",
    icon: <Clock className="w-6 h-6 text-yellow-600" />,
    badgeBg: "bg-yellow-100",
    badgeText: "text-yellow-800",
  },
  Incomplete: {
    bg: "bg-orange-50 border-orange-300",
    text: "text-orange-900",
    icon: <AlertCircle className="w-6 h-6 text-orange-600" />,
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-800",
  },
  "Under Review": {
    bg: "bg-purple-50 border-purple-300",
    text: "text-purple-900",
    icon: <Clock className="w-6 h-6 text-purple-600" />,
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
  },
  Verified: {
    bg: "bg-blue-50 border-blue-300",
    text: "text-blue-900",
    icon: <FileCheck className="w-6 h-6 text-blue-600" />,
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
  },
  Approved: {
    bg: "bg-green-50 border-green-300",
    text: "text-green-900",
    icon: <CheckCircle2 className="w-6 h-6 text-green-600" />,
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
  },
  Rejected: {
    bg: "bg-red-50 border-red-300",
    text: "text-red-900",
    icon: <XCircle className="w-6 h-6 text-red-600" />,
    badgeBg: "bg-red-100",
    badgeText: "text-red-800",
  },
};

const EnrollmentStatus = () => {
  const navigate = useNavigate();
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const { user } = useAuth();
  const [enrollment, setEnrollment] = useState<EnrollmentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchEnrollmentStatus = async () => {
      try {
        const response = await apiGet(API_ENDPOINTS.ENROLLMENT_STATUS(enrollmentId || ''));

        if (response.enrollment) {
          setEnrollment(response.enrollment);
        } else {
          throw new Error(response.message || "No enrollment data received");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load enrollment status");
        navigate("/enrollment/my-enrollments");
      } finally {
        setLoading(false);
      }
    };

    fetchEnrollmentStatus();
  }, [enrollmentId, user, navigate]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="enrollment-readable min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading enrollment status...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!enrollment) {
    return (
      <DashboardLayout>
        <div className="enrollment-readable min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
          <div className="max-w-4xl mx-auto">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Enrollment not found. Please try again or contact support.</AlertDescription>
            </Alert>
            <Button onClick={() => navigate("/enrollment/my-enrollments")} className="mt-4">
              Back to My Enrollments
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const statusInfo = statusColors[enrollment.status] || statusColors.Pending;
  const timelineEntries = [...(enrollment.timeline || [])]
    .filter((event) => !!event?.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const verifiedDocumentsCount = typeof enrollment.documents_verified === "number"
    ? enrollment.documents_verified
    : (enrollment.documents || []).filter((doc) => doc.status === "Verified").length;
  const totalDocumentsCount = typeof enrollment.documents_count === "number"
    ? enrollment.documents_count
    : (enrollment.documents || []).length;
  const verificationProgress = totalDocumentsCount > 0
    ? Math.round((verifiedDocumentsCount / totalDocumentsCount) * 100)
    : 0;
  const verificationProgressWidthClass =
    verificationProgress >= 100 ? "w-full" :
    verificationProgress >= 90 ? "w-11/12" :
    verificationProgress >= 80 ? "w-10/12" :
    verificationProgress >= 70 ? "w-9/12" :
    verificationProgress >= 60 ? "w-8/12" :
    verificationProgress >= 50 ? "w-6/12" :
    verificationProgress >= 40 ? "w-5/12" :
    verificationProgress >= 30 ? "w-4/12" :
    verificationProgress >= 20 ? "w-3/12" :
    verificationProgress >= 10 ? "w-2/12" :
    verificationProgress > 0 ? "w-1/12" :
    "w-0";

  return (
    <DashboardLayout>
      <div className="enrollment-readable min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-3 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => navigate("/enrollment/my-enrollments")}
            className="-ml-2 hover:bg-white/80 text-xs sm:text-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1 sm:mr-2" />
            Back to My Enrollments
          </Button>

          {/* Status Header Card */}
          <Card className={`border shadow-lg ${statusInfo.bg}`}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 sm:gap-6">
                <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                  <div className="mt-1 p-2.5 sm:p-3 bg-white rounded-xl shadow-sm flex-shrink-0">{statusInfo.icon}</div>
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Enrollment Tracking</h1>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Track review milestones and document verification in real time.</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Badge className={`${statusInfo.badgeBg} ${statusInfo.badgeText} text-xs sm:text-sm px-3 py-1 rounded-full font-semibold`}>
                        {enrollment.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs sm:text-sm">
                        {enrollment.confirmation_number}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full lg:w-auto lg:min-w-[320px]">
                  <div className="rounded-xl border bg-white/80 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Submitted</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">
                      {new Date(enrollment.submitted_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-white/80 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Documents</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">{verifiedDocumentsCount}/{totalDocumentsCount} Verified</p>
                  </div>
                  <div className="col-span-2 rounded-xl border bg-white/80 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Verification Progress</p>
                      <p className="text-xs font-semibold text-gray-700">{verificationProgress}%</p>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full bg-gradient-to-r from-blue-500 to-emerald-500 ${verificationProgressWidthClass}`} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Timeline */}
              <Card className="shadow-md border-slate-200/80">
                <CardHeader className="border-b border-slate-200 p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Tracking Timeline</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {timelineEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No timeline events yet.</p>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-[7px] sm:left-2 top-1 bottom-1 w-0.5 bg-slate-200" />
                      <div className="space-y-4 sm:space-y-5">
                        {timelineEntries.map((event, index) => (
                          <div key={`${event.event}-${event.date}-${index}`} className="relative pl-6 sm:pl-8">
                            <div className="absolute left-0 top-1.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-blue-600 ring-4 ring-blue-100" />
                            <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
                              <p className="font-semibold text-gray-900 text-sm sm:text-base break-words">{event.event}</p>
                              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                {new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documents Status */}
              {enrollment.documents && enrollment.documents.length > 0 && (
                <Card className="shadow-md border-slate-200/80">
                  <CardHeader className="border-b border-slate-200 p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">Required Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="space-y-2.5 sm:space-y-3">
                      {(enrollment.documents || []).map((doc, index) => {
                        const docStatusConfig = {
                          "Verified": { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-800", icon: <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" /> },
                          "Not Uploaded": { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-800", icon: <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" /> },
                          "Pending": { bg: "bg-yellow-50", border: "border-yellow-200", badge: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" /> },
                          "Rejected": { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 text-orange-800", icon: <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" /> },
                        };
                        const config = docStatusConfig[doc.status] || docStatusConfig.Pending;

                        return (
                          <div key={index} className={`p-3 sm:p-4 rounded-xl border ${config.bg} ${config.border}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 sm:gap-3 flex-1 min-w-0">
                                <div className="mt-1 flex-shrink-0">{config.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 text-sm sm:text-base break-words">{doc.type}</p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                    <Badge className={`${config.badge} text-xs px-2.5 py-0.5 rounded-full font-medium`}>
                                      {doc.status}
                                    </Badge>
                                  </div>
                                  {doc.uploaded && (
                                    <p className="text-xs text-gray-600 mt-1.5">
                                      Uploaded: {new Date(doc.uploaded).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </p>
                                  )}
                                  {doc.verified && (
                                    <p className="text-xs text-green-700 font-semibold mt-1">
                                      Verified: {new Date(doc.verified).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {doc.status === "Verified" && (
                                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4 sm:space-y-6">
              {/* Applicant Information */}
              <Card className="shadow-md border-slate-200/80">
                <CardHeader className="border-b border-slate-200 p-4 sm:p-5">
                  <CardTitle className="text-base sm:text-lg">Applicant Information</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div>
                    <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Enrollment Type</p>
                    <p className="text-sm sm:text-base font-bold text-gray-900 mt-1">{enrollment.enrollment_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Grade Level</p>
                    <p className="text-sm sm:text-base font-bold text-gray-900 mt-1">{enrollment.grade_level}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Next Steps */}
              <Card className="shadow-md border-slate-200/80">
                <CardHeader className="border-b border-slate-200 p-4 sm:p-5">
                  <CardTitle className="text-base sm:text-lg">Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  <div className="bg-teal-50 border border-teal-200 p-3 rounded-lg">
                    <p className="text-gray-800 text-sm leading-relaxed">{enrollment.next_steps}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Rejection Reason (if applicable) */}
              {enrollment.status === "Rejected" && enrollment.rejection_reason && (
                <Card className="border border-red-300 bg-red-50 shadow-md">
                  <CardHeader className="border-b border-red-300 p-4 sm:p-5">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2 text-red-900">
                      <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      Rejection Reason
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-5">
                    <p className="text-gray-800 bg-white p-3 rounded-lg border border-red-100 text-sm">{enrollment.rejection_reason}</p>
                  </CardContent>
                </Card>
              )}

              {/* Approved Information (if applicable) */}
              {enrollment.status === "Approved" && enrollment.created_student_id && (
                <Alert className="bg-green-50 border border-green-300 shadow-md">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 text-sm ml-2">
                    <strong className="block mb-1">Congratulations!</strong>
                    Enrollment has been approved. Login credentials will be sent via email.
                  </AlertDescription>
                </Alert>
              )}

              {/* Contact Support */}
              <Card className="shadow-md border-slate-200/80">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm sm:text-base">Need Help?</p>
                      <p className="text-gray-700 text-xs sm:text-sm mt-1.5 leading-relaxed break-words">
                        Contact <strong className="break-all">mca.calapan@gmail.com</strong> or <strong>+63 918-917-3929</strong>.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 sm:pt-3">
            <Button
              onClick={() => navigate("/enrollment/my-enrollments")}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 sm:px-6 h-10 rounded-lg shadow-md font-semibold transition-all text-sm w-full sm:w-auto"
            >
              <Eye className="w-4 h-4 mr-2" />
              Back to All Enrollments
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EnrollmentStatus;
