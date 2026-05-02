import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '@/hooks/useNotification';
import { apiGet, API_ENDPOINTS } from '@/lib/api';

interface EnrollmentStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export const EnrollmentDashboardWidget = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [stats, setStats] = useState<EnrollmentStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnrollmentStats();
  }, []);

  const fetchEnrollmentStats = async () => {
    try {
      setLoading(true);
      const response = await apiGet(API_ENDPOINTS.ADMIN_ENROLLMENTS_STATS);
      if (response.ok) {
        const data = response.data;
        setStats({
          pending: data.pending || 0,
          approved: data.approved || 0,
          rejected: data.rejected || 0,
          total: data.total || 0,
        });
      }
    } catch (error) {
      showNotification('Failed to load enrollment statistics', 'error');
      console.error('Failed to fetch enrollment stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Enrollment Management</CardTitle>
              <CardDescription>Quick enrollment overview</CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/enrollments')}
            className="gap-1"
          >
            View All
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Pending */}
            <div className="space-y-1 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Pending</span>
              </div>
              <p className="text-2xl font-bold text-amber-900">
                {loading ? '-' : stats.pending}
              </p>
            </div>

            {/* Approved */}
            <div className="space-y-1 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Approved</span>
              </div>
              <p className="text-2xl font-bold text-green-900">
                {loading ? '-' : stats.approved}
              </p>
            </div>

            {/* Rejected */}
            <div className="space-y-1 p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-700">Rejected</span>
              </div>
              <p className="text-2xl font-bold text-red-900">
                {loading ? '-' : stats.rejected}
              </p>
            </div>

            {/* Total */}
            <div className="space-y-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4 text-slate-600" />
                <span className="text-xs font-medium text-slate-700">Total</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '-' : stats.total}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          {stats.pending > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {stats.pending} enrollment{stats.pending !== 1 ? 's' : ''} pending review
                  </p>
                  <p className="text-xs text-blue-700">Action required</p>
                </div>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => navigate('/admin/enrollments')}
                >
                  Review Now
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
