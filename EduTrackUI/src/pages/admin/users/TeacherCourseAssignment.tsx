import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BookOpen, Loader2, Pencil } from "lucide-react";
import { AlertMessage } from "@/components/AlertMessage";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_ENDPOINTS, apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";

type Teacher = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  phone?: string;
  status: "active" | "inactive";
};

type Subject = {
  id: string;
  code: string;
  name: string;
  level: string;
  status: "active" | "inactive";
};

type TeacherSubjectAssignment = {
  id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  teacher_id: string;
};

type SubjectOccupancy = {
  subject_id: string;
  teacher_id: string;
  teacher_name: string;
};

const YEAR_LEVELS = ["Nursery 1", "Nursery 2", "Kinder", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];

const TeacherCourseAssignment = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { teacherId } = useParams<{ teacherId: string }>();

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignedYearLevel, setAssignedYearLevel] = useState<string>("");
  const [adviserAssignmentId, setAdviserAssignmentId] = useState<string | null>(null);
  const [originalAdvisoryLevel, setOriginalAdvisoryLevel] = useState<string>("");
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubjectAssignment[]>([]);
  const [occupiedSubjects, setOccupiedSubjects] = useState<SubjectOccupancy[]>([]);
  const [occupiedLevels, setOccupiedLevels] = useState<string[]>([]);
  const [schoolYears, setSchoolYears] = useState<string[]>([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>("");
  const [selectedSubjectTab, setSelectedSubjectTab] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isEditingAdvisory, setIsEditingAdvisory] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAdvisoryLevel, setPendingAdvisoryLevel] = useState<string>("");
  const [showChangeConfirmModal, setShowChangeConfirmModal] = useState(false);
  const [isChangingAdvisory, setIsChangingAdvisory] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeletingAdviser, setIsDeletingAdviser] = useState(false);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
  };

  // Convert year level to initials
  const getLevelInitials = (level: string): string => {
    if (level === "Kinder") return "K";
    if (level.startsWith("Nursery")) return `N${level.split(" ")[1]}`;
    if (level.startsWith("Grade")) return `G${level.split(" ")[1]}`;
    return level;
  };

  const fetchSchoolYears = async () => {
    try {
      const res = await apiGet("/api/academic-periods/school-years");
      if (res && res.success && Array.isArray(res.school_years)) {
        setSchoolYears(res.school_years);
        // Set default to current school year if available
        const currentYear = new Date().getFullYear();
        const currentSchoolYear = `${currentYear}-${currentYear + 1}`;
        const defaultYear = res.school_years.includes(currentSchoolYear) ? currentSchoolYear : res.school_years[0];
        setSelectedSchoolYear(defaultYear || "");
      }
    } catch (err) {
      console.error("Fetch school years error:", err);
      // Fallback to current year
      const currentYear = new Date().getFullYear();
      const currentSchoolYear = `${currentYear}-${currentYear + 1}`;
      setSchoolYears([currentSchoolYear]);
      setSelectedSchoolYear(currentSchoolYear);
    }
  };

  const fetchOccupiedLevels = async () => {
    if (!selectedSchoolYear) return;
    
    try {
      // Fetch all adviser assignments to see which levels are occupied
      const res = await apiGet(`/api/teachers/advisers?school_year=${selectedSchoolYear}`);
      
      if (res && res.success && Array.isArray(res.advisers)) {
        // Filter assignments for current school year and exclude current teacher
        const occupied = res.advisers
          .filter((a: any) => a.teacher_id !== parseInt(teacherId || "0"))
          .map((a: any) => a.level);
        
        setOccupiedLevels(occupied);
      }
    } catch (err) {
      console.error("Fetch occupied levels error:", err);
      // Don't show alert for this non-critical fetch
    }
  };

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
    } else if (teacherId) {
      fetchSchoolYears();
      fetchSubjects();
    }
  }, [isAuthenticated, user, navigate, teacherId]);

  // Refetch data when school year changes
  useEffect(() => {
    if (selectedSchoolYear && teacherId) {
      setIsEditingAdvisory(false); // Reset editing mode
      fetchTeacher();
      fetchTeacherSubjects();
      fetchOccupiedLevels();
      fetchOccupiedSubjects();
    }
  }, [selectedSchoolYear, teacherId]);

  // Set default subject tab to advisory level or first level when it changes
  useEffect(() => {
    if (assignedYearLevel) {
      setSelectedSubjectTab(assignedYearLevel);
    } else if (!selectedSubjectTab || selectedSubjectTab === "All") {
      setSelectedSubjectTab(YEAR_LEVELS[0]);
    }
  }, [assignedYearLevel]);

  // Get subjects filtered by selected tab
  const getFilteredSubjects = () => {
    return allSubjects.filter((s) => s.level === selectedSubjectTab);
  };

  const subjectsForLevel = getFilteredSubjects();

  const fetchTeacher = async () => {
    try {
      // Fetch basic teacher info
      const res = await apiGet(`${API_ENDPOINTS.TEACHERS}/${teacherId}`);
      if (res && res.success && res.teacher) {
        setTeacher({
          id: res.teacher.id.toString(),
          firstName: res.teacher.first_name,
          lastName: res.teacher.last_name,
          email: res.teacher.email,
          employeeId: res.teacher.employee_id,
          phone: res.teacher.phone,
          status: res.teacher.status,
        });
      } else {
        showAlert("error", "Failed to load teacher information");
        setTimeout(() => navigate("/admin/users/teachers"), 2000);
        return;
      }

      // Fetch adviser assignment only if school year is selected
      if (selectedSchoolYear) {
        const adviserRes = await apiGet(`/api/teachers/advisers?school_year=${selectedSchoolYear}`);
        if (adviserRes && adviserRes.success && Array.isArray(adviserRes.advisers)) {
          const assignment = adviserRes.advisers.find(
            (a: any) => a.teacher_id === parseInt(teacherId || "0")
          );
          if (assignment) {
            setAssignedYearLevel(assignment.level);
            setAdviserAssignmentId(assignment.id.toString());
            setOriginalAdvisoryLevel(assignment.level);
          } else {
            // Clear assignment if not found for selected school year
            setAssignedYearLevel("");
            setAdviserAssignmentId(null);
            setOriginalAdvisoryLevel("");
          }
        }
      }
    } catch (err: any) {
      console.error("Fetch teacher error:", err);
      showAlert("error", err.message || "Failed to load teacher");
      setTimeout(() => navigate("/admin/users/teachers"), 2000);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await apiGet(API_ENDPOINTS.SUBJECTS);
      const rows = (res && res.subjects) || (Array.isArray(res) ? res : res && res.rows ? res.rows : []);

      if (Array.isArray(rows)) {
        const mapped = rows.map((s: any) => ({
          id: s.id?.toString() || "",
          code: (s.code || "").toUpperCase(),
          name: s.name || "",
          level: s.level || "",
          status: s.status || "active",
        }));
        setAllSubjects(mapped);
      }
    } catch (err) {
      console.error("Fetch subjects error:", err);
      showAlert("error", "Failed to load subjects");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeacherSubjects = async () => {
    if (!selectedSchoolYear) return;
    
    try {
      const res = await apiGet(`/api/teachers/${teacherId}/subjects?school_year=${selectedSchoolYear}`);
      console.log("Teacher subjects response:", res);
      if (res && res.success && Array.isArray(res.subjects)) {
        const mapped = res.subjects.map((s: any) => ({
          id: s.id?.toString() || s.assignment_id?.toString() || "",
          subject_id: s.subject_id?.toString() || "",
          subject_code: s.subject_code || s.code || s.course_code || "",
          subject_name: s.subject_name || s.name || s.subject_name || "",
          teacher_id: s.teacher_id?.toString() || "",
        }));
        console.log("Mapped teacher subjects:", mapped);
        setTeacherSubjects(mapped);
      }
    } catch (err) {
      console.error("Fetch teacher subjects error:", err);
      // Don't show alert for this non-critical fetch
    }
  };

  const fetchOccupiedSubjects = async () => {
    if (!selectedSchoolYear) return;
    
    try {
      const res = await apiGet(`/api/teachers/assignments?school_year=${selectedSchoolYear}`);
      if (res && res.success && Array.isArray(res.assignments)) {
        // Filter out current teacher's assignments and map to occupancy data
        const occupancy: SubjectOccupancy[] = res.assignments
          .filter((a: any) => a.teacher_id !== parseInt(teacherId || "0"))
          .map((a: any) => ({
            subject_id: a.subject_id?.toString() || "",
            teacher_id: a.teacher_id?.toString() || "",
            teacher_name: `${a.first_name || ""} ${a.last_name || ""}`.trim() || "Unknown Teacher",
          }));
        setOccupiedSubjects(occupancy);
      }
    } catch (err) {
      console.error("Fetch occupied subjects error:", err);
      // Don't show alert for this non-critical fetch
    }
  };

  const handleEditAdvisory = () => {
    setIsEditingAdvisory(true);
  };

  const handleCancelEdit = () => {
    setIsEditingAdvisory(false);
    setPendingAdvisoryLevel("");
  };

  const handleDeleteAdviserClick = () => {
    setShowDeleteConfirmModal(true);
  };

  const handleAdvisoryChange = (value: string) => {
    // Prevent changing if already in the process of changing
    if (isChangingAdvisory) return;
    
    // Check if changing from early childhood level (N1, N2, K)
    const currentLevel = assignedYearLevel;
    const isEarlyChildhood = ["Nursery 1", "Nursery 2", "Kinder"].includes(currentLevel);
    
    if (isEarlyChildhood && currentLevel !== value) {
      // Show confirmation modal
      setPendingAdvisoryLevel(value);
      setShowConfirmModal(true);
    } else if (isEditingAdvisory && currentLevel && currentLevel !== value) {
      // If we are explicitly editing and switching between non-early-childhood levels,
      // show a simple confirmation (different from the early-childhood destructive modal).
      setPendingAdvisoryLevel(value);
      setShowChangeConfirmModal(true);
    } else {
      setAssignedYearLevel(value);
    }
  };

  const confirmChangeAdvisory = async () => {
    // Persist the advisory change immediately (acts as the update)
    setShowChangeConfirmModal(false);
    setIsChangingAdvisory(true);
    try {
      await saveYearLevelAssignment(pendingAdvisoryLevel);
      // saveYearLevelAssignment will update adviserAssignmentId, originalAdvisoryLevel and refresh data
      showAlert("success", "Advisory level updated");
    } catch (err) {
      console.error("Confirm change advisory save error:", err);
      showAlert("error", "Failed to update advisory level");
    } finally {
      setPendingAdvisoryLevel("");
      setIsChangingAdvisory(false);
      setIsEditingAdvisory(false);
    }
  };

  const confirmDeleteAdviser = async () => {
    setShowDeleteConfirmModal(false);
    if (!adviserAssignmentId) {
      showAlert("error", "No adviser assignment to delete");
      return;
    }

    setIsDeletingAdviser(true);
    try {
      // If early-childhood, remove subject assignments for that level first
      if (["Nursery 1", "Nursery 2", "Kinder"].includes(assignedYearLevel)) {
        const subjectsToRemove = teacherSubjects.filter(ts => {
          const subject = allSubjects.find(s => s.id === ts.subject_id);
          return subject?.level === assignedYearLevel;
        });

        for (const ts of subjectsToRemove) {
          try {
            await apiDelete(`/api/teachers/assignment`, {
              assignment_id: parseInt(ts.id),
              type: "subject"
            });
          } catch (err) {
            console.error("Error removing subject during adviser delete:", err);
          }
        }
      }

      // Delete adviser assignment
      await apiDelete(`/api/teachers/assignment`, {
        assignment_id: parseInt(adviserAssignmentId),
        type: "adviser"
      });

      // Clear local state and refresh
      setAssignedYearLevel("");
      setAdviserAssignmentId(null);
      setOriginalAdvisoryLevel("");
      setIsEditingAdvisory(false);

      await fetchTeacherSubjects();
      await fetchOccupiedLevels();
      await fetchTeacher();

      showAlert("success", "Adviser assignment deleted");
    } catch (err) {
      console.error("Failed to delete adviser:", err);
      showAlert("error", "Failed to delete adviser assignment");
    } finally {
      setIsDeletingAdviser(false);
    }
  };

  // Handle selection from the year-level Select control.
  // If the user is editing, defer to the advisory-change flow (which handles confirmations).
  // If not editing and the teacher has no existing adviser assignment, automatically save the new assignment.
  const handleYearLevelSelect = async (value: string) => {
    if (isChangingAdvisory || isSaving) return;

    if (isEditingAdvisory) {
      handleAdvisoryChange(value);
      return;
    }

    // Set the selected level immediately in UI
    setAssignedYearLevel(value);

    // If teacher has no existing adviser assignment (fresh assignment), auto-save
    if ((!adviserAssignmentId || adviserAssignmentId === null) && !originalAdvisoryLevel) {
      try {
        await saveYearLevelAssignment(value);
      } catch (err) {
        console.error("Auto-save advisory error:", err);
      }
    }
  };

  const confirmAdvisoryChange = async () => {
    setShowConfirmModal(false);
    setIsChangingAdvisory(true);
    
    try {
      const currentLevel = assignedYearLevel;
      
      // Step 1: Remove all subject assignments for early childhood levels
      if (["Nursery 1", "Nursery 2", "Kinder"].includes(currentLevel)) {
        const subjectsToRemove = teacherSubjects.filter(ts => {
          const subject = allSubjects.find(s => s.id === ts.subject_id);
          return subject?.level === currentLevel;
        });
        
        for (const ts of subjectsToRemove) {
          try {
            await apiDelete(`/api/teachers/assignment`, {
              assignment_id: parseInt(ts.id),
              type: "subject"
            });
          } catch (err) {
            console.error("Error removing subject:", err);
          }
        }
      }
      
      // Step 2: Remove the old advisory assignment
      if (adviserAssignmentId) {
        try {
          await apiDelete(`/api/teachers/assignment`, {
            assignment_id: parseInt(adviserAssignmentId),
            type: "adviser"
          });
        } catch (err) {
          console.error("Error removing adviser assignment:", err);
        }
      }
      
      // Step 3: Set the new pending level
      setAssignedYearLevel(pendingAdvisoryLevel);
      setAdviserAssignmentId(null); // Clear the old adviser ID
      setOriginalAdvisoryLevel("");
      setIsEditingAdvisory(false);
      setPendingAdvisoryLevel("");
      
      showAlert("success", "Advisory assignment changed. Previous assignments removed. Click 'Save' to confirm the new assignment.");
    } catch (err) {
      console.error("Error during advisory change:", err);
      showAlert("error", "Failed to change advisory assignment");
    } finally {
      setIsChangingAdvisory(false);
    }
  };

  const saveYearLevelAssignment = async (level?: string) => {
    const levelToSave = level || assignedYearLevel;
    if (!teacherId || !levelToSave || !teacher || !selectedSchoolYear) return;

    setIsSaving(true);
    try {
      if (adviserAssignmentId && originalAdvisoryLevel && levelToSave !== originalAdvisoryLevel) {
        await apiDelete(`/api/teachers/assignment`, {
          assignment_id: parseInt(adviserAssignmentId),
          type: "adviser"
        });
        setAdviserAssignmentId(null);
      }

      const payload = {
        teacher_id: parseInt(teacherId),
        level: levelToSave,
        school_year: selectedSchoolYear,
      };

      const res = await apiPost("/api/teachers/assign-adviser", payload);

      if (res && res.success) {
        showAlert("success", `${teacher.firstName} assigned as adviser for ${levelToSave}`);
        if (res.id) {
          setAdviserAssignmentId(res.id.toString());
        }
        setOriginalAdvisoryLevel(levelToSave);
        
        // Reset editing mode
        setIsEditingAdvisory(false);
        
        // Auto-assign all subjects for early childhood levels (Nursery 1, Nursery 2, Kinder)
        const earlyChildhoodLevels = ["Nursery 1", "Nursery 2", "Kinder"];
        if (earlyChildhoodLevels.includes(levelToSave)) {
          await autoAssignLevelSubjects(levelToSave);
        }
        
        // Refresh data
        await fetchTeacher();
        await fetchOccupiedLevels();
        await fetchTeacherSubjects();
      } else {
        showAlert("error", res?.error || res?.message || "Failed to save assignment");
      }
    } catch (err: any) {
      console.error("Save assignment error:", err);
      showAlert("error", err.message || "Failed to save assignment");
    } finally {
      setIsSaving(false);
    }
  };

  const autoAssignLevelSubjects = async (level: string) => {
    try {
      // Get all subjects for this level
      const levelSubjects = allSubjects.filter((s) => s.level === level && s.status === "active");
      
      if (levelSubjects.length === 0) {
        showAlert("info", `No active subjects found for ${level}`);
        return;
      }

      // Assign each subject to the teacher
      let successCount = 0;
      let failCount = 0;

      for (const subject of levelSubjects) {
        try {
          const payload = {
            teacher_id: parseInt(teacherId!),
            subject_id: parseInt(subject.id),
            school_year: selectedSchoolYear,
          };

          const res = await apiPost("/api/teachers/assign-subject", payload);
          if (res && res.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`Failed to assign subject ${subject.code}:`, err);
        }
      }

      if (successCount > 0) {
        showAlert("success", `Auto-assigned ${successCount} subject(s) for ${level}`);
      }
      if (failCount > 0) {
        showAlert("info", `${failCount} subject(s) were already assigned or failed to assign`);
      }
    } catch (err) {
      console.error("Auto-assign subjects error:", err);
    }
  };

  const assignSubjectToTeacher = async (subjectId: string) => {
    if (!teacherId || !selectedSchoolYear) return;

    try {
      const payload = {
        teacher_id: parseInt(teacherId),
        subject_id: parseInt(subjectId),
        school_year: selectedSchoolYear,
      };

      const res = await apiPost("/api/teachers/assign-subject", payload);

      if (res && res.success) {
        showAlert("success", "Subject assigned successfully");
        await fetchTeacherSubjects();
        await fetchOccupiedSubjects();
      } else {
        showAlert("error", res?.error || res?.message || "Failed to assign subject");
      }
    } catch (err: any) {
      console.error("Assign subject error:", err);
      showAlert("error", err.message || "Failed to assign subject");
    }
  };

  const removeSubjectAssignment = async (assignmentId: string) => {
    try {
      const res = await apiDelete(`/api/teachers/assignment`, {
        assignment_id: parseInt(assignmentId),
        type: "subject"
      });

      if (res && res.success) {
        showAlert("success", "Subject assignment removed");
        await fetchTeacherSubjects();
        await fetchOccupiedSubjects();
      } else {
        showAlert("error", res?.error || res?.message || "Failed to remove assignment");
      }
    } catch (err: any) {
      console.error("Remove subject error:", err);
      showAlert("error", err.message || "Failed to remove assignment");
    }
  };

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">Loading teacher information...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!teacher) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground">Teacher not found</p>
            <Button onClick={() => navigate("/admin/users/teachers")} className="mt-4">
              Back to Teachers
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/users/teachers")} className="hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Manage Teacher Assignment
            </h1>
            <p className="text-muted-foreground">
              {teacher.firstName} {teacher.lastName} ({teacher.employeeId})
            </p>
          </div>
        </div>

        {/* School Year Selection */}
        <Card className="shadow-lg border-0 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Label htmlFor="school-year" className="font-semibold text-base">
                School Year:
              </Label>
              <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                <SelectTrigger className="w-48 border-2 rounded-lg">
                  <SelectValue placeholder="Select school year..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Year Level Assignment */}
        <Card className="shadow-lg border-0 mb-6">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Advisory Assignment</CardTitle>
                <CardDescription>Assign this teacher as an adviser (homeroom teacher) for one grade level</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/admin/users/teachers")}>
                  Back
                </Button>
                {(!assignedYearLevel || isEditingAdvisory) && (
                  <Button
                    onClick={saveYearLevelAssignment}
                    disabled={isSaving || !assignedYearLevel || isChangingAdvisory}
                    className="bg-gradient-to-r from-primary to-accent text-white"
                  >
                    {isSaving || isChangingAdvisory ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isChangingAdvisory ? "Processing..." : "Saving..."}
                      </>
                    ) : (
                      <>
                        Save {["Nursery 1", "Nursery 2", "Kinder"].includes(assignedYearLevel) ? "& Auto-Assign Subjects" : "Assignment"}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Visual indicator if already assigned */}
              {assignedYearLevel && !isEditingAdvisory && (
                <div className="mb-4 p-4 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400 rounded-lg shadow-md ring-2 ring-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">✓</span>
                        <span className="font-bold text-green-900 text-lg">Currently Assigned as Adviser</span>
                      </div>
                      <p className="text-green-700 font-semibold text-xl">
                        {assignedYearLevel}
                      </p>
                      <p className="text-xs text-green-600 mt-1">School Year: {selectedSchoolYear}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditAdvisory}
                      className="flex items-center gap-2 border-green-600 text-green-700 hover:bg-green-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              )}
              
              {(!assignedYearLevel || isEditingAdvisory) && (
              <div>
                <Label htmlFor="year-level" className="font-semibold text-base mb-3 block">
                  Select Advisory Level (Homeroom Class) *
                </Label>
                {occupiedLevels.length === YEAR_LEVELS.length && !assignedYearLevel ? (
                  <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                    <p className="text-red-800 font-semibold text-center">
                      ⚠️ No year level available - all levels are currently occupied
                    </p>
                  </div>
                ) : (
                  <>
                    <Select 
                      value={assignedYearLevel} 
                      onValueChange={handleYearLevelSelect}
                      disabled={(!isEditingAdvisory && !!assignedYearLevel) || isChangingAdvisory}
                    >
                      <SelectTrigger className={`w-full max-w-sm h-11 border-2 rounded-lg ${!isEditingAdvisory && assignedYearLevel ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <SelectValue placeholder="Choose a year level..." />
                      </SelectTrigger>
                      <SelectContent>
                        {YEAR_LEVELS.map((level) => {
                          const isOccupied = occupiedLevels.includes(level) && level !== assignedYearLevel;
                          return (
                            <SelectItem key={level} value={level} disabled={isOccupied}>
                              <span className={isOccupied ? "text-muted-foreground line-through" : ""}>
                                {level}
                              </span>
                              {isOccupied && <span className="ml-2 text-xs text-red-500">(Occupied)</span>}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {isEditingAdvisory && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleDeleteAdviserClick} disabled={!adviserAssignmentId || isDeletingAdviser}>
                          {isDeletingAdviser ? "Deleting..." : "Delete Assignment"}
                        </Button>
                      </div>
                    )}
                    {!assignedYearLevel && occupiedLevels.length > 0 && (
                      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-xs font-semibold text-orange-900 mb-1">Occupied Year Levels:</p>
                        <div className="flex flex-wrap gap-2">
                          {occupiedLevels.map((level) => (
                            <span key={level} className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                              {level}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {assignedYearLevel && ["Nursery 1", "Nursery 2", "Kinder"].includes(assignedYearLevel) && (!adviserAssignmentId || isEditingAdvisory) && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <span className="font-semibold">ℹ️ Note:</span> Teachers assigned to {assignedYearLevel} will automatically be assigned to all subjects for this level when you click "Save Assignment".
                    </p>
                  </div>
                )}
              </div>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Subject Teacher Assignments */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-muted border-b pb-4">
            <div>
              <CardTitle>Subject Teacher Assignments</CardTitle>
              <CardDescription>Assign this teacher to teach specific subjects (can be across multiple grade levels)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Assigned Subjects Summary */}
            <div className="p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-green-900 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                  Currently Assigned Subjects
                </h4>
                <span className="text-sm font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">
                  {teacherSubjects.length} {teacherSubjects.length === 1 ? "Subject" : "Subjects"}
                </span>
              </div>
              {teacherSubjects.length === 0 ? (
                <p className="text-sm text-green-700 italic">No subjects assigned yet. Assign subjects from the tabs below.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-3">
                  {teacherSubjects.map((ts) => {
                    const subject = allSubjects.find((s) => s.id === ts.subject_id);
                    return (
                      <div
                        key={ts.id}
                        className="inline-flex items-center gap-2 bg-white text-green-800 px-3 py-1.5 rounded-lg border-2 border-green-300 shadow-sm"
                      >
                        <span className="font-bold">{subject?.code || ts.subject_code}</span>
                        <span className="text-xs text-green-600 font-medium">• {subject?.level || "Unknown"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Year Level Tabs */}
            <div className="border-b bg-muted/30">
              <div className="flex overflow-x-auto">
                {YEAR_LEVELS.map((level) => {
                  const subjectCount = allSubjects.filter((s) => s.level === level && s.status === "active").length;
                  
                  // Calculate general occupancy (across all teachers) for color coding
                  const levelSubjects = allSubjects.filter((s) => s.level === level && s.status === "active");
                  const occupiedInLevel = levelSubjects.filter((subject) => 
                    // Include both: subjects occupied by other teachers OR assigned to current teacher
                    occupiedSubjects.some((os) => os.subject_id === subject.id) ||
                    teacherSubjects.some((ts) => ts.subject_id === subject.id)
                  ).length;
                  
                  // Teacher's own assignments for this level
                  const myAssignedCount = teacherSubjects.filter((ts) => {
                    const subject = allSubjects.find((s) => s.id === ts.subject_id);
                    return subject?.level === level;
                  }).length;
                  const isAdvisoryLevel = level === assignedYearLevel;
                  
                  // Calculate occupancy percentage (includes all teachers and self)
                  const percentage = subjectCount > 0 ? Math.round((occupiedInLevel / subjectCount) * 100) : 0;
                  
                  // Determine color based on general occupancy percentage
                  let tabBgColor = "bg-gray-100"; // Default for 0% or no subjects
                  let tabBorderColor = "border-transparent";
                  
                  if (percentage > 0 && percentage <= 20) {
                    // Low occupancy (red) - needs attention
                    tabBgColor = "bg-red-200";
                    tabBorderColor = selectedSubjectTab === level ? "border-red-500" : "border-transparent";
                  } else if (percentage >= 21 && percentage <= 69) {
                    // Medium occupancy (yellow/orange) - in progress
                    tabBgColor = "bg-yellow-200";
                    tabBorderColor = selectedSubjectTab === level ? "border-yellow-500" : "border-transparent";
                  } else if (percentage >= 70 && percentage < 100) {
                    // High occupancy (blue) - well staffed but not full
                    tabBgColor = "bg-blue-200";
                    tabBorderColor = selectedSubjectTab === level ? "border-blue-500" : "border-transparent";
                  } else if (percentage === 100) {
                    // Fully staffed (green)
                    tabBgColor = "bg-green-200";
                    tabBorderColor = selectedSubjectTab === level ? "border-green-500" : "border-transparent";
                  }
                  
                  if (selectedSubjectTab !== level) {
                    tabBorderColor = "border-transparent";
                  }

                  return (
                    <button
                      key={level}
                      onClick={() => setSelectedSubjectTab(level)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative ${tabBgColor} ${tabBorderColor} ${
                        selectedSubjectTab === level
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground hover:brightness-95"
                      }`}
                      title={`${level} - ${percentage}% occupied overall (${occupiedInLevel}/${subjectCount} subjects)${myAssignedCount > 0 ? ` | You: ${myAssignedCount} subject${myAssignedCount > 1 ? 's' : ''}` : ''}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{getLevelInitials(level)}</span>
                        {isAdvisoryLevel && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-800 rounded font-semibold">
                            Advisory
                          </span>
                        )}
                        {myAssignedCount > 0 && (
                          <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded font-medium">
                            {myAssignedCount}/{subjectCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subjects Grid */}
            <div className="p-6">
              {subjectsForLevel.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">
                    No subjects found for {selectedSubjectTab}
                  </p>
                  <p className="text-sm mt-2">Create subjects in the Subjects management page</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subjectsForLevel.map((subject) => {
                    const isAssigned = teacherSubjects.some((ts) => ts.subject_id === subject.id);
                    const assignment = teacherSubjects.find((ts) => ts.subject_id === subject.id);
                    const occupiedBy = occupiedSubjects.find((os) => os.subject_id === subject.id);
                    const isOccupied = !!occupiedBy;
                    const isFixedEarlyChildhoodAssignment =
                      isAssigned &&
                      ["Nursery 1", "Nursery 2", "Kinder"].includes(assignedYearLevel) &&
                      subject.level === assignedYearLevel;
                    
                    return (
                      <div
                        key={subject.id}
                        className={`relative p-4 border-2 rounded-lg transition-all ${
                          subject.status === "active"
                            ? isAssigned
                              ? "bg-gradient-to-br from-green-50 to-green-100 border-green-400 shadow-lg ring-2 ring-green-200"
                              : isOccupied
                              ? "bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300 opacity-75"
                              : "bg-gradient-to-br from-card to-muted/30 border-accent-200 hover:border-accent-400 hover:shadow-md"
                            : "bg-muted/50 border-muted opacity-70"
                        }`}
                      >
                        {isAssigned && (
                          <div className="absolute -top-2 -right-2 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                            <span className="text-xs font-bold">✓</span>
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className={`font-bold text-lg ${isAssigned ? "text-green-900" : ""}`}>{subject.code}</p>
                            <p className={`text-sm ${isAssigned ? "text-green-700" : "text-muted-foreground"}`}>{subject.name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={subject.status === "active" ? "default" : "outline"}>
                              {subject.status}
                            </Badge>
                            {isAssigned && (
                              <Badge className="bg-green-600 text-white border-green-700 font-semibold shadow-md">
                                ✓ Assigned to You
                              </Badge>
                            )}
                            {isOccupied && !isAssigned && (
                              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                                Occupied
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className={`text-xs mt-3 pt-3 border-t ${isAssigned ? "border-green-200 text-green-800" : "text-muted-foreground"}`}>
                          Level: <span className="font-medium">{subject.level}</span>
                          {isOccupied && !isAssigned && (
                            <div className="mt-1 text-orange-700">
                              Assigned to: <span className="font-semibold">{occupiedBy.teacher_name}</span>
                            </div>
                          )}
                          {isAssigned && (
                            <div className="mt-1 text-green-700 font-medium">
                              ✓ You are teaching this subject
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex justify-end">
                          {isAssigned && assignment ? (
                            isFixedEarlyChildhoodAssignment ? (
                              <Button size="sm" variant="outline" disabled>
                                Fixed Assignment
                              </Button>
                            ) : (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeSubjectAssignment(assignment.id)}
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                            >
                              ✕ Remove Assignment
                            </Button>
                            )
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => assignSubjectToTeacher(subject.id)}
                              disabled={subject.status !== "active" || isOccupied}
                            >
                              {isOccupied ? "Occupied" : "Assign"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Modal for Advisory Change */}
        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-600">⚠️ Confirm Advisory Change</DialogTitle>
              <DialogDescription className="space-y-3 pt-2">
                <p className="text-base font-semibold">
                  You are changing advisory from <span className="text-blue-600">{assignedYearLevel}</span> to <span className="text-blue-600">{pendingAdvisoryLevel}</span>.
                </p>
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <p className="text-red-900 font-semibold mb-2">⚠️ Warning: This will:</p>
                  <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                    <li>Remove your current advisory assignment for <strong>{assignedYearLevel}</strong></li>
                    <li><strong>Delete all your subject assignments</strong> for {assignedYearLevel}</li>
                    <li>Assign you as adviser for <strong>{pendingAdvisoryLevel}</strong> instead</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  This action is necessary because early childhood teachers (Nursery 1, Nursery 2, Kinder) are automatically assigned to all subjects for their advisory level.
                </p>
                <p className="text-sm font-semibold">Are you sure you want to continue?</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmAdvisoryChange}>
                Yes, Change Advisory & Delete Subjects
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Simple confirmation for non-early-childhood advisory changes while editing */}
        <Dialog open={showChangeConfirmModal} onOpenChange={setShowChangeConfirmModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Confirm Advisory Change</DialogTitle>
              <DialogDescription className="space-y-3 pt-2">
                <p className="text-base font-semibold">
                  Are you sure you want to change advisory from <span className="text-blue-600">{assignedYearLevel}</span> to <span className="text-blue-600">{pendingAdvisoryLevel}</span>?
                </p>
                <p className="text-sm text-muted-foreground">This will update the advisory level. Click Save to persist the change.</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowChangeConfirmModal(false)}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={confirmChangeAdvisory}>
                Yes, Change Advisory
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation for adviser assignment */}
        <Dialog open={showDeleteConfirmModal} onOpenChange={setShowDeleteConfirmModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-600">Delete Adviser Assignment</DialogTitle>
              <DialogDescription className="space-y-3 pt-2">
                <p className="text-base font-semibold">Are you sure you want to remove the adviser assignment for <span className="text-blue-600">{assignedYearLevel}</span>?</p>
                <p className="text-sm text-muted-foreground">This will unassign the teacher as adviser{assignedYearLevel && ["Nursery 1","Nursery 2","Kinder"].includes(assignedYearLevel) ? " and remove their subject assignments for this level" : ""}.</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirmModal(false)} disabled={isDeletingAdviser}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteAdviser} disabled={isDeletingAdviser}>
                {isDeletingAdviser ? "Deleting..." : "Yes, Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      </div>
    </DashboardLayout>
  );
};

export default TeacherCourseAssignment;
