import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiGet } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Calendar, Coins, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/DashboardLayout';

interface WaiverRequest {
  id: number;
  installment_id: number;
  installment_number: number;
  penalty_amount: number;
  days_overdue: number;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  admin_response: string | null;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  academic_period: string;
}

export default function WaiverRequests() {
  const { user } = useAuth();
  const [waiverRequests, setWaiverRequests] = useState<WaiverRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchWaiverRequests();
  }, [user?.id]);

  const fetchWaiverRequests = async () => {
    try {
      setLoading(true);
      const response = await apiGet(API_ENDPOINTS.STUDENT_WAIVER_REQUESTS.replace(':studentId', String(user?.id)));
      
      if (response.success && response.data) {
        setWaiverRequests(response.data);
      } else {
        setWaiverRequests([]);
      }
    } catch (error) {
      console.error('Error fetching late payment explanations:', error);
      toast.error('Failed to load late payment explanations');
      setWaiverRequests([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="enrollment-readable container mx-auto p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading explanations...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="enrollment-readable container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Late Payment Explanations</h1>
          <p className="text-muted-foreground mt-2">
            View your submitted explanations for late payments. Note: Penalties are still charged.
          </p>
        </div>

        {waiverRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Explanations Submitted</h3>
              <p className="text-muted-foreground text-center max-w-md">
                You haven't submitted any late payment explanations yet. When you pay an overdue installment, you'll be required to submit an explanation.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {waiverRequests.map((request) => (
              <Card key={request.id} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-1" />
                      <div>
                        <CardTitle className="text-lg">
                          Installment #{request.installment_number} - {request.academic_period}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Submitted on {format(new Date(request.requested_at), 'MMM dd, yyyy h:mm a')}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <div className="grid gap-4">
                    {/* Penalty Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <Coins className="h-5 w-5 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-red-600 font-medium">Penalty Amount</p>
                          <p className="text-lg font-bold text-red-700">₱{Number(request.penalty_amount).toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <Calendar className="h-5 w-5 text-orange-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-orange-600 font-medium">Days Overdue</p>
                          <p className="text-lg font-bold text-orange-700">{request.days_overdue} days</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-blue-600 font-medium">Explanation ID</p>
                          <p className="text-lg font-bold text-blue-700">#{request.id}</p>
                        </div>
                      </div>
                    </div>

                    {/* Your Explanation */}
                    {request.reason && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold text-sm text-gray-700 mb-2">Your Explanation:</h4>
                          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border">
                            {request.reason}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Penalty Notice */}
                    <>
                      <Separator />
                      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">Penalty Applied</p>
                          <p className="text-xs text-red-700 mt-1">
                            This penalty was charged with your payment as per school policy. Explanations are for record-keeping purposes only.
                          </p>
                        </div>
                      </div>
                    </>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
