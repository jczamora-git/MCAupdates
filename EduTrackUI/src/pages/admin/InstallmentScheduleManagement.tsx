import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { API_ENDPOINTS, apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import {
  Calendar,
  ArrowLeft,
  Save,
  Edit,
  Info,
  CheckCircle,
  Plus,
  Trash2,
  X,
  Power,
  PowerOff
} from "lucide-react";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from "@/components/Confirm";

type InstallmentDueDate = {
  month?: string; // "01"-"12" or empty for "Upon Enrollment"
  week?: string; // "1st", "2nd", "3rd", "4th", "Last" or "Upon Enrollment"
  display: string; // Combined display text
};

type ScheduleTemplate = {
  id?: string | number;
  name: string;
  description: string;
  schedule_type: "Monthly" | "Quarterly" | "Semestral" | "Tri Semestral";
  number_of_installments: number;
  status?: "active" | "inactive";
  installments?: InstallmentDueDate[];
  created_at?: string;
  updated_at?: string;
};

export default function InstallmentScheduleManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirmFn = useConfirm();

  const [schedules, setSchedules] = useState<ScheduleTemplate[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleTemplate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createForm, setCreateForm] = useState({
    name: "",
    schedule_type: "Monthly" as "Monthly" | "Quarterly" | "Semestral" | "Tri Semestral",
    number_of_installments: 10,
    description: "",
    due_dates: Array(10).fill(null).map(() => ({ month: "", week: "", display: "" }))
  });

  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" }
  ];

  const weekOptions = [
    { value: "Upon Enrollment", label: "Upon Enrollment" },
    { value: "1st week", label: "1st week" },
    { value: "2nd week", label: "2nd week" },
    { value: "3rd week", label: "3rd week" },
    { value: "4th week", label: "4th week" },
    { value: "Last week", label: "Last week" }
  ];

  const getMonthName = (monthValue: string): string => {
    const month = months.find(m => m.value === monthValue);
    return month ? month.label : "";
  };

  const buildDisplayText = (month: string, week: string): string => {
    if (week === "Upon Enrollment") return "Upon Enrollment";
    if (!month || !week) return "";
    return `${getMonthName(month)} - ${week}`;
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      navigate("/unauthorized");
      return;
    }
    fetchSchedules();
  }, [user, navigate]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await apiGet(API_ENDPOINTS.PAYMENT_SCHEDULE_TEMPLATES);
      if (res.success && res.data) {
        setSchedules(res.data);
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError("Failed to load installment schedules");
    } finally {
      setLoading(false);
   }
  };

  const handleEdit = async (schedule: ScheduleTemplate) => {
    setLoading(true);
    setError("");
    
    try {
      // Fetch full schedule details including installments
      const res = await apiGet(API_ENDPOINTS.PAYMENT_SCHEDULE_TEMPLATE_BY_ID(schedule.id!));
      
      if (res.success && res.data) {
        // Map API response to component structure
        const scheduleData = {
          ...res.data,
          installments: (res.data.installments || []).map((inst: any) => ({
            month: inst.month || "",
            week: inst.week_of_month,
            display: inst.label
          }))
        };
        setEditingSchedule(scheduleData);
        setIsEditOpen(true);
      } else {
        setError(res.message || "Failed to load schedule details");
      }
    } catch (err: any) {
      console.error('Error fetching schedule details:', err);
      setError(err.message || "Error loading schedule details");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSchedule) return;

    // Validation
    if (!editingSchedule.name || !editingSchedule.name.trim()) {
      setError("Please enter a template name");
      return;
    }

    if (!editingSchedule.description) {
      setError("Please enter a description");
      return;
    }

    const installdates = editingSchedule.installments || [];
    const missingDates = installdates.filter(d => !d.display).length;
    if (missingDates > 0) {
      setError(`Please configure all ${editingSchedule.number_of_installments} installment schedules`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        name: editingSchedule.name,
        description: editingSchedule.description,
        schedule_type: editingSchedule.schedule_type,
        number_of_installments: editingSchedule.number_of_installments,
        installments: installdates.map((date, index) => ({
          installment_number: index + 1,
          month: date.month || null,
          week_of_month: date.week,
          label: date.display
        }))
      };

      const res = await apiPut(API_ENDPOINTS.PAYMENT_SCHEDULE_TEMPLATE_BY_ID(editingSchedule.id!), payload);
      
      if (res.success) {
        setSuccess("Schedule template updated successfully!");
        setIsEditOpen(false);
        setEditingSchedule(null);
        
        // Refresh list
        await fetchSchedules();
      } else {
        setError(res.message || "Failed to update template");
      }
    } catch (err: any) {
      console.error('Update error:', err);
      setError(err.message || "Error updating schedule template");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (schedule: ScheduleTemplate) => {
    const confirmed = await confirmFn({
      title: "Delete Schedule Template",
      description: `Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const res = await apiDelete(API_ENDPOINTS.PAYMENT_SCHEDULE_TEMPLATE_BY_ID(schedule.id!));
      
      if (res.success) {
        setSuccess("Schedule template deleted successfully!");
        await fetchSchedules();
      } else {
        setError(res.message || "Failed to delete template");
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err.message || "Error deleting schedule template");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (schedule: ScheduleTemplate) => {
    setLoading(true);
    setError("");

    try {
       const res = await apiPut(API_ENDPOINTS.PAYMENT_SCHEDULE_TEMPLATE_TOGGLE_STATUS(schedule.id!), {});
      
      if (res.success) {
        const newStatus = schedule.status === 'active' ? 'inactive' : 'active';
        setSuccess(`Template ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully!`);
        await fetchSchedules();
      } else {
        setError(res.message || "Failed to toggle status");
      }
    } catch (err: any) {
      console.error('Toggle status error:', err);
      setError(err.message || "Error toggling template status");
    } finally {
      setLoading(false);
    }
  };

  const getInstallmentCount = (type: string): number => {
    const counts: Record<string, number> = {
      "Monthly": 10,
      "Quarterly": 4,
      "Semestral": 2,
      "Tri Semestral": 3
    };
    return counts[type] || 10;
  };

  const handleCreateFormChange = (field: string, value: any) => {
    if (field === "schedule_type") {
      const installments = getInstallmentCount(value);
      setCreateForm({
        ...createForm,
        schedule_type: value,
        number_of_installments: installments,
        due_dates: Array(installments).fill(null).map(() => ({ month: "", week: "", display: "" }))
      });
    } else {
      setCreateForm({ ...createForm, [field]: value });
    }
  };

  const handleCreateDueDateChange = (index: number, field: 'month' | 'week', value: string) => {
    const newDueDates = [...createForm.due_dates];
    const current = newDueDates[index];
    
    if (field === 'week' && value === "Upon Enrollment") {
      newDueDates[index] = { month: "", week: value, display: value };
    } else if (field === 'month') {
      const week = current.week === "Upon Enrollment" ? "" : current.week;
      newDueDates[index] = { ...current, month: value, display: buildDisplayText(value, week) };
    } else {
      newDueDates[index] = { ...current, week: value, display: buildDisplayText(current.month, value) };
    }
    
    setCreateForm({ ...createForm, due_dates: newDueDates });
  };

  const handleEditDueDateChange = (index: number, field: 'month' | 'week', value: string) => {
    if (!editingSchedule || !editingSchedule.installments) return;
    const updated = [...editingSchedule.installments];
    const current = updated[index];
    
    if (field === 'week' && value === "Upon Enrollment") {
      updated[index] = { month: "", week: value, display: value };
    } else if (field === 'month') {
      const week = current.week === "Upon Enrollment" ? "" : current.week;
      updated[index] = { ...current, month: value, display: buildDisplayText(value, week) };
    } else {
      updated[index] = { ...current, week: value, display: buildDisplayText(current.month, value) };
    }
    
    setEditingSchedule({ ...editingSchedule, installments: updated });
  };

  const handleCreate = async () => {
    // Validation
    if (!createForm.name || !createForm.name.trim()) {
      setError("Please enter a template name");
      return;
    }

    if (!createForm.description) {
      setError("Please enter a description");
      return;
    }

    const missingDates = createForm.due_dates.filter(d => !d.display).length;
    if (missingDates > 0) {
      setError(`Please configure all ${createForm.number_of_installments} installment schedules`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        name: createForm.name.trim(),
        description: createForm.description,
        schedule_type: createForm.schedule_type,
        number_of_installments: createForm.number_of_installments,
        installments: createForm.due_dates.map((date, index) => ({
          installment_number: index + 1,
          month: date.month || null,
          week_of_month: date.week,
          label: date.display
        }))
      };

      const res = await apiPost(API_ENDPOINTS.PAYMENT_SCHEDULE_TEMPLATES, payload);
      
      if (res.success) {
        setSuccess("Schedule template created successfully!");
        setIsCreateOpen(false);
        
        // Reset form
        setCreateForm({
          name: "",
          schedule_type: "Monthly",
          number_of_installments: 10,
          description: "",
          due_dates: Array(10).fill(null).map(() => ({ month: "", week: "", display: "" }))
        });
        
        // Refresh list
        await fetchSchedules();
      } else {
        setError(res.message || "Failed to create template");
      }
    } catch (err: any) {
      console.error('Create error:', err);
      setError(err.message || "Error creating schedule template");
    } finally {
      setLoading(false);
    }
  };

  const getScheduleColor = (type: string) => {
    const colors: Record<string, string> = {
      "Monthly": "from-blue-50 to-blue-100 border-blue-200",
      "Quarterly": "from-green-50 to-green-100 border-green-200",
      "Semestral": "from-purple-50 to-purple-100 border-purple-200",
      "Tri Semestral": "from-orange-50 to-orange-100 border-orange-200"
    };
    return colors[type] || "from-gray-50 to-gray-100 border-gray-200";
  };

  const getBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      "Monthly": "bg-blue-100 text-blue-800",
      "Quarterly": "bg-green-100 text-green-800",
      "Semestral": "bg-purple-100 text-purple-800",
      "Tri Semestral": "bg-orange-100 text-orange-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const formatDueDate = (dueDate: InstallmentDueDate): string => {
    return dueDate.display || "Not set";
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/payment-plans")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Installment Schedule Templates
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage payment schedule templates for different installment plans
            </p>
          </div>
          <Button 
            onClick={() => setIsCreateOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-cyan-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        {/* Alert Messages */}
        {error && <AlertMessage type="error" message={error} onClose={() => setError("")} />}
        {success && <AlertMessage type="success" message={success} onClose={() => setSuccess("")} />}

        {/* Info Card */}
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">About Schedule Templates</h3>
                <p className="text-sm text-blue-700">
                  Create reusable schedule templates that define due dates for each installment type. 
                  When creating a payment plan, these templates will automatically generate installments 
                  with the specified due dates throughout the academic year.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Templates Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
            <CardTitle className="text-xl">Schedule Templates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Loading schedules...</p>
                </div>
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium mb-2">No schedule templates yet</p>
                <p className="text-sm text-gray-400 mb-4">
                  Create your first schedule template to get started
                </p>
                <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                        Installments
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedules.map((schedule) => (
                      <tr key={schedule.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-foreground">{schedule.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={getBadgeColor(schedule.schedule_type)}>
                            {schedule.schedule_type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-foreground">{schedule.description}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20">
                            <span className="text-sm font-bold text-primary">{schedule.number_of_installments}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant={schedule.status === 'active' ? 'default' : 'secondary'}>
                            {schedule.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(schedule)}
                              title={schedule.status === 'active' ? 'Deactivate template' : 'Activate template'}
                            >
                              {schedule.status === 'active' ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(schedule)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(schedule)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Schedule Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-semibold">Create Schedule Template</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Define a new installment schedule with custom due dates
              </p>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Schedule Type *</Label>
                  <Select 
                    value={createForm.schedule_type} 
                    onValueChange={(v: any) => handleCreateFormChange("schedule_type", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly (10 installments)</SelectItem>
                      <SelectItem value="Quarterly">Quarterly (4 installments)</SelectItem>
                      <SelectItem value="Semestral">Semestral (2 installments)</SelectItem>
                      <SelectItem value="Tri Semestral">Tri Semestral (3 installments)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Number of Installments</Label>
                  <Input
                    type="number"
                    value={getInstallmentCount(createForm.schedule_type)}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-set based on schedule type
                  </p>
                </div>
              </div>

              <div>
                <Label>Template Name *</Label>
                <Input
                  placeholder="e.g., Standard Monthly Plan"
                  value={createForm.name}
                  onChange={(e) => handleCreateFormChange("name", e.target.value)}
                />
              </div>

              <div>
                <Label>Description *</Label>
                <Input
                  placeholder="e.g., Standard monthly payment plan for the academic year"
                  value={createForm.description}
                  onChange={(e) => handleCreateFormChange("description", e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-3 block">Installment Schedules *</Label>
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2 border rounded-lg p-4 bg-muted/20">
                  {createForm.due_dates.map((date, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/20 flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{index + 1}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Installment #{index + 1}
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs mb-1 block">Week</Label>
                            <Select
                              value={date.week}
                              onValueChange={(v) => handleCreateDueDateChange(index, 'week', v)}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Select week" />
                              </SelectTrigger>
                              <SelectContent>
                                {weekOptions.map((w) => (
                                  <SelectItem key={w.value} value={w.value}>
                                    {w.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {date.week !== "Upon Enrollment" && (
                            <div>
                              <Label className="text-xs mb-1 block">Month</Label>
                              <Select
                                value={date.month}
                                onValueChange={(v) => handleCreateDueDateChange(index, 'month', v)}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="Select month" />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        {date.display && (
                          <div className="text-xs text-primary font-medium mt-1">
                            📅 {date.display}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Configure each installment with week of month (e.g., "2nd week") for flexible scheduling
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} className="bg-gradient-to-r from-blue-600 to-cyan-500">
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Schedule Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-semibold">Edit Schedule Template</DialogTitle>
              {editingSchedule && (
                <div className="mt-2">
                  <Badge className={getBadgeColor(editingSchedule.schedule_type)}>
                    {editingSchedule.schedule_type}
                  </Badge>
                </div>
              )}
            </DialogHeader>
            {editingSchedule && (
              <div className="space-y-6 py-4">
                <div>
                  <Label>Template Name *</Label>
                  <Input
                    value={editingSchedule.name}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Description *</Label>
                  <Input
                    value={editingSchedule.description}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, description: e.target.value })}
                  />
                </div>

                <div>
                  <Label className="mb-3 block">Installment Schedules *</Label>
                  <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto pr-2 border rounded-lg p-4 bg-muted/20">
                    {editingSchedule.installments.map((date, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/20 flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{index + 1}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            Installment #{index + 1}
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs mb-1 block">Week</Label>
                              <Select
                                value={date.week}
                                onValueChange={(v) => handleEditDueDateChange(index, 'week', v)}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="Select week" />
                                </SelectTrigger>
                                <SelectContent>
                                  {weekOptions.map((w) => (
                                    <SelectItem key={w.value} value={w.value}>
                                      {w.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {date.week !== "Upon Enrollment" && (
                              <div>
                                <Label className="text-xs mb-1 block">Month</Label>
                                <Select
                                  value={date.month}
                                  onValueChange={(v) => handleEditDueDateChange(index, 'month', v)}
                                >
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select month" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {months.map((m) => (
                                      <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          {date.display && (
                            <div className="text-xs text-primary font-medium mt-1">
                              📅 {date.display}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Configure each installment with week of month (e.g., "2nd week") for flexible scheduling
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => { setIsEditOpen(false); setEditingSchedule(null); }}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
