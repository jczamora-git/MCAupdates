import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EnrollmentPeriods from './EnrollmentPeriods';
import DocumentRequirements from './DocumentRequirements';

export default function EnrollmentSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('periods');

  return (
    <DashboardLayout role="admin">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Enrollment Settings
            </h1>
            <p className="text-muted-foreground text-lg">
              Configure enrollment periods and document requirements
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/enrollments')}
            className="shadow-md hover:shadow-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Enrollments
          </Button>
        </div>

        {/* Tabs Container */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-gradient-to-r from-muted/80 to-muted p-1">
            <TabsTrigger 
              value="periods" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <Calendar className="w-4 h-4" />
              Enrollment Periods
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              <FileText className="w-4 h-4" />
              Document Requirements
            </TabsTrigger>
          </TabsList>

          {/* Enrollment Periods Section */}
          <TabsContent value="periods" className="space-y-0 mt-6">
            <EnrollmentPeriods embedded={true} />
          </TabsContent>

          {/* Document Requirements Section */}
          <TabsContent value="documents" className="space-y-0 mt-6">
            <DocumentRequirements embedded={true} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
