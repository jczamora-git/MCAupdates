import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CommunicationLoadingModal from "@/components/CommunicationLoadingModal";
import { API_ENDPOINTS, apiGet, apiPost, apiPut } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  Radio,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
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
  sms_sent?: boolean;
  sms_status?: "sent" | "skipped" | "failed";
  sms_message?: string;
}

interface RFIDSession {
  id: number;
  label: string;
  session_type: "entry" | "exit";
  scheduled_start: string;
  scheduled_end: string;
  actual_start?: string | null;
  actual_end?: string | null;
  status: "scheduled" | "active" | "closed" | "completed";
}

interface RFIDSessionTemplate {
  id: number;
  name: string;
  period: "morning" | "afternoon";
  session_type: "entry" | "exit";
  start_time: string;
  end_time: string;
  status: "active" | "inactive";
}

const RFIDAttendance = () => {
  const [rfidInput, setRfidInput] = useState("");
  const [scanType, setScanType] = useState<"entry" | "exit">("entry");
  const [currentScan, setCurrentScan] = useState<RFIDScan | null>(null);
  const [detailsMode, setDetailsMode] = useState<"scan" | "checker">("scan");
  const [checkerDetails, setCheckerDetails] = useState<{ student_name?: string; rfid_code: string } | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "entry" | "exit">("all");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"session-control" | "session-templates" | "rfid-checker">("session-control");
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rfidRetryCounts, setRfidRetryCounts] = useState<Record<string, number>>({});
  const [blockedRfids, setBlockedRfids] = useState<Record<string, boolean>>({});
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RFIDSessionTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    period: "morning" as "morning" | "afternoon",
    session_type: "entry" as "entry" | "exit",
    start_time: "",
    end_time: "",
    status: "active" as "active" | "inactive",
  });
  const [checkerCode, setCheckerCode] = useState("");
  const [checkerError, setCheckerError] = useState<string | null>(null);
  const [isCheckingCard, setIsCheckingCard] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsModalSuccess, setSmsModalSuccess] = useState(false);
  const [smsModalError, setSmsModalError] = useState(false);
  const [smsModalMessage, setSmsModalMessage] = useState("");
  const [smsModalHelper, setSmsModalHelper] = useState("");
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const checkerInputRef = useRef<HTMLInputElement>(null);
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
        const response = await apiGet(API_ENDPOINTS.STUDENTS);
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
      const response = await apiGet(`${API_ENDPOINTS.RFID_SESSIONS}?date=${encodeURIComponent(today)}`);
      return response.data as RFIDSession[];
    },
    refetchInterval: 5000,
  });

  const {
    data: templates = [],
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ["rfid-session-templates"],
    queryFn: async () => {
      try {
        const response = await apiGet(API_ENDPOINTS.RFID_SESSION_TEMPLATES);
        return (response.data || response) as RFIDSessionTemplate[];
      } catch (error) {
        console.warn("Could not fetch templates from API", error);
        return [] as RFIDSessionTemplate[];
      }
    },
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
        const response = await apiGet(API_ENDPOINTS.RFID_SCANS);
        return response.data as RFIDScan[];
      } catch (error) {
        console.warn("Could not fetch scans from API");
        return [] as RFIDScan[];
      }
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const { data: rfidStats } = useQuery({
    queryKey: ["rfid-stats"],
    queryFn: async () => {
      try {
        const response = await apiGet(API_ENDPOINTS.RFID_STATS);
        return response.data || response;
      } catch (error) {
        console.warn("Could not fetch RFID stats", error);
        return { registered_cards: 0, total_scans: 0 };
      }
    },
    refetchInterval: 5000,
  });

  // Create RFID scan record
  const { mutate: recordScan, isPending } = useMutation({
    mutationFn: async (data: {
      rfid_code: string;
      type: "entry" | "exit";
      image_base64?: string | null;
    }) => {
      try {
        console.log("[RFID] submitting scan", { rfid_code: data.rfid_code, type: data.type });
        const response = await apiPost(API_ENDPOINTS.RFID_SCANS, data);
        console.log("[RFID] scan response", response);
        if (response?.success === false) {
          throw new Error(response?.message || "RFID scan failed");
        }
        return (response?.data ?? response) as RFIDScan;
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
      if (!data || !data.status) {
        setSmsModalOpen(false);
        showToast({
          title: "Error",
          description: "Invalid scan response from server.",
          variant: "destructive",
        });
        setRfidInput("");
        setTimeout(() => rfidInputRef.current?.focus(), 50);
        return;
      }
      const smsStatus = data?.sms_status as string | undefined;
      const smsMessage = data?.sms_message as string | undefined;

      if (data.status === "unknown") {
        setSmsModalSuccess(true);
        setSmsModalError(false);
        setSmsModalMessage("No SMS sent");
        setSmsModalHelper("Unknown RFID card has no linked phone number.");
      } else if (smsStatus === "sent") {
        setSmsModalSuccess(true);
        setSmsModalError(false);
        setSmsModalMessage("SMS sent successfully");
        setSmsModalHelper(smsMessage || "Attendance notification has been sent.");
      } else if (smsStatus === "skipped") {
        setSmsModalSuccess(true);
        setSmsModalError(false);
        setSmsModalMessage("SMS not sent");
        setSmsModalHelper(smsMessage || "No phone number found for this student, but attendance was recorded.");
      } else if (smsStatus === "failed") {
        setSmsModalSuccess(false);
        setSmsModalError(true);
        setSmsModalMessage("Attendance recorded, but SMS failed");
        setSmsModalHelper(smsMessage || "Please check SMS settings or try again later.");
      } else {
        setSmsModalSuccess(true);
        setSmsModalError(false);
        setSmsModalMessage("SMS status unavailable");
        setSmsModalHelper("Attendance was recorded successfully.");
      }

      setDetailsMode("scan");
      setCheckerDetails(null);
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
      setSmsModalOpen(false);
      setSmsModalSuccess(false);
      setSmsModalError(false);
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
          setDetailsMode("scan");
          setCheckerDetails(null);
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
            const student = response?.data || response?.student;
            const studentName = student
              ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")
              : response?.full_name || response?.student_name;
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

      setRfidInput("");
      setTimeout(() => rfidInputRef.current?.focus(), 50);
    },
  });

  const { mutate: startSessionFromTemplate, isPending: isStartingTemplate } = useMutation({
    mutationFn: async (templateId: number) => {
      const today = new Date().toISOString().split("T")[0];
      const response = await apiPost(API_ENDPOINTS.RFID_SESSION_TEMPLATE_START(templateId), {
        date: today,
      });
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

  const { mutate: startSession, isPending: isStartingSession } = useMutation({
    mutationFn: async (sessionId: number) => {
      const response = await apiPost(`${API_ENDPOINTS.RFID_SESSIONS}/${sessionId}/start`, {});
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
      const response = await apiPost(`${API_ENDPOINTS.RFID_SESSIONS}/${sessionId}/end`, {});
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

  const { mutate: createTemplate, isPending: isCreatingTemplate } = useMutation({
    mutationFn: async (payload: typeof templateForm) => {
      const response = await apiPost(API_ENDPOINTS.RFID_SESSION_TEMPLATES, payload);
      return response.data;
    },
    onSuccess: () => {
      refetchTemplates();
      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
      setTemplateForm({
        name: "",
        period: "morning",
        session_type: "entry",
        start_time: "",
        end_time: "",
        status: "active",
      });
      showToast({ title: "Template created", description: "RFID session template saved." });
    },
    onError: (error: any) => {
      showToast({
        title: "Error",
        description: error?.message || "Failed to create template.",
        variant: "destructive",
      });
    },
  });

  const { mutate: updateTemplate, isPending: isUpdatingTemplate } = useMutation({
    mutationFn: async (payload: RFIDSessionTemplate) => {
      const response = await apiPut(API_ENDPOINTS.RFID_SESSION_TEMPLATE(payload.id), payload);
      return response.data;
    },
    onSuccess: () => {
      refetchTemplates();
      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
      showToast({ title: "Template updated", description: "RFID session template updated." });
    },
    onError: (error: any) => {
      showToast({
        title: "Error",
        description: error?.message || "Failed to update template.",
        variant: "destructive",
      });
    },
  });

  const { mutate: updateTemplateStatus, isPending: isUpdatingTemplateStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "active" | "inactive" }) => {
      const response = await apiPut(API_ENDPOINTS.RFID_SESSION_TEMPLATE_STATUS(id), { status });
      return response.data;
    },
    onSuccess: () => {
      refetchTemplates();
    },
    onError: (error: any) => {
      showToast({
        title: "Error",
        description: error?.message || "Failed to update status.",
        variant: "destructive",
      });
    },
  });

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraEnabled(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraEnabled(true);
      setCameraError(null);
    } catch (error: any) {
      console.error("Camera permission error:", error);
      setCameraEnabled(false);
      setCameraError("Camera permission is required for attendance mode verification.");
    }
  }, []);

  useEffect(() => {
    if (attendanceMode) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [attendanceMode, startCamera, stopCamera]);

  useEffect(() => {
    if (!attendanceMode) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "Attendance mode is active.";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [attendanceMode]);

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
  const totalScans = allScans.length;
  const registeredCards = rfidStats?.registered_cards ?? 0;
  const totalScansCount = rfidStats?.total_scans ?? totalScans;
  const activeSession = sessions.find((session) => session.status === "active");
  const today = new Date().toISOString().split("T")[0];
  const activeTemplates = templates.filter((template) => template.status === "active");

  // Handle RFID input (real scanner sends input like keyboard)
  // Keep input field focused so scanner can always input
  useEffect(() => {
    if (!attendanceMode) return;

    const isInteractiveElement = (element: Element | null) => {
      if (!element) return false;
      const tag = element.tagName.toLowerCase();
      return ["input", "button", "select", "textarea", "a"].includes(tag);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Always refocus the input field if it loses focus
      const active = document.activeElement;
      if (active !== rfidInputRef.current && e.key !== "Tab" && !isInteractiveElement(active)) {
        rfidInputRef.current?.focus();
      }
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      // Process Enter key to submit scan
      if (e.key === "Enter" && rfidInput.trim()) {
        e.preventDefault();
        if (isPending) {
          return;
        }
        const trimmedCode = rfidInput.trim();

        if (blockedRfids[trimmedCode]) {
          setRfidInput("");
          setTimeout(() => rfidInputRef.current?.focus(), 50);
          return;
        }

        if (attendanceMode && !cameraEnabled) {
          showToast({
            title: "Camera required",
            description: "Please enable camera before scanning RFID cards.",
            variant: "destructive",
          });
          return;
        }

        if (!activeSession) {
          showToast({
            title: "Session required",
            description: "No active RFID session. Please start a session first.",
            variant: "destructive",
          });
          setRfidInput("");
          return;
        }

        const activeType = activeSession.session_type || scanType;

        setSmsModalOpen(true);
        setSmsModalSuccess(false);
        setSmsModalError(false);
        setSmsModalMessage("Sending SMS notification...");
        setSmsModalHelper("Please wait while we record attendance and notify the contact number.");

        const capturedImage = captureImage();
        recordScan({
          rfid_code: trimmedCode,
          type: activeType,
          image_base64: capturedImage,
        });
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
  }, [rfidInput, scanType, blockedRfids, recordScan, attendanceMode, cameraEnabled, showToast, activeSession]);

  // Focus input on mount and keep it focused
  useEffect(() => {
    if (!attendanceMode) return;

    rfidInputRef.current?.focus();

    // Periodically check if input is still focused, refocus if not
    const focusInterval = setInterval(() => {
      const active = document.activeElement;
      if (active !== rfidInputRef.current && (!active || active === document.body)) {
        rfidInputRef.current?.focus();
      }
    }, 500);

    return () => clearInterval(focusInterval);
  }, [attendanceMode]);

  useEffect(() => {
    if (!attendanceMode) return;

    if (!activeSession) {
      setAttendanceMode(false);
      showToast({
        title: "Session ended",
        description: "The active session has ended.",
        variant: "destructive",
      });
    }
  }, [attendanceMode, activeSession, showToast]);

  const getSessionForTemplate = (template: RFIDSessionTemplate) => {
    return sessions.find((session) => {
      if (session.label !== template.name) return false;
      if (session.session_type !== template.session_type) return false;
      return (session.scheduled_start || "").slice(0, 10) === today;
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      period: "morning",
      session_type: "entry",
      start_time: "",
      end_time: "",
      status: "active",
    });
  };

  const openTemplateModal = (template?: RFIDSessionTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        name: template.name,
        period: template.period,
        session_type: template.session_type,
        start_time: template.start_time,
        end_time: template.end_time,
        status: template.status,
      });
    } else {
      setEditingTemplate(null);
      resetTemplateForm();
    }
    setIsTemplateModalOpen(true);
  };

  const validateTemplateTimes = () => {
    if (!templateForm.start_time || !templateForm.end_time) return false;
    return templateForm.end_time > templateForm.start_time;
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim()) {
      showToast({
        title: "Name required",
        description: "Template name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!validateTemplateTimes()) {
      showToast({
        title: "Invalid time range",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }

    if (editingTemplate) {
      updateTemplate({ ...editingTemplate, ...templateForm });
    } else {
      createTemplate(templateForm);
    }
  };

  const handleCheckCard = async () => {
    const trimmed = checkerCode.trim();
    if (!trimmed) {
      setCheckerError("Enter an RFID code to check.");
      return;
    }

    setIsCheckingCard(true);
    setCheckerError(null);
    try {
      const response = await apiGet(`${API_ENDPOINTS.RFID_CARD_CHECK}?rfid_code=${encodeURIComponent(trimmed)}`);
      const payload = response?.data || response?.student;
      const found = typeof response?.found === "boolean"
        ? response.found
        : typeof response?.assigned === "boolean"
          ? response.assigned
          : !!payload;

      if (!found || !payload) {
        showToast({
          title: "RFID not found",
          description: "No student is registered with this RFID card.",
          variant: "destructive",
        });
        setCheckerCode("");
        setTimeout(() => checkerInputRef.current?.focus(), 50);
        return;
      }

      const studentName = payload.full_name
        || [payload.first_name, payload.middle_name, payload.last_name].filter(Boolean).join(" ")
        || payload.student_name;
      const rfidCode = payload.rfid_card || payload.rfid_code || trimmed;

      setDetailsMode("checker");
      setCheckerDetails({
        student_name: studentName || "Unknown",
        rfid_code: rfidCode,
      });
      setCurrentScan(null);
      setShowDetails(true);
      setCheckerCode("");
    } catch (error: any) {
      setCheckerError(error?.message || "Failed to check RFID card.");
    } finally {
      setIsCheckingCard(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "rfid-checker") return;
    checkerInputRef.current?.focus();
  }, [activeTab]);

  const verifyExitAdminPassword = async () => {
    if (!adminPassword.trim()) {
      setAdminPasswordError("Please enter your password.");
      return;
    }

    setIsVerifying(true);
    setAdminPasswordError(null);
    try {
      const response = await apiPost(API_ENDPOINTS.RFID_VERIFY_ADMIN_PASSWORD, {
        password: adminPassword.trim(),
      });

      if (response?.success === true) {
        setAttendanceMode(false);
        setShowExitModal(false);
        setAdminPassword("");
        setAdminPasswordError(null);
        stopCamera();
        return;
      }

      setAdminPassword("");
      setAdminPasswordError(response?.message || "Incorrect password. Please try again.");
    } catch (error: any) {
      setAdminPassword("");
      setAdminPasswordError(error?.message || "Incorrect password. Please try again.");
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
    setCheckerDetails(null);
    setDetailsMode("scan");
    setRfidInput("");
    setTimeout(() => {
      if (attendanceMode) {
        rfidInputRef.current?.focus();
        return;
      }

      if (activeTab === "rfid-checker") {
        checkerInputRef.current?.focus();
      }
    }, 50);
  };

  const handleSmsModalComplete = () => {
    setSmsModalOpen(false);
    if (attendanceMode) {
      setTimeout(() => rfidInputRef.current?.focus(), 50);
    }
  };

  useEffect(() => {
    if (activeSession?.session_type) {
      setScanType(activeSession.session_type);
    }
  }, [activeSession?.session_type]);

  const handleEnterAttendanceMode = () => {
    if (!activeSession) {
      showToast({
        title: "Session required",
        description: "Please start a session before entering Attendance Mode.",
        variant: "destructive",
      });
      setActiveTab("session-control");
      return;
    }

    setAttendanceMode(true);
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
                onClick={handleEnterAttendanceMode}
                disabled={attendanceMode}
              >
                Attendance Mode
              </Button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Button
            variant={activeTab === "session-control" ? "default" : "outline"}
            onClick={() => setActiveTab("session-control")}
          >
            Session Control
          </Button>
          <Button
            variant={activeTab === "session-templates" ? "default" : "outline"}
            onClick={() => setActiveTab("session-templates")}
          >
            Session Templates
          </Button>
          <Button
            variant={activeTab === "rfid-checker" ? "default" : "outline"}
            onClick={() => setActiveTab("rfid-checker")}
          >
            RFID Checker
          </Button>
        </div>

        {activeTab === "session-control" && (
          <>
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
                      Start today&apos;s RFID sessions from templates.
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

                    <div className="space-y-3">
                      {activeTemplates.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                          No active templates. Create one in Session Templates.
                        </div>
                      ) : (
                        activeTemplates.map((template) => {
                          const session = getSessionForTemplate(template);
                          const statusLabel = session
                            ? session.status === "active"
                              ? "Active"
                              : session.status === "closed" || session.status === "completed"
                                ? "Completed"
                                : "Scheduled"
                            : "Not started";
                          const hasOtherActive = activeSession && (!session || activeSession.id !== session.id);

                          return (
                            <div key={template.id} className="rounded-lg border border-border p-3 flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold">{template.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {template.period.toUpperCase()} • {template.start_time} - {template.end_time}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-muted text-muted-foreground">
                                  {template.session_type.toUpperCase()}
                                </Badge>
                                <Badge
                                  className={
                                    statusLabel === "Active"
                                      ? "bg-green-100 text-green-800"
                                      : statusLabel === "Completed"
                                        ? "bg-gray-100 text-gray-600"
                                        : statusLabel === "Scheduled"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-muted text-muted-foreground"
                                  }
                                >
                                  {statusLabel}
                                </Badge>
                                {session?.status === "active" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isEndingSession}
                                    onClick={() => endSession(session.id)}
                                  >
                                    End
                                  </Button>
                                ) : session?.status === "scheduled" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isStartingSession || !!hasOtherActive}
                                    onClick={() => startSession(session.id)}
                                  >
                                    Start
                                  </Button>
                                ) : session?.status === "closed" ? (
                                  <Button size="sm" variant="outline" disabled>
                                    Completed
                                  </Button>
                                ) : session?.status === "completed" ? (
                                  <Button size="sm" variant="outline" disabled>
                                    Completed
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isStartingTemplate || !!hasOtherActive}
                                    onClick={() => startSessionFromTemplate(template.id)}
                                  >
                                    Start
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Right Column - Summary */}
              <div className="space-y-6">
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
                        {registeredCards}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground mb-1">Total Scans</p>
                      <p className="text-2xl font-bold text-blue-600">{totalScansCount}</p>
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
              </div>
            </div>

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
          </>
        )}

        {activeTab === "session-templates" && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Session Templates</CardTitle>
                  <CardDescription>
                    Create reusable templates for daily RFID sessions.
                  </CardDescription>
                </div>
                <Button onClick={() => openTemplateModal()}>New Template</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No templates yet. Create your first template to get started.
                </div>
              ) : (
                templates.map((template) => (
                  <div key={template.id} className="rounded-lg border border-border p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.period.toUpperCase()} • {template.start_time} - {template.end_time} • {template.session_type.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={template.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                        {template.status}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => openTemplateModal(template)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isUpdatingTemplateStatus}
                        onClick={() =>
                          updateTemplateStatus({
                            id: template.id,
                            status: template.status === "active" ? "inactive" : "active",
                          })
                        }
                      >
                        {template.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "rfid-checker" && (
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="text-xl">RFID Checker</CardTitle>
              <CardDescription>
                Validate if an RFID card is registered. This does not record a scan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  ref={checkerInputRef}
                  placeholder="Enter RFID code"
                  value={checkerCode}
                  onChange={(event) => {
                    setCheckerCode(event.target.value);
                    setCheckerError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCheckCard();
                    }
                  }}
                />
                <Button onClick={handleCheckCard} disabled={isCheckingCard}>
                  {isCheckingCard ? "Checking" : "Check"}
                </Button>
              </div>
              {checkerError && (
                <div className="rounded-lg border border-rose-300 bg-rose-50/70 p-3 text-xs text-rose-700">
                  {checkerError}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={isTemplateModalOpen}
        onOpenChange={(open) => {
          setIsTemplateModalOpen(open);
          if (!open) {
            setEditingTemplate(null);
            resetTemplateForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
            <DialogDescription>
              Configure a reusable RFID session template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Template Name</Label>
              <Input
                value={templateForm.name}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Morning IN"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-sm">Period</Label>
                <Select
                  value={templateForm.period}
                  onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, period: value as "morning" | "afternoon" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Session Type</Label>
                <Select
                  value={templateForm.session_type}
                  onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, session_type: value as "entry" | "exit" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry (IN)</SelectItem>
                    <SelectItem value="exit">Exit (OUT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-sm">Start Time</Label>
                <Input
                  type="time"
                  value={templateForm.start_time}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, start_time: event.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm">End Time</Label>
                <Input
                  type="time"
                  value={templateForm.end_time}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, end_time: event.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">Status</Label>
              <Select
                value={templateForm.status}
                onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, status: value as "active" | "inactive" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={isCreatingTemplate || isUpdatingTemplate}
              >
                {isCreatingTemplate || isUpdatingTemplate ? "Saving" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CommunicationLoadingModal
        isOpen={smsModalOpen}
        isSuccess={smsModalSuccess}
        isError={smsModalError}
        type="sms"
        loadingMessage={smsModalMessage}
        successMessage={smsModalMessage}
        errorMessage={smsModalMessage}
        helperText={smsModalHelper}
        onComplete={handleSmsModalComplete}
        autoCloseDuration={2500}
      />

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
            <DialogTitle>{detailsMode === "checker" ? "RFID Card Details" : "Scan Details"}</DialogTitle>
            <DialogDescription>
              {detailsMode === "checker"
                ? "Registered RFID card information"
                : "RFID scan record information"}
            </DialogDescription>
          </DialogHeader>

          {detailsMode === "scan" && currentScan && (
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

          {detailsMode === "checker" && checkerDetails && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Student Name
                </p>
                <p className="text-lg font-semibold">
                  {checkerDetails.student_name || "Unknown"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">RFID Code</p>
                <p className="font-mono text-sm bg-muted/50 p-2 rounded">
                  {checkerDetails.rfid_code}
                </p>
              </div>
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
              Enter your account password to unlock the screen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Admin Password</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="Enter your password"
              />
              {adminPasswordError && (
                <p className="text-xs text-rose-600 mt-1">{adminPasswordError}</p>
              )}
            </div>
            <Button onClick={verifyExitAdminPassword} disabled={isVerifying} className="w-full">
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
            {activeSession && (
              <div className="text-xs text-white/70">
                Active Session: {activeSession.label} ({activeSession.session_type.toUpperCase()})
              </div>
            )}
            {cameraError && (
              <p className="text-xs text-rose-200">{cameraError}</p>
            )}
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
              {activeSession && (
                <p className="text-xs text-white/60">
                  Scan type: {activeSession.session_type.toUpperCase()}
                </p>
              )}
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
