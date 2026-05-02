import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { EnrollmentManagement } from '@/components/EnrollmentManagement';
import { useRoleBasedAuth } from '@/hooks/useRoleBasedAuth';

export default function ManagementPage() {
  const { user } = useRoleBasedAuth(['admin', 'teacher']);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <DashboardLayout>
      <div className="w-full">
        <EnrollmentManagement key={`enrollments-${refreshKey}`} />
      </div>
    </DashboardLayout>
  );
}
