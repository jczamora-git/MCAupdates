import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { createWorker } from "tesseract.js";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Crosshair,
  Coins,
  ImageIcon,
  Loader2,
  QrCode,
  Scan,
  Smartphone,
  User,
  XCircle,
  ZoomIn,
} from "lucide-react";
import { API_ENDPOINTS, apiGet, apiPut } from "@/lib/api";
import gcashQR from "@/assets/images/Gcash-qr.jpg";
import { FeatureGate } from "@/components/FeatureGate";

type OcrStatus = "idle" | "running" | "found" | "not_found";
type SelectionRect = { x: number; y: number; w: number; h: number };

export default function GcashSessionPage() {
  const { token } = useParams<{ token: string }>();
  const runtimeBasePath = (() => {
    const viteBase = String(import.meta.env.BASE_URL || "/");
    if (viteBase !== "/") return viteBase;
    const path = window.location.pathname || "/";
    if (path === "/ui" || path.startsWith("/ui/")) return "/ui/";
    return "/";
  })();
  const paymentProofUrl = token
    ? new URL(`${runtimeBasePath}payment-proof/${token}`, window.location.origin).toString()
    : "";

  // session / upload
  const [uploadStatus, setUploadStatus] = useState<"waiting" | "uploaded">("waiting");
  const [proofFileUrl, setProofFileUrl] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    student_name: string;
    installment_number: number;
    amount_due: number;
    payment_description?: string;
  } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // cashier panel toggle (collapsed by default)
  const [showCashierDetails, setShowCashierDetails] = useState(false);

  // cashier QR modal + zoom/pan
  const [showQRModal, setShowQRModal] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchDistance, setTouchDistance] = useState(0);
  const [lastTap, setLastTap] = useState(0);
  const [tapCount, setTapCount] = useState(0);

  // OCR
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [referenceNumber, setReferenceNumber] = useState("");

  // selection / crop tool
  const [showSelectionTool, setShowSelectionTool] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState<{ x: number; y: number } | null>(null);
  const [selCurrent, setSelCurrent] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [selOcrStatus, setSelOcrStatus] = useState<"idle" | "running" | "done">("idle");
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);  const [selOcrRawText, setSelOcrRawText] = useState<string>("");
  const proofImgRef = useRef<HTMLImageElement>(null);
  const selContainerRef = useRef<HTMLDivElement>(null);

  // ── session load + polling ───────────────────────────────────
  useEffect(() => {
    if (!token) return;

    // Helper: apply an uploaded/viewed result
    const applyUploaded = (res: any) => {
      if (res.file_url) {
        setUploadStatus("uploaded");
        setProofFileUrl(res.file_url);
      }
    };

    // Helper: apply student info from any response that has it
    const applyInfo = (res: any) => {
      if (res?.success && res.student_name) {
        setSessionInfo({
          student_name: res.student_name,
          installment_number: Number(res.installment_number),
          amount_due: Number(res.amount_due),
          payment_description: res.payment_description,
        });
      }
    };

    // 1. Load student info AND check current status in parallel
    Promise.all([
      apiGet(API_ENDPOINTS.GCASH_SESSION_INFO(token)).catch(() => null),
      apiGet(API_ENDPOINTS.GCASH_SESSION_STATUS(token)).catch(() => null),
    ]).then(([infoRes, statusRes]) => {
      applyInfo(infoRes);
      applyInfo(statusRes); // status endpoint now also carries student info
      if (statusRes?.success && (statusRes.status === "uploaded" || statusRes.status === "viewed")) {
        applyUploaded(statusRes);
      }
    }).finally(() => setSessionLoading(false));

    // 2. Poll for new uploads (stops once proof is received)
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiGet(API_ENDPOINTS.GCASH_SESSION_STATUS(token));
        if (res.success && (res.status === "uploaded" || res.status === "viewed")) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          applyUploaded(res);
          if (res.status === "uploaded") {
            apiPut(API_ENDPOINTS.GCASH_SESSION_VIEWED(token), {}).catch(() => {});
          }
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [token]);

  // ── auto-OCR when proof arrives ──────────────────────────────
  useEffect(() => {
    if (proofFileUrl) runAutoOcr(proofFileUrl);
  }, [proofFileUrl]);

  const extractGcashRef = (text: string): string => {
    // 1. GCash receipt label: "Ref. No. 0396 0081 23456" or "Ref No. 039600812…"
    //    This is the highest-confidence match — use it first.
    const refNoMatch = text.match(/Ref\.?\s*No\.?\s*([\d][\d\s]{8,18})/i);
    if (refNoMatch) {
      const digits = refNoMatch[1].replace(/\s/g, "");
      if (digits.length >= 8) return digits;
    }

    // 2. Solid 13-digit run
    const solid = text.match(/\b(\d{13})\b/);
    if (solid) return solid[1];

    // 3. Strip all non-digits, slide a 13-char window
    const allDigits = text.replace(/[^\d]/g, "");
    for (let i = 0; i <= allDigits.length - 13; i++) {
      const c = allDigits.slice(i, i + 13);
      if (/^\d{13}$/.test(c)) return c;
    }

    // 4. Spaced-digit groups concatenating to 13
    const groups = [...text.matchAll(/(\d[\d ]{10,16}\d)/g)];
    for (const g of groups) {
      const d = g[1].replace(/\s/g, "");
      if (d.length === 13) return d;
    }

    // 5. Fallback — return all digits if ≥8 found (admin can correct)
    return allDigits.length >= 8 ? allDigits : "";
  };

  const broadcastRef = (ref: string) => {
    if (!token) return;
    try {
      localStorage.setItem(
        `gcash_proof_${token}`,
        JSON.stringify({ ocr_reference: ref, file_url: proofFileUrl })
      );
    } catch { /* storage unavailable */ }
  };

  const runAutoOcr = async (url: string) => {
    setOcrStatus("running");
    setOcrProgress(0);
    try {
      const worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text")
            setOcrProgress(Math.round((m.progress || 0) * 100));
        },
      });
      const { data: { text } } = await worker.recognize(url);
      await worker.terminate();
      const ref = extractGcashRef(text);
      if (ref) {
        setReferenceNumber(ref);
        setOcrStatus("found");
        broadcastRef(ref);
      } else {
        setOcrStatus("not_found");
      }
    } catch {
      setOcrStatus("not_found");
    }
  };

  // ── selection crop OCR ───────────────────────────────────────

  // Clamp and return position relative to the rendered image.
  // Uses img.getBoundingClientRect() directly — works correctly with
  // any scroll container and needs no letterbox offset math.
  const getRelPos = (clientX: number, clientY: number) => {
    const img = proofImgRef.current;
    if (!img) return { x: 0, y: 0 };
    const r = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(clientX - r.left, r.width)),
      y: Math.max(0, Math.min(clientY - r.top,  r.height)),
    };
  };

  const onSelMD = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = getRelPos(e.clientX, e.clientY);
    setIsSelecting(true); setSelStart(p); setSelCurrent(p); setSelection(null); setCropPreviewUrl(null); setSelOcrRawText("");
  };
  const onSelMM = (e: React.MouseEvent) => {
    if (!isSelecting || !selStart) return;
    setSelCurrent(getRelPos(e.clientX, e.clientY));
  };

  // Generate an upscaled crop (3×) using img.getBoundingClientRect() for accuracy
  const generateCropPreview = (rect: SelectionRect) => {
    const img = proofImgRef.current;
    if (!img) return;
    const rendRect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth  / rendRect.width;
    const scaleY = img.naturalHeight / rendRect.height;
    const ZOOM = 3;
    const srcX = Math.round(rect.x * scaleX);
    const srcY = Math.round(rect.y * scaleY);
    const srcW = Math.max(1, Math.round(rect.w * scaleX));
    const srcH = Math.max(1, Math.round(rect.h * scaleY));
    const canvas = document.createElement("canvas");
    canvas.width  = srcW * ZOOM;
    canvas.height = srcH * ZOOM;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    setCropPreviewUrl(canvas.toDataURL("image/png"));
  };

  const onSelMU = (e: React.MouseEvent) => {
    if (!isSelecting || !selStart) return;
    const end = getRelPos(e.clientX, e.clientY);
    const x = Math.min(selStart.x, end.x), y = Math.min(selStart.y, end.y);
    const w = Math.abs(end.x - selStart.x), h = Math.abs(end.y - selStart.y);
    if (w > 10 && h > 10) { const r = { x, y, w, h }; setSelection(r); generateCropPreview(r); }
    setIsSelecting(false); setSelStart(null); setSelCurrent(null);
  };
  const onSelTS = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    const p = getRelPos(t.clientX, t.clientY);
    setIsSelecting(true); setSelStart(p); setSelCurrent(p); setSelection(null); setCropPreviewUrl(null); setSelOcrRawText("");
  };
  const onSelTM = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isSelecting || !selStart) return;
    setSelCurrent(getRelPos(e.touches[0].clientX, e.touches[0].clientY));
  };
  const onSelTE = (e: React.TouchEvent) => {
    if (!isSelecting || !selStart) return;
    const t = e.changedTouches[0];
    const end = getRelPos(t.clientX, t.clientY);
    const x = Math.min(selStart.x, end.x), y = Math.min(selStart.y, end.y);
    const w = Math.abs(end.x - selStart.x), h = Math.abs(end.y - selStart.y);
    if (w > 10 && h > 10) { const r = { x, y, w, h }; setSelection(r); generateCropPreview(r); }
    setIsSelecting(false); setSelStart(null); setSelCurrent(null);
  };

  const runSelectionOcr = async () => {
    if (!selection || !cropPreviewUrl) return;
    setSelOcrStatus("running");
    setSelOcrRawText("");
    try {
      const worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text")
            setOcrProgress(Math.round((m.progress || 0) * 100));
        },
      });
      const { data: { text } } = await worker.recognize(cropPreviewUrl);
      await worker.terminate();
      const cleaned = text.trim();
      setSelOcrRawText(cleaned);
      const raw = extractGcashRef(cleaned);
      const digitsOnly = raw.replace(/\D/g, "");
      if (digitsOnly.length > 0) {
        setReferenceNumber(digitsOnly);
        broadcastRef(digitsOnly);
        setOcrStatus("found");
      } else {
        const fallback = cleaned.replace(/[^\d]/g, "");
        if (fallback.length > 0) {
          setReferenceNumber(fallback);
          broadcastRef(fallback);
        }
        setOcrStatus("not_found");
      }
      setSelOcrStatus("done");
      setShowSelectionTool(false);
      setSelection(null);
    } catch { setSelOcrStatus("done"); }
  };

  // ── QR modal zoom/pan ────────────────────────────────────────
  const openQRModal = () => { setShowQRModal(true); setZoom(1); setPanX(0); setPanY(0); };
  const closeQRModal = () => { setShowQRModal(false); setZoom(1); setPanX(0); setPanY(0); };
  const handleDoubleClick = () => {
    if (zoom === 1) { setZoom(2); } else { setZoom(1); setPanX(0); setPanY(0); }
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return; e.preventDefault();
    setIsDragging(true); setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    const m = 150;
    setPanX(Math.max(-m, Math.min(m, e.clientX - dragStart.x)));
    setPanY(Math.max(-m, Math.min(m, e.clientY - dragStart.y)));
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((p) => Math.min(Math.max(p * (e.deltaY > 0 ? 0.9 : 1.1), 1), 3));
  };
  const getTouchDist = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return 0;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) { e.preventDefault(); setTouchDistance(getTouchDist(e)); }
    else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300 && tapCount > 0) {
        e.preventDefault();
        if (zoom === 1) { setZoom(2); } else { setZoom(1); setPanX(0); setPanY(0); }
        setTapCount(0); setLastTap(0);
      } else {
        const t = e.touches[0];
        setIsDragging(true); setDragStart({ x: t.clientX - panX, y: t.clientY - panY });
        setLastTap(now); setTapCount((p) => p + 1);
      }
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const cur = getTouchDist(e);
      if (touchDistance > 0) setZoom((p) => Math.min(Math.max(p * (cur / touchDistance), 1), 3));
      setTouchDistance(cur);
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      const t = e.touches[0]; const m = 150;
      setPanX(Math.max(-m, Math.min(m, t.clientX - dragStart.x)));
      setPanY(Math.max(-m, Math.min(m, t.clientY - dragStart.y)));
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) setTouchDistance(0);
    if (e.touches.length === 0) setIsDragging(false);
  };

  // ── derived selection rect for rendering ────────────────────
  const displaySelRect: SelectionRect | null = (() => {
    if (isSelecting && selStart && selCurrent) {
      return {
        x: Math.min(selStart.x, selCurrent.x), y: Math.min(selStart.y, selCurrent.y),
        w: Math.abs(selCurrent.x - selStart.x), h: Math.abs(selCurrent.y - selStart.y),
      };
    }
    return selection;
  })();

  return (
    <FeatureGate feature="payment" showComingSoon>
      <DashboardLayout>
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">

        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shrink-0">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GCash Collection Session</h1>
            <p className="text-sm text-muted-foreground">
              Present the upload QR to the student — their screenshot and reference number will appear here automatically.
            </p>
          </div>
        </div>

        {/* ── Session Info Banner ──────────────────────────────── */}
        {sessionLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading session…
          </div>
        ) : sessionInfo ? (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500 shrink-0" />
              <div>
                <p className="text-[11px] text-blue-500 uppercase font-semibold tracking-wide">Student</p>
                <p className="font-bold text-blue-900 text-sm">{sessionInfo.student_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-blue-500 shrink-0" />
              <div>
                <p className="text-[11px] text-blue-500 uppercase font-semibold tracking-wide">Amount Due</p>
                <p className="font-bold text-blue-900 text-sm">
                  ₱{sessionInfo.amount_due.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-blue-500 shrink-0" />
              <div>
                <p className="text-[11px] text-blue-500 uppercase font-semibold tracking-wide">
                  {sessionInfo.payment_description ? "Payment" : "Installment"}
                </p>
                <p className="font-bold text-blue-900 text-sm">
                  {sessionInfo.payment_description ? sessionInfo.payment_description : `#${sessionInfo.installment_number}`}
                </p>
              </div>
            </div>
            <div className="ml-auto">
              <Badge className={uploadStatus === "uploaded"
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-amber-100 text-amber-800 border-amber-200"}>
                {uploadStatus === "uploaded" ? "✓ Proof Uploaded" : "⏳ Waiting…"}
              </Badge>
            </div>
          </div>
        ) : null}

        {/* ── Main body ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ══ LEFT: Cashier details (toggleable) + Upload QR ══ */}
          <div className="lg:col-span-2 space-y-3">

            {/* Cashier panel toggle */}
            <button
              onClick={() => setShowCashierDetails((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm">
                <Smartphone className="h-4 w-4" />
                Cashier GCash Details
              </div>
              <div className="flex items-center gap-1.5 text-blue-600 text-xs">
                {showCashierDetails ? "Hide" : "Show"}
                {showCashierDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </div>
            </button>

            {showCashierDetails && (
              <Card className="border-0 shadow-md">
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <CardTitle className="text-xs text-blue-700 font-semibold uppercase tracking-wide">
                    Student scans this to send GCash payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Cashier QR — click to expand */}
                  <div className="flex justify-center">
                    <div
                      className="relative bg-white p-3 rounded-xl border-2 border-gray-200 shadow cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group"
                      onClick={openQRModal}
                      title="Click to expand"
                    >
                      <img
                        src={gcashQR}
                        alt="Cashier GCash QR"
                        className="w-44 h-44 object-contain"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 group-hover:bg-black/10 transition-colors">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow">
                          <ZoomIn className="h-4 w-4 text-gray-700" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-center text-blue-600 font-medium cursor-pointer hover:underline" onClick={openQRModal}>
                    Click to view full size
                  </p>
                  <div className="rounded-lg border bg-gray-50 divide-y text-sm">
                    <div className="px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Receiver Name</p>
                      <p className="font-semibold text-gray-800 mt-0.5">JO*N CH********R KI*G Z.</p>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Mobile Number</p>
                      <p className="font-semibold text-gray-800 mt-0.5">+63 994 909 8150</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upload QR (always visible) */}
            <Card className="border-0 shadow-md">
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                <CardTitle className="text-sm flex items-center gap-2 text-gray-700">
                  <QrCode className="h-4 w-4" />
                  Proof Upload QR
                </CardTitle>
                <p className="text-xs text-muted-foreground">Student scans to submit their GCash screenshot</p>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {uploadStatus === "waiting" ? (
                  <>
                    <div className="flex justify-center p-3 bg-white rounded-xl border-2 border-dashed border-gray-300">
                      {token ? (
                        <QRCodeSVG
                          value={paymentProofUrl}
                          size={180}
                          level="M"
                          includeMargin
                        />
                      ) : (
                        <div className="w-[180px] h-[180px] flex items-center justify-center">
                          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Waiting for student upload…
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Session expires in 30 minutes
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-green-700 font-medium text-sm py-2">
                    <CheckCircle className="h-5 w-5 shrink-0" />
                    Screenshot received!
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ══ RIGHT: Proof image + OCR ══ */}
          <div className="lg:col-span-3">
            {uploadStatus === "waiting" ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 gap-3">
                <ImageIcon className="h-12 w-12 opacity-30" />
                <p className="text-sm font-medium">Proof of payment will appear here</p>
                <p className="text-xs">Waiting for student to upload their GCash screenshot…</p>
              </div>
            ) : (
              <Card className="border-0 shadow-md">
                <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      Payment Screenshot
                    </CardTitle>
                    {ocrStatus === "running" && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Analyzing… {ocrProgress}%
                      </div>
                    )}
                    {ocrStatus === "found" && (
                      <div className="flex items-center gap-1 text-xs text-green-700 font-medium">
                        <CheckCircle className="h-3 w-3" /> Reference auto-detected
                      </div>
                    )}
                    {ocrStatus === "not_found" && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <AlertCircle className="h-3 w-3" /> Could not auto-detect
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">

                  {/* ── Proof image / selection tool ── */}
                  {proofFileUrl && (
                    showSelectionTool ? (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                          <Crosshair className="h-3.5 w-3.5" />
                          Drag a box around the reference number, then click "Extract"
                        </p>
                        <div className="overflow-y-auto max-h-[28rem] rounded-lg border border-blue-300 select-none">
                          <div
                            ref={selContainerRef}
                            className="relative select-none"
                            style={{ cursor: "crosshair" } as React.CSSProperties}
                            onMouseDown={onSelMD}
                            onMouseMove={onSelMM}
                            onMouseUp={onSelMU}
                            onMouseLeave={(e) => { if (isSelecting) onSelMU(e as React.MouseEvent); }}
                            onTouchStart={onSelTS}
                            onTouchMove={onSelTM}
                            onTouchEnd={onSelTE}
                          >
                            <img
                              ref={proofImgRef}
                              src={proofFileUrl}
                              alt="GCash proof"
                              className="w-full h-auto block"
                              draggable={false}
                              onDragStart={(e) => e.preventDefault()}
                            />
                          {/* Selection rectangle */}
                          {displaySelRect && displaySelRect.w > 0 && displaySelRect.h > 0 && (
                            <div
                              className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
                              style={{
                                left: displaySelRect.x,
                                top: displaySelRect.y,
                                width: displaySelRect.w,
                                height: displaySelRect.h,
                              } as React.CSSProperties}
                            >
                              {[{ top: -3, left: -3 }, { top: -3, right: -3 }, { bottom: -3, left: -3 }, { bottom: -3, right: -3 }].map((s, i) => (
                                <div key={i} className="absolute w-2 h-2 bg-blue-500 rounded-sm" style={s as React.CSSProperties} />
                              ))}
                            </div>
                          )}
                          </div>{/* closes selContainerRef */}
                        </div>{/* closes overflow-y-auto */}
                        {/* ── Crop preview ── */}
                        {cropPreviewUrl && (
                          <div className="rounded-lg border-2 border-blue-300 bg-blue-50 overflow-hidden">
                            <div className="px-3 py-1.5 bg-blue-100 border-b border-blue-200 flex items-center gap-1.5">
                              <Scan className="h-3 w-3 text-blue-600" />
                              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">Selection preview (3× zoom)</span>
                            </div>
                            <div className="p-2 overflow-auto max-h-36 flex items-center justify-center bg-white">
                              <img
                                src={cropPreviewUrl}
                                alt="Crop preview"
                                className="max-w-full object-contain"
                                style={{ imageRendering: "pixelated" } as React.CSSProperties}
                              />
                            </div>
                            {selOcrRawText ? (
                              <div className="px-3 py-2 border-t border-blue-200 bg-blue-50">
                                <p className="text-[10px] text-blue-500 uppercase font-semibold tracking-wide mb-0.5">OCR read</p>
                                <p className="text-xs font-mono text-blue-900 break-all">{selOcrRawText}</p>
                              </div>
                            ) : null}
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={runSelectionOcr}
                            disabled={!selection || selOcrStatus === "running"}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            {selOcrStatus === "running"
                              ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Extracting…</>
                              : <><Scan className="h-3.5 w-3.5 mr-1.5" />Extract from selection</>}
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => { setShowSelectionTool(false); setSelection(null); setSelOcrStatus("idle"); setCropPreviewUrl(null); setSelOcrRawText(""); }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />Cancel
                          </Button>
                          {!selection && <span className="text-xs text-muted-foreground">Draw a selection first</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border overflow-y-auto max-h-[28rem]">
                        <img
                          ref={proofImgRef}
                          src={proofFileUrl}
                          alt="GCash proof of payment"
                          className="w-full h-auto block"
                        />
                      </div>
                    )
                  )}

                  {/* ── OCR progress bar ── */}
                  {ocrStatus === "running" && (
                    <div className="w-full bg-blue-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-150"
                        style={{ width: `${ocrProgress}%` } as React.CSSProperties}
                      />
                    </div>
                  )}

                  {/* ── Reference number field ── */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      GCash Reference Number
                      {ocrStatus === "found" && referenceNumber && (
                        <span className="text-xs font-normal text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> auto-detected
                        </span>
                      )}
                    </label>
                    <Input
                      value={referenceNumber}
                      onChange={(e) => { setReferenceNumber(e.target.value); broadcastRef(e.target.value); }}
                      placeholder="13-digit GCash reference"
                      className="font-mono text-center text-lg tracking-widest"
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground">
                      Edits are sent to the payment form automatically.
                    </p>
                  </div>

                  {/* ── Manual selection CTA ── */}
                  {(ocrStatus === "not_found" || (ocrStatus === "found" && !referenceNumber)) && !showSelectionTool && (
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-amber-800 font-medium mb-2">
                          Could not auto-detect reference number. Draw a box around it manually.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-400 text-amber-700 hover:bg-amber-100 h-7 text-xs"
                          onClick={() => setShowSelectionTool(true)}
                        >
                          <Crosshair className="h-3.5 w-3.5 mr-1.5" />
                          Select area manually
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── Re-select option after auto-detect ── */}
                  {ocrStatus === "found" && referenceNumber && !showSelectionTool && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSelectionTool(true)}
                    >
                      <Crosshair className="h-3.5 w-3.5 mr-1.5" />
                      Select area manually instead
                    </Button>
                  )}

                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ── Cashier QR full-screen modal ────────────────────────── */}
      <Dialog open={showQRModal} onOpenChange={closeQRModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>GCash QR Code — Double-click to zoom, drag to move</DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 flex items-center justify-center overflow-hidden bg-gray-100 rounded-lg touch-none"
            style={{ userSelect: "none", cursor: zoom > 1 ? "grab" : "pointer" } as React.CSSProperties}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={gcashQR}
              alt="GCash QR Code - Full Size"
              className="object-contain select-none"
              draggable={false}
              onDoubleClick={handleDoubleClick}
              onDragStart={(e) => e.preventDefault()}
              style={{
                transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
                transition: isDragging ? "none" : "transform 0.2s ease-out",
                maxWidth: "100%",
                maxHeight: "100%",
                WebkitUserDrag: "none",
              } as React.CSSProperties}
            />
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t flex-wrap">
            <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            <span>•</span>
            <span className="hidden sm:inline">Double-click to zoom · Scroll to zoom · Drag to move</span>
            <span className="sm:hidden">Double-tap · Pinch · Drag</span>
          </div>
        </DialogContent>
      </Dialog>
      </DashboardLayout>
    </FeatureGate>
  );
}
