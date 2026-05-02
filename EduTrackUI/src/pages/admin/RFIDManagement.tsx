import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface RfidCheckResult {
  assigned: boolean;
  student?: StudentItem | null;
}

const RFIDManagement = () => {
  const { toast } = useToast();
  const [rfidCode, setRfidCode] = useState("");
  const [lastCheckedCode, setLastCheckedCode] = useState("");
  const [rfidResult, setRfidResult] = useState<RfidCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showRenewList, setShowRenewList] = useState(false);
  const [renewMode, setRenewMode] = useState(false);
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

  const checkRfid = async () => {
    const code = rfidCode.trim();
    if (!code) return;

    setIsChecking(true);
    try {
      const response = await apiGet(
        `${API_ENDPOINTS.RFID_CARD_CHECK}?rfid_code=${encodeURIComponent(code)}`
      );
      const assigned = !!response?.assigned;
      if (renewMode && assigned) {
        toast({
          title: "RFID already assigned",
          description: "Renew mode requires an unassigned RFID card.",
          variant: "destructive",
        });
        setRfidResult({ assigned, student: response?.student ?? null });
        setLastCheckedCode("");
        setRfidCode("");
        setShowResultModal(true);
        setShowRenewList(false);
        return;
      }
      setRfidResult({ assigned, student: response?.student ?? null });
      setLastCheckedCode(code);
      setRfidCode("");
      setShowResultModal(true);
      setShowRenewList(renewMode || false);
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

  const handleAssign = async (studentId: number) => {
    const code = lastCheckedCode.trim();
    if (!code) {
      toast({
        title: "Missing RFID",
        description: "Scan an RFID card first.",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiPost(API_ENDPOINTS.STUDENT_ASSIGN_RFID(studentId), {
        rfid_code: code,
        replace_existing: replaceExisting,
      });

      toast({
        title: "RFID assigned",
        description: "RFID card saved for this student.",
      });

      await loadStudents(search.trim());
      await checkRfid();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to assign RFID card.",
        variant: "destructive",
      });
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
    ? `${assignedStudent.first_name} ${assignedStudent.last_name}`
    : null;
  const shouldShowStudents = renewMode ? showRenewList : !rfidResult?.assigned || showRenewList;

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IdCard className="h-5 w-5" />
              Scan RFID Card
            </CardTitle>
            <CardDescription>
              Scan the RFID card to check if it is already assigned.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={renewMode}
                onChange={(event) => {
                  setRenewMode(event.target.checked);
                  setShowRenewList(false);
                  setRfidResult(null);
                  setLastCheckedCode("");
                }}
              />
              Renew student RFID (scan new unassigned card)
            </label>
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
                  placeholder={renewMode ? "Tap new unassigned RFID card..." : "Tap RFID card..."}
                  className="text-center text-lg font-mono bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 focus:border-purple-600"
                />
              </div>
              <Button onClick={checkRfid} disabled={isChecking || !rfidCode.trim()}>
                {isChecking ? "Checking" : "Check"}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Scan a card to check its status. Results appear in a modal.
            </p>

            {!renewMode && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                />
                Replace existing assignment if the card is already used
              </label>
            )}
          </CardContent>
        </Card>

        {shouldShowStudents && (
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
                {students.map((student) => (
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
                      <Button size="sm" onClick={() => handleAssign(student.id)}>
                        Assign RFID
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>RFID Check Result</DialogTitle>
            <DialogDescription>Review the RFID status before assigning.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {rfidResult ? (
              <>
                <Badge className={rfidResult.assigned ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                  {rfidResult.assigned ? "Assigned" : "Available"}
                </Badge>
                {lastCheckedCode && (
                  <p>
                    RFID Code: <span className="font-mono font-semibold">{lastCheckedCode}</span>
                  </p>
                )}
                {rfidResult.assigned && assignedName ? (
                  <p>
                    Assigned to: <span className="font-semibold">{assignedName}</span>
                    {assignedStudent?.student_id ? ` (${assignedStudent.student_id})` : ""}
                  </p>
                ) : (
                  <p>This RFID card is available for assignment.</p>
                )}
                {rfidResult.assigned && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRenewList(true);
                      setShowResultModal(false);
                      setReplaceExisting(true);
                    }}
                  >
                    Renew card
                  </Button>
                )}
                {!rfidResult.assigned && renewMode && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRenewList(true);
                      setShowResultModal(false);
                    }}
                  >
                    Choose student
                  </Button>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No RFID result yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default RFIDManagement;
