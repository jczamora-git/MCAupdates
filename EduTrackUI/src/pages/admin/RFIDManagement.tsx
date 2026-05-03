import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { IdCard, Search, RefreshCw } from "lucide-react";

interface StudentItem {
  id: number;
  student_id: string;
  rfid_card?: string | null;
  year_level?: string;
  section_id?: number | null;
  first_name: string;
  last_name: string;
}

interface RfidCheckStudent {
  student_id?: number | string;
  student_number?: string;
  full_name?: string;
  year_level?: string;
  section?: string;
  rfid_card?: string;
  status?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email?: string;
}

interface RfidCheckResult {
  found: boolean;
  assigned: boolean;
  message?: string;
  student?: RfidCheckStudent | null;
}

const RFIDManagement = () => {
  const { toast } = useToast();
  const [rfidCode, setRfidCode] = useState("");
  const [selectedRfidCode, setSelectedRfidCode] = useState<string | null>(null);
  const [rfidResult, setRfidResult] = useState<RfidCheckResult | null>(null);
  const [actionMode, setActionMode] = useState<null | "assign" | "reassign" | "replace">(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadStudents = async (query = "") => {
    setIsLoading(true);
    try {
      const url = API_ENDPOINTS.STUDENTS_ACTIVE + (query ? `?search=${encodeURIComponent(query)}` : "");
      const response = await apiGet(url);
      setStudents(Array.isArray(response?.data) ? response.data : []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load students.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resolveRfidResult = (response: any): RfidCheckResult => {
    const found = typeof response?.found === "boolean"
      ? response.found
      : typeof response?.assigned === "boolean"
        ? response.assigned
        : !!response?.data || !!response?.student;
    const student = response?.data || response?.student || null;

    return {
      found,
      assigned: found,
      message: response?.message,
      student,
    };
  };

  const fetchRfidStatus = async (code: string, options?: { clearInput?: boolean }) => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast({
        title: "Missing RFID",
        description: "Scan or type an RFID card first.",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    try {
      const response = await apiGet(
        `${API_ENDPOINTS.RFID_CARD_CHECK}?rfid_code=${encodeURIComponent(trimmed)}`
      );
      const result = resolveRfidResult(response);
      setSelectedRfidCode(trimmed);
      setRfidResult(result);
      setActionMode(null);
      if (options?.clearInput !== false) {
        setRfidCode("");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to check RFID card.",
        variant: "destructive",
      });
      setRfidResult(null);
    } finally {
      setIsChecking(false);
    }
  };

  const checkRfid = async () => {
    await fetchRfidStatus(rfidCode, { clearInput: true });
  };

  const selectActionMode = (mode: "assign" | "reassign" | "replace") => {
    if (!selectedRfidCode || !rfidResult) {
      toast({
        title: "Missing RFID",
        description: "Scan an RFID card first.",
        variant: "destructive",
      });
      return;
    }

    if (rfidResult.found) {
      if (mode !== "reassign") {
        toast({
          title: "RFID already assigned",
          description: "Use Reassign for an already used RFID.",
          variant: "destructive",
        });
        return;
      }
    } else if (mode === "reassign") {
      toast({
        title: "RFID available",
        description: "Use Assign or Replace for an unassigned RFID card.",
        variant: "destructive",
      });
      return;
    }

    setActionMode(mode);
  };

  const handleAssign = async (student: StudentItem) => {
    if (!actionMode) {
      toast({
        title: "Select an action",
        description: "Choose Assign, Reassign, or Replace from the RFID result panel.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedRfidCode) {
      toast({
        title: "Missing RFID",
        description: "Scan an RFID card first.",
        variant: "destructive",
      });
      return;
    }

    if (actionMode === "assign" && rfidResult?.found) {
      toast({
        title: "RFID already assigned",
        description: "Use Reassign for an already used RFID.",
        variant: "destructive",
      });
      return;
    }

    if (actionMode === "reassign" && !rfidResult?.found) {
      toast({
        title: "RFID not assigned",
        description: "Use Assign or Replace for an available RFID card.",
        variant: "destructive",
      });
      return;
    }

    if (actionMode === "replace" && rfidResult?.found) {
      toast({
        title: "RFID already assigned",
        description: "Replace requires an available RFID card.",
        variant: "destructive",
      });
      return;
    }

    if (actionMode === "assign" && student.rfid_card) {
      toast({
        title: "Student already has RFID",
        description: "Use Replace mode to swap the student RFID.",
        variant: "destructive",
      });
      return;
    }

    if (actionMode === "replace" && !student.rfid_card) {
      toast({
        title: "No RFID to replace",
        description: "This student has no RFID. Use Assign instead.",
        variant: "destructive",
      });
      return;
    }

    if (actionMode === "reassign" && rfidResult?.student?.student_id) {
      const assignedId = Number(rfidResult.student.student_id);
      if (!Number.isNaN(assignedId) && assignedId === student.id) {
        toast({
          title: "Already assigned",
          description: "This RFID already belongs to the selected student.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await apiPost(API_ENDPOINTS.STUDENT_ASSIGN_RFID(student.id), {
        rfid_code: selectedRfidCode,
        replace_existing: actionMode === "reassign",
        mode: actionMode,
      });

      toast({
        title: "RFID updated",
        description: "RFID card updated for the selected student.",
      });

      await loadStudents(search.trim());
      await fetchRfidStatus(selectedRfidCode, { clearInput: false });
      setActionMode(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to update RFID card.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    loadStudents();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const isInteractiveElement = (element: Element | null) => {
      if (!element) return false;
      const tag = element.tagName.toLowerCase();
      return ["input", "button", "select", "textarea", "a"].includes(tag);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (active !== inputRef.current && event.key !== "Tab" && !isInteractiveElement(active)) {
        inputRef.current?.focus();
      }
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Enter" && rfidCode.trim()) {
        event.preventDefault();
        checkRfid();
      }
    };

    const handleBlur = () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          inputRef.current?.focus();
        }
      }, 50);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keypress", handleKeyPress);
    if (inputRef.current) {
      inputRef.current.addEventListener("blur", handleBlur);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keypress", handleKeyPress);
      if (inputRef.current) {
        inputRef.current.removeEventListener("blur", handleBlur);
      }
    };
  }, [rfidCode]);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadStudents(search.trim());
    }, 350);

    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    const focusInterval = setInterval(() => {
      const active = document.activeElement;
      if (active !== inputRef.current && (!active || active === document.body)) {
        inputRef.current?.focus();
      }
    }, 500);

    return () => clearInterval(focusInterval);
  }, []);

  const assignedStudent = rfidResult?.student;
  const assignedName = assignedStudent
    ? (assignedStudent.full_name
        || [assignedStudent.first_name, assignedStudent.middle_name, assignedStudent.last_name]
          .filter(Boolean)
          .join(" "))
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center shadow-lg flex-shrink-0">
            <IdCard className="h-6 sm:h-8 w-6 sm:w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-1 sm:mb-2">
              RFID Management
            </h1>
            <p className="text-muted-foreground text-xs sm:text-base">
              Assign or renew RFID cards for active students.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IdCard className="h-5 w-5" />
                Scan RFID Card
              </CardTitle>
              <CardDescription>
                Scan or type an RFID card to check its status.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label>RFID Code</Label>
                  <Input
                    ref={inputRef}
                    value={rfidCode}
                    onChange={(event) => setRfidCode(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        checkRfid();
                      }
                    }}
                    placeholder="Tap RFID card..."
                    className="text-center text-lg font-mono bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 focus:border-purple-600"
                  />
                </div>
                <Button onClick={checkRfid} disabled={isChecking || !rfidCode.trim()}>
                  {isChecking ? "Checking" : "Check"}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Press Enter after scanning to load the RFID status.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>RFID Result</CardTitle>
              <CardDescription>Live RFID status and next actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedRfidCode || !rfidResult ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Scan or type an RFID card to view its status.
                </div>
              ) : rfidResult.found ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">RFID Already Assigned</p>
                    <Badge className="bg-amber-100 text-amber-700">Assigned</Badge>
                    <p className="text-sm text-muted-foreground">
                      RFID Code: <span className="font-mono font-semibold">{selectedRfidCode}</span>
                    </p>
                    {assignedName && (
                      <p className="text-sm">
                        Assigned to: <span className="font-semibold">{assignedName}</span>
                      </p>
                    )}
                    {assignedStudent?.student_number && (
                      <p className="text-xs text-muted-foreground">
                        Student ID: {assignedStudent.student_number}
                      </p>
                    )}
                    {(assignedStudent?.year_level || assignedStudent?.section) && (
                      <p className="text-xs text-muted-foreground">
                        {assignedStudent.year_level || ""} {assignedStudent.section || ""}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Use Reassign only if this RFID was assigned to the wrong student.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={actionMode === "reassign" ? "default" : "outline"}
                      onClick={() => selectActionMode("reassign")}
                    >
                      Reassign RFID
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">RFID Available</p>
                    <Badge className="bg-emerald-100 text-emerald-700">Available</Badge>
                    <p className="text-sm text-muted-foreground">
                      RFID Code: <span className="font-mono font-semibold">{selectedRfidCode}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This RFID card is available for assignment.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Use Assign for students with no RFID. Use Replace when a student lost or damaged their old card.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={actionMode === "assign" ? "default" : "outline"}
                      onClick={() => selectActionMode("assign")}
                    >
                      Assign to Student
                    </Button>
                    <Button
                      variant={actionMode === "replace" ? "default" : "outline"}
                      onClick={() => selectActionMode("replace")}
                    >
                      Replace Student RFID
                    </Button>
                  </div>
                </div>
              )}
              {actionMode && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Action mode active: <span className="font-semibold">{actionMode}</span>. Select a student below.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Active Students
            </CardTitle>
            <CardDescription>
              Search by name or MCAF ID (student ID). Only active students are listed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {actionMode && (
              <div className="rounded-lg border border-dashed border-border p-3 text-sm">
                {actionMode === "assign" && "Assign mode active: select a student with no RFID."}
                {actionMode === "reassign" && "Reassign mode active: choose the correct student owner."}
                {actionMode === "replace" && "Replace mode active: choose the student whose card will be replaced."}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or MCAF ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => loadStudents(search.trim())}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading students...</div>
            ) : students.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active students found.</div>
            ) : (
              <div className="space-y-2">
                {students.map((student) => {
                  const assignedOwnerId = assignedStudent?.student_id ? Number(assignedStudent.student_id) : NaN;
                  const isCurrentOwner = !Number.isNaN(assignedOwnerId) && assignedOwnerId === student.id;
                  const hasRfid = !!student.rfid_card;
                  const actionLabel = actionMode === "assign"
                    ? "Assign RFID"
                    : actionMode === "reassign"
                      ? "Reassign Here"
                      : "Replace RFID";
                  const actionHint = actionMode === "assign" && hasRfid
                    ? "Student already has an RFID. Use Replace instead."
                    : actionMode === "replace" && !hasRfid
                      ? "Student has no RFID to replace. Use Assign instead."
                      : actionMode === "reassign" && isCurrentOwner
                        ? "Already assigned to this student."
                        : undefined;
                  const isActionDisabled =
                    !actionMode
                    || !selectedRfidCode
                    || isSubmitting
                    || (actionMode === "assign" && rfidResult?.found)
                    || (actionMode === "assign" && hasRfid)
                    || (actionMode === "replace" && rfidResult?.found)
                    || (actionMode === "replace" && !hasRfid)
                    || (actionMode === "reassign" && !rfidResult?.found)
                    || (actionMode === "reassign" && isCurrentOwner);

                  return (
                    <div key={student.id} className="rounded-lg border border-border p-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          MCAF ID: {student.student_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={student.rfid_card ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}>
                          {student.rfid_card ? `RFID: ${student.rfid_card}` : "No RFID"}
                        </Badge>
                        {actionMode && (
                          <Button
                            size="sm"
                            disabled={isActionDisabled}
                            onClick={() => handleAssign(student)}
                            title={actionHint}
                          >
                            {isCurrentOwner && actionMode === "reassign" ? "Current Owner" : actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </DashboardLayout>
  );
};

export default RFIDManagement;
