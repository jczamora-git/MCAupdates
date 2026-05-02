import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_ENDPOINTS, apiGet, apiPost } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Radio,
  Wifi,
  WifiOff,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  RefreshCw,
  Camera,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: number;
  student_id: string;
  first_name: string;
  last_name: string;
  rfid_card?: string;
  email: string;
  grade_level: string;
  section?: string;
}

interface RFIDScan {
  id: number;
  rfid_code: string;
  student_id?: number;
  student_name?: string;
  scan_time: string;
  type: "entry" | "exit";
  status: "success" | "unknown" | "error";
  is_late?: number | boolean;
  image_path?: string | null;
  session_id?: number | null;
  notes?: string;
}

interface RFIDSession {
  id: number;
  label: string;
  session_type: "entry" | "exit";
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  status: "scheduled" | "active" | "closed";
}

const RFIDAttendance = () => {
  const [rfidInput, setRfidInput] = useState("");
  const [scanType, setScanType] = useState<"entry" | "exit">("entry");
  const [isScanning, setIsScanning] = useState(false);
  const [currentScan, setCurrentScan] = useState<RFIDScan | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "entry" | "exit">("all");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sessionLabel, setSessionLabel] = useState("");
  const [sessionType, setSessionType] = useState<"entry" | "exit">("entry");
  const [sessionStart, setSessionStart] = useState("");
  const [sessionEnd, setSessionEnd] = useState("");
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [passkey, setPasskey] = useState("");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rfidRetryCounts, setRfidRetryCounts] = useState<Record<string, number>>({});
  const [blockedRfids, setBlockedRfids] = useState<Record<string, boolean>>({});
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const { toast: showToast } = useToast();
  const navigate = useNavigate();

  // Fetch students with RFID cards
  const { data: students = [] } = useQuery({
    queryKey: ["students-rfid"],
    queryFn: async () => {
      try {
        const response = await apiGet(API_ENDPOINTS.USERS.STUDENTS.GET);
        return response.data as Student[];
      } catch (error) {
        console.warn("Could not fetch students from API", error);
        return [] as Student[];
      }
    },
  });

  const {
    data: sessions = [],
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ["rfid-sessions"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const response = await apiGet(`/api/rfid/sessions?date=${encodeURIComponent(today)}`);
      return response.data as RFIDSession[];
    },
    refetchInterval: 5000,
  });

  // Fetch RFID scan history
  const {
    data: scanHistory = [],
    refetch: refetchScans,
    isLoading: scansLoading,
  } = useQuery({
    queryKey: ["rfid-scans"],
    queryFn: async () => {
      try {
        const response = await apiGet(`/api/rfid/scans`);
        return response.data as RFIDScan[];
      } catch (error) {
        console.warn("Could not fetch scans from API");
        return [] as RFIDScan[];
      }
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Create RFID scan record
  const { mutate: recordScan, isPending } = useMutation({
    mutationFn: async (data: {
      rfid_code: string;
      type: "entry" | "exit";
      image_base64?: string | null;
    }) => {
      try {
        const response = await apiPost(`/api/rfid/scans`, data);
        return response.data as RFIDScan;
      } catch (error: any) {
        const errorMessage = String(error?.message || "");
        if (errorMessage.toLowerCase().includes("already recorded")) {
          throw error;
        }
        console.error("API Error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setCurrentScan(data);
      setShowDetails(true);

      if (data.status === "success") {
        showToast({
          title: "Success",
          description: `${data.student_name} recorded - ${data.type.toUpperCase()}`,
        });
      } else if (data.status === "unknown") {
        showToast({
          title: "Unknown Card",
          description: "RFID card not found in system",
          variant: "destructive",
        });
      } else {
        showToast({
          title: "Error",
          description: "Failed to process RFID scan",
          variant: "destructive",
        });
      }

      // Clear input and refocus
      setRfidInput("");
      setTimeout(() => rfidInputRef.current?.focus(), 500);
      
      // Refetch scans
      refetchScans();
    },
    onError: (error: any) => {
      console.error("Mutation Error:", error);
      const messageText = error?.message || "Failed to record scan. Check console for details.";

      if (messageText.toLowerCase().includes("already recorded")) {
        const now = new Date().toISOString();
        const rfidCode = rfidInput.trim();
        const nextRetryCount = (rfidRetryCounts[rfidCode] || 0) + 1;

        setRfidRetryCounts((prev) => ({ ...prev, [rfidCode]: nextRetryCount }));

        if (nextRetryCount > 2) {
          setBlockedRfids((prev) => ({ ...prev, [rfidCode]: true }));
          setRfidInput("");
          setTimeout(() => rfidInputRef.current?.focus(), 50);
          return;
        }

        const showDuplicate = (studentName?: string) => {
          setCurrentScan({
            id: -1,
            rfid_code: rfidCode,
            scan_time: now,
            type: scanType,
            status: "error",
            student_name: studentName,
            notes: "Already scanned for this session.",
          });
          setShowDetails(true);
          showToast({
            title: "Already scanned",
            description: "Student is already recorded for this session.",
            variant: "destructive",
          });
        };

        const matchedStudent = students.find((student) => student.rfid_card === rfidCode);
        if (matchedStudent) {
          showDuplicate(`${matchedStudent.first_name} ${matchedStudent.last_name}`);
          return;
        }

        apiGet(`${API_ENDPOINTS.RFID_CARD_CHECK}?rfid_code=${encodeURIComponent(rfidCode)}`)
          .then((response) => {
            const student = response?.student;
            const studentName = student ? `${student.first_name} ${student.last_name}` : undefined;
            showDuplicate(studentName);
          })
          .catch(() => {
            showDuplicate();
          });
      } else {
        showToast({
          title: "Error",
          description: messageText,
          variant: "destructive",
        });
      }
    },
  });

  const { mutate: createSession, isPending: isCreatingSession } = useMutation({
    mutationFn: async (data: {
      label: string;
      session_type: "entry" | "exit";
      scheduled_start: string;
      scheduled_end: string;
    }) => {
      const response = await apiPost(`/api/rfid/sessions`, data);
      return response.data;
    },
    onSuccess: () => {
      setSessionLabel("");
      setSessionType("entry");
      setSessionStart("");
      setSessionEnd("");
      refetchSessions();
      showToast({ title: "Session created", description: "RFID session scheduled." });
    },
    onError: (error: any) => {
      showToast({
        title: "Error",
        description: error?.message || "Failed to create session.",
        variant: "destructive",
      });
    },
  });

  const { mutate: startSession, isPending: isStartingSession } = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await apiPost(`/api/rfid/sessions/${sessionId}/start`, {});
      return response.data;
    },
    onSuccess: () => {
      refetchSessions();
      showToast({ title: "Session started", description: "RFID session is now active." });
    },
    onError: (error: any) => {
      showToast({
        title: "Error",
        description: error?.message || "Failed to start session.",
        variant: "destructive",
      });
    },
  });

  const { mutate: endSession, isPending: isEndingSession } = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await apiPost(`/api/rfid/sessions/${sessionId}/end`, {});
      return response.data;
    },
    onSuccess: () => {
      refetchSessions();
      showToast({ title: "Session ended", description: "RFID session closed." });
    },
    onError: (error: any) => {
      showToast({
        title: "Error",
        description: error?.message || "Failed to end session.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!cameraEnabled) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      setCameraError(null);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraError(null);
      })
      .catch((err) => {
        setCameraError(err?.message || "Camera unavailable.");
        setCameraEnabled(false);
      });

    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [cameraEnabled]);

  useEffect(() => {
    if (attendanceMode) {
      setCameraEnabled(true);
    }
  }, [attendanceMode]);

  useEffect(() => {
    if (!attendanceMode) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Attendance mode is active.";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [attendanceMode]);

  // Handle RFID input (real scanner sends input like keyboard)
  // Keep input field focused so scanner can always input
  useEffect(() => {
    const isInteractiveElement = (element: Element | null) => {
      if (!element) return false;
      const tag = element.tagName.toLowerCase();
      return ["input", "button", "select", "textarea", "a"].includes(tag);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Always refocus the input field if it loses focus
      const active = document.activeElement;
      if (active !== rfidInputRef.current && e.key !== 'Tab' && !isInteractiveElement(active)) {
        rfidInputRef.current?.focus();
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      // Process Enter key to submit scan
      if (e.key === "Enter" && rfidInput.trim()) {
        e.preventDefault();
        const trimmedCode = rfidInput.trim();

        if (blockedRfids[trimmedCode]) {
          setRfidInput("");
          setTimeout(() => rfidInputRef.current?.focus(), 50);
          return;
        }

        setIsScanning(true);
        const capturedImage = captureImage();
        recordScan({
          rfid_code: trimmedCode,
          type: scanType,
          image_base64: capturedImage,
        });
        setIsScanning(false);
      }
    };

    const handleFocus = () => {
      // Ensure input stays focused
      console.log("RFID input focused - scanner ready");
    };

    const handleBlur = () => {
      // Immediately refocus the input field
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          rfidInputRef.current?.focus();
        }
      }, 50);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keypress", handleKeyPress);
    
    if (rfidInputRef.current) {
      rfidInputRef.current.addEventListener("blur", handleBlur);
      rfidInputRef.current.addEventListener("focus", handleFocus);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keypress", handleKeyPress);
      if (rfidInputRef.current) {
        rfidInputRef.current.removeEventListener("blur", handleBlur);
        rfidInputRef.current.removeEventListener("focus", handleFocus);
      }
    };
  }, [rfidInput, scanType, blockedRfids, recordScan]);

  // Focus input on mount and keep it focused
  useEffect(() => {
    rfidInputRef.current?.focus();
    
    // Periodically check if input is still focused, refocus if not
    const focusInterval = setInterval(() => {
      const active = document.activeElement;
      if (active !== rfidInputRef.current && (!active || active === document.body)) {
        rfidInputRef.current?.focus();
      }
    }, 500);

    return () => clearInterval(focusInterval);
  }, []);

  // Filter scan history
  const filteredScans = scanHistory.filter(
    (scan) => {
      const matchesType = filterType === "all" || scan.type === filterType;
      const matchesSearch =
        scan.student_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scan.rfid_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scan.id.toString().includes(searchQuery);
      return matchesType && matchesSearch;
    }
  );

  const allScans = scanHistory;
  const successScans = allScans.filter((s) => s.status === "success").length;
  const unknownScans = allScans.filter((s) => s.status === "unknown").length;
  const totalScans = allScans.length;
  const activeSession = sessions.find((session) => session.status === "active");

  const normalizeDateTime = (value: string) => {
    if (!value) return "";
    return value.replace("T", " ");
  };

  const verifyExitPasskey = async () => {
    if (!passkey.trim()) {
      setPasskeyError("Passkey is required.");
      return;
    }

    setIsVerifying(true);
    setPasskeyError(null);
    try {
      await apiPost(API_ENDPOINTS.RFID_VERIFY_PASSKEY, { passkey: passkey.trim() });
      setAttendanceMode(false);
      setShowExitModal(false);
      setPasskey("");
    } catch (error: any) {
      setPasskeyError(error?.message || "Invalid passkey.");
    } finally {
      setIsVerifying(false);
    }
  };

  const captureImage = () => {
    if (!cameraEnabled || !videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const closeScanDetails = () => {
    setShowDetails(false);
    setCurrentScan(null);
    setRfidInput("");
    setTimeout(() => rfidInputRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (activeSession?.session_type) {
      setScanType(activeSession.session_type);
    }
  }, [activeSession?.session_type]);

  const getTodayScans = () => {
    const today = new Date().toDateString();
    return allScans.filter(
      (s) => new Date(s.scan_time).toDateString() === today
    ).length;
  };

  const getScanStatusBadge = (scan: RFIDScan) => {
    if (scan.status === "success") {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Success
        </Badge>
      );
    } else if (scan.status === "unknown") {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Unknown
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Error
        </Badge>
      );
    }
  };

  const downloadReport = () => {
    const csv = [
      ["Scan Time", "Student Name", "RFID Code", "Type", "Status"],
      ...filteredScans.map((scan) => [
        new Date(scan.scan_time).toLocaleString(),
        scan.student_name || "Unknown",
        scan.rfid_code,
        scan.type.toUpperCase(),
        scan.status.toUpperCase(),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfid-attendance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 flex items-center justify-center shadow-lg flex-shrink-0">
              <Radio className="h-6 sm:h-8 w-6 sm:w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-1 sm:mb-2">
                RFID Gate Attendance
              </h1>
              <p className="text-muted-foreground text-xs sm:text-base">
                Track student entry and exit using RFID card scanner
              </p>
            </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/admin/rfid-management")}>
                RFID Management
              </Button>
              <Button
                variant={attendanceMode ? "secondary" : "default"}
                onClick={() => setAttendanceMode(true)}
                disabled={attendanceMode}
              >
                Attendance Mode
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Scanner */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  Session Control
                </CardTitle>
                <CardDescription>
                  Manage IN/OUT sessions for morning and noon shifts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={activeSession ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                    {activeSession ? `Active: ${activeSession.label}` : "No active session"}
                  </Badge>
                  {activeSession && (
                    <Badge className="bg-blue-100 text-blue-800">
                      {activeSession.session_type.toUpperCase()}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Late entries are marked after the session ends.
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
                  <Input
                    placeholder="Session label (e.g., Morning IN)"
                    value={sessionLabel}
                    onChange={(event) => setSessionLabel(event.target.value)}
                  />
                  <Select value={sessionType} onValueChange={(value) => setSessionType(value as "entry" | "exit")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry (IN)</SelectItem>
                      <SelectItem value="exit">Exit (OUT)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => createSession({
                      label: sessionLabel.trim(),
                      session_type: sessionType,
                      scheduled_start: normalizeDateTime(sessionStart),
                      scheduled_end: normalizeDateTime(sessionEnd),
                    })}
                    disabled={
                      isCreatingSession ||
                      !sessionLabel.trim() ||
                      !sessionStart ||
                      !sessionEnd
                    }
                  >
                    {isCreatingSession ? "Saving" : "Add Session"}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start</Label>
                    <Input
                      type="datetime-local"
                      value={sessionStart}
                      onChange={(event) => setSessionStart(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End</Label>
                    <Input
                      type="datetime-local"
                      value={sessionEnd}
                      onChange={(event) => setSessionEnd(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                      No sessions scheduled for today.
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div key={session.id} className="rounded-lg border border-border p-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{session.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(session.scheduled_start).toLocaleTimeString()} - {new Date(session.scheduled_end).toLocaleTimeString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-muted text-muted-foreground">
                            {session.session_type.toUpperCase()}
                          </Badge>
                          <Badge className={
                            session.status === "active"
                              ? "bg-green-100 text-green-800"
                              : session.status === "closed"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-blue-100 text-blue-800"
                          }>
                            {session.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={session.status !== "scheduled" || isStartingSession}
                            onClick={() => startSession(session.id)}
                          >
                            Start
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={session.status !== "active" || isEndingSession}
                            onClick={() => endSession(session.id)}
                          >
                            End
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Camera className="w-5 h-5 text-purple-600" />
                  Camera Capture
                </CardTitle>
                <CardDescription>
                  Capture a photo on each RFID tap for verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={cameraEnabled ? "default" : "outline"}
                    onClick={() => setCameraEnabled((prev) => !prev)}
                  >
                    {cameraEnabled ? "Disable Camera" : "Enable Camera"}
                  </Button>
                  {cameraError && (
                    <span className="text-xs text-rose-600">{cameraError}</span>
                  )}
                </div>
                <div className="rounded-lg border border-border overflow-hidden bg-black/5">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-48 object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </CardContent>
            </Card>

            {/* Scanner Status Card */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Wifi className="w-5 h-5 text-green-600" />
                      Scanner Status
                    </CardTitle>
                    <CardDescription>
                      RFID scanner is ready and waiting for input
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!activeSession && (
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-700">
                    No active session. Scans will be recorded but marked as late or unscheduled.
                  </div>
                )}
                {/* Scan Type Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Scan Type
                    </Label>
                    <Select value={scanType} onValueChange={(value) => setScanType(value as "entry" | "exit")}>
                      <SelectTrigger className="bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Entry (IN)</SelectItem>
                        <SelectItem value="exit">Exit (OUT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">
                      Current Time
                    </Label>
                    <div className="p-2 bg-muted/50 rounded-lg border border-border flex items-center gap-2 h-10">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {new Date().toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RFID Input */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Scan RFID Card
                  </Label>
                  <Input
                    ref={rfidInputRef}
                    type="text"
                    placeholder="Position card near scanner... (auto-detected)"
                    value={rfidInput}
                    onChange={(e) => setRfidInput(e.target.value)}
                    disabled={isPending}
                    className="text-center text-lg font-mono bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 focus:border-purple-600"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Scanner will automatically detect RFID card. Press ENTER to
                    confirm.
                  </p>
                </div>

                {/* Last Scan Result */}
                {currentScan && (
                  <div
                    className={`p-4 rounded-lg border-2 ${
                      currentScan.status === "success"
                        ? "bg-green-50 border-green-300"
                        : currentScan.status === "unknown"
                          ? "bg-yellow-50 border-yellow-300"
                          : "bg-red-50 border-red-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {currentScan.student_name || "Unknown Card"}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {currentScan.type === "entry"
                            ? "✓ Entered building"
                            : "✓ Exited building"}
                        </p>
                        {currentScan.is_late ? (
                          <p className="text-xs text-amber-700">Late scan</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {new Date(currentScan.scan_time).toLocaleTimeString()}
                        </p>
                      </div>
                      {getScanStatusBadge(currentScan)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="shadow-lg border-0">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-600">
                      {getTodayScans()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Today's Scans
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {successScans}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recognized
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-yellow-600">
                      {unknownScans}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unknown Cards
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {/* Scanner Info */}
            <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 to-blue-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Radio className="w-4 h-4" />
                  Scanner Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Registered Cards</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {students.filter((s) => s.rfid_card).length}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Total Scans</p>
                  <p className="text-2xl font-bold text-blue-600">{totalScans}</p>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Scanner Status
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-medium">Connected</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="shadow-lg border-0">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={() => refetchScans()}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={scansLoading}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Scans
                </Button>
                <Button
                  onClick={downloadReport}
                  variant="outline"
                  className="w-full justify-start"
                  disabled={filteredScans.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Scan History */}
        <Card className="shadow-lg border-0 mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Scan History</CardTitle>
                <CardDescription>
                  Recent RFID scans and attendance records
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Search by student name, RFID code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-muted/50"
                />
              </div>
              <Select value={filterType} onValueChange={(value) => setFilterType(value as "all" | "entry" | "exit")}>
                <SelectTrigger className="sm:w-48 bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scans</SelectItem>
                  <SelectItem value="entry">Entry Only</SelectItem>
                  <SelectItem value="exit">Exit Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scan List */}
            <div className="space-y-3">
              {scansLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading scans...</p>
                </div>
              ) : filteredScans.length > 0 ? (
                filteredScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="p-4 border border-border rounded-lg hover:bg-muted/30 transition"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <h4 className="font-semibold text-foreground truncate">
                            {scan.student_name || "Unknown"}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          RFID: {scan.rfid_code}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className={
                              scan.type === "entry"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-orange-50 text-orange-700"
                            }
                          >
                            {scan.type === "entry" ? "ENTRY" : "EXIT"}
                          </Badge>
                          {scan.is_late ? (
                            <Badge className="bg-amber-100 text-amber-700">Late</Badge>
                          ) : null}
                          <span className="text-xs text-muted-foreground">
                            {new Date(scan.scan_time).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {getScanStatusBadge(scan)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No scans found matching your filters
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scan Details Dialog */}
      <Dialog
        open={showDetails}
        onOpenChange={(open) => {
          if (!open) {
            closeScanDetails();
            return;
          }
          setShowDetails(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Details</DialogTitle>
            <DialogDescription>
              RFID scan record information
            </DialogDescription>
          </DialogHeader>

          {currentScan && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Student Name
                </p>
                <p className="text-lg font-semibold">
                  {currentScan.student_name || "Unknown"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">RFID Code</p>
                <p className="font-mono text-sm bg-muted/50 p-2 rounded">
                  {currentScan.rfid_code}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Scan Type</p>
                  <Badge
                    className={
                      currentScan.type === "entry"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-orange-100 text-orange-800"
                    }
                  >
                    {currentScan.type === "entry" ? "ENTRY" : "EXIT"}
                  </Badge>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  {getScanStatusBadge(currentScan)}
                </div>
              </div>

              {currentScan.is_late ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Late</p>
                  <Badge className="bg-amber-100 text-amber-700">Late scan</Badge>
                </div>
              ) : null}

              <div>
                <p className="text-sm text-muted-foreground mb-1">Scan Time</p>
                <p className="text-sm">
                  {new Date(currentScan.scan_time).toLocaleString()}
                </p>
              </div>

              {currentScan.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{currentScan.notes}</p>
                </div>
              )}

              {currentScan.image_path && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Captured Image</p>
                  <img
                    src={currentScan.image_path}
                    alt="RFID capture"
                    className="w-full rounded-lg border border-border"
                  />
                </div>
              )}
            </div>
          )}

          <Button onClick={closeScanDetails} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showExitModal} onOpenChange={setShowExitModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Exit Attendance Mode</DialogTitle>
            <DialogDescription>
              Enter the admin passkey to unlock the screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Admin Passkey</Label>
              <Input
                type="password"
                value={passkey}
                onChange={(event) => setPasskey(event.target.value)}
                placeholder="Enter passkey"
              />
              {passkeyError && (
                <p className="text-xs text-rose-600 mt-1">{passkeyError}</p>
              )}
            </div>
            <Button onClick={verifyExitPasskey} disabled={isVerifying} className="w-full">
              {isVerifying ? "Verifying" : "Unlock"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {attendanceMode && (
        <div className="fixed inset-0 z-50 bg-black/90 text-white flex flex-col items-center justify-center gap-6 p-6">
          <div className="text-center space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-white/60">Attendance Mode</p>
            <h2 className="text-2xl font-semibold">RFID Gate Scanner</h2>
          </div>
          <div className="w-full max-w-xl space-y-4">
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
              <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-white/70">Scan RFID Card</Label>
              <Input
                ref={rfidInputRef}
                type="text"
                placeholder="Tap RFID card..."
                value={rfidInput}
                onChange={(event) => setRfidInput(event.target.value)}
                className="text-center text-lg font-mono bg-white/10 border-white/20 text-white"
              />
              <p className="text-xs text-white/60">Press ENTER to confirm scan.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => setShowExitModal(true)}>
            Exit Attendance Mode
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
};

export default RFIDAttendance;
