/**
 * PaymentProofUpload.tsx
 *
 * PUBLIC page — no authentication required.
 * Accessed by the student/parent after scanning the QR code from the cashier.
 *
 * Steps:
 *  1. Load session info (installment details)
 *  2. Let user pick a GCash screenshot
 *  3. Preview + confirm the file
 *  4. POST file to backend (reference extraction happens on admin side)
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Upload, FileImage, Loader2 } from 'lucide-react';
import { FeatureComingSoon } from '@/components/FeatureGate';
import { isFeatureEnabled } from '@/config/features';

type SessionInfo = {
  student_name: string;
  installment_number: number;
  payment_description?: string | null;
  amount_due: string | number;
  expires_at: string;
  status: string;
};

type Stage =
  | 'loading'        // fetching session info
  | 'ready'          // display form
  | 'confirming'     // file selected, user confirms
  | 'uploading'      // submitting to server
  | 'done'           // success
  | 'already_done'   // already uploaded
  | 'expired'        // token expired
  | 'error';         // generic error

export default function PaymentProofUpload() {
  const { token } = useParams<{ token: string }>();

  const [stage, setStage] = useState<Stage>('loading');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // File / preview
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isFeatureEnabled("payment")) {
    return <FeatureComingSoon featureName="Payment" />;
  }

  // ── Load session info ──────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStage('error'); setErrorMsg('Invalid link'); return; }
    fetchSessionInfo();
  }, [token]);

  const fetchSessionInfo = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/gcash-sessions/${token}/info`);
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {
        // PHP returned an HTML error page — surface a useful message
        setErrorMsg('Server error. Please ask the cashier for a new link.');
        setStage('error');
        return;
      }

      if (!data.success) {
        if (res.status === 410) { setStage('expired'); return; }
        if (data.status === 'uploaded' || data.status === 'viewed') { setStage('already_done'); return; }
        setErrorMsg(data.message || 'Invalid link');
        setStage('error');
        return;
      }

      if (data.status === 'uploaded' || data.status === 'viewed') {
        setStage('already_done');
        return;
      }

      setSession(data);
      setStage('ready');
    } catch {
      setErrorMsg('Could not connect to server. Please check your internet connection.');
      setStage('error');
    }
  };

  // ── File selection ─────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setStage('confirming');
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!file) return;
    setStage('uploading');

    try {
      const form = new FormData();
      form.append('proof_of_payment', file);

      const res = await fetch(`${API_BASE_URL}/api/gcash-sessions/${token}/upload`, {
        method: 'POST',
        body: form,
      });

      const data = await res.json();
      if (data.success) {
        setStage('done');
      } else {
        setErrorMsg(data.message || 'Upload failed. Please try again.');
        setStage('confirming');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStage('confirming');
    }
  };


  // ─────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────
  const formatAmount = (v: string | number | undefined) =>
    v ? `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '';

  const paymentLabel = (session: SessionInfo) => {
    const customPayment = (session.payment_description || '').trim();
    if (customPayment) return customPayment;
    if (session.installment_number > 0) return `Installment #${session.installment_number}`;
    return 'General Payment';
  };

  // ── Done ──────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-green-700">Upload Successful!</h2>
          <p className="text-gray-600">
            Your GCash proof of payment has been sent to the cashier.
            They will verify and complete your payment record shortly.
          </p>
          <p className="text-sm text-gray-400">You may now close this page.</p>
        </div>
      </PageShell>
    );
  }

  if (stage === 'already_done') {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-blue-400 mx-auto" />
          <h2 className="text-xl font-bold">Already Uploaded</h2>
          <p className="text-gray-600">Proof of payment was already submitted for this session.</p>
        </div>
      </PageShell>
    );
  }

  if (stage === 'expired') {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-red-600">Link Expired</h2>
          <p className="text-gray-600">This QR code link has expired (30-minute limit).</p>
          <p className="text-gray-500 text-sm">Please ask the cashier to generate a new QR code.</p>
        </div>
      </PageShell>
    );
  }

  if (stage === 'error') {
    return (
      <PageShell>
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-red-600">Error</h2>
          <p className="text-gray-600">{errorMsg || 'Something went wrong.'}</p>
        </div>
      </PageShell>
    );
  }

  if (stage === 'loading') {
    return (
      <PageShell>
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 mx-auto animate-spin mb-3" />
          <p className="text-gray-500">Loading payment information…</p>
        </div>
      </PageShell>
    );
  }

  // ── Main form ─────────────────────────────────────────────────
  return (
    <PageShell>
      {/* Header */}
      <div className="text-center mb-6">
        <img src="/icon-192x192.png" alt="Logo" className="w-16 h-16 mx-auto mb-3 rounded-full shadow" />
        <h1 className="text-2xl font-bold text-blue-700">Upload GCash Proof</h1>
        <p className="text-sm text-gray-500 mt-1">Maranatha Christian Academy</p>
      </div>

      {/* Payment details */}
      {session && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 space-y-1">
          <p className="text-sm text-blue-600 font-semibold">Payment Details</p>
          <p className="text-xs text-gray-500">Student</p>
          <p className="font-bold text-gray-800">{session.student_name}</p>
          <p className="text-xs text-gray-500 mt-2">Amount Due</p>
          <p className="font-semibold text-blue-700">{formatAmount(session.amount_due)}</p>
          <p className="text-xs text-gray-500 mt-2">Payment</p>
          <p className="text-sm text-gray-700">{paymentLabel(session)}</p>
          <p className="text-xs text-gray-400">
            Session expires: {new Date(session.expires_at).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* File picker */}
      {(stage === 'ready' || stage === 'confirming') && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-blue-300 rounded-xl p-6 text-center cursor-pointer hover:bg-blue-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <div className="space-y-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-48 mx-auto rounded-lg shadow object-contain"
                />
                <p className="text-sm text-blue-600 font-medium">{file?.name}</p>
                <p className="text-xs text-gray-400">Tap to change</p>
              </div>
            ) : (
              <div className="space-y-2">
                <FileImage className="w-12 h-12 text-blue-300 mx-auto" />
                <p className="font-medium text-blue-700">Tap to select your GCash screenshot</p>
                <p className="text-xs text-gray-400">JPG, PNG or PDF · Max 8 MB</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            aria-label="Upload GCash proof of payment"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Error */}
          {errorMsg && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          {stage === 'confirming' && file && (
            <Button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold py-3 text-base"
            >
              <Upload className="w-5 h-5 mr-2" />
              Send Proof of Payment
            </Button>
          )}
        </div>
      )}

      {/* Uploading spinner */}
      {stage === 'uploading' && (
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-blue-500 mx-auto animate-spin" />
          <p className="text-gray-600 font-medium">Sending to cashier…</p>
        </div>
      )}
    </PageShell>
  );
}

/** Simple full-page wrapper for the public upload page */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-start justify-center p-4 pt-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        {children}
      </div>
    </div>
  );
}
