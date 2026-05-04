import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface CommunicationLoadingModalProps {
  isOpen: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  type?: "email" | "sms" | "notification" | "custom";
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string;
  helperText?: string;
  onComplete?: () => void;
  autoCloseDuration?: number;
}

const CommunicationLoadingModal = ({
  isOpen,
  isSuccess = false,
  isError = false,
  type = "custom",
  loadingMessage,
  successMessage,
  errorMessage,
  helperText,
  onComplete,
  autoCloseDuration = 2500,
}: CommunicationLoadingModalProps) => {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (isSuccess) {
      setTitle(successMessage || getDefaultSuccess(type));
      setDetail(helperText || "");
      return;
    }

    if (isError) {
      setTitle(errorMessage || getDefaultError(type));
      setDetail(helperText || "");
      return;
    }

    setTitle(loadingMessage || getDefaultLoading(type));
    setDetail(helperText || getDefaultHelper(type));
  }, [type, isSuccess, isError, loadingMessage, successMessage, errorMessage, helperText]);

  useEffect(() => {
    if ((isSuccess || isError) && autoCloseDuration > 0) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, isError, autoCloseDuration, onComplete]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onComplete?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="flex items-center justify-center w-full max-w-lg p-0 border-0 bg-gradient-to-br from-background to-muted/20 shadow-2xl rounded-2xl">
        <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center space-y-6">
          {!isSuccess && !isError ? (
            <>
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 animate-pulse"></div>
                <div className="relative w-20 h-20">
                  <svg
                    className="animate-spin"
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="url(#commGradient)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray="141 282"
                    />
                    <defs>
                      <linearGradient id="commGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--accent))" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">{title}</p>
                {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                <span className="w-2 h-2 bg-success rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
              </div>
            </>
          ) : (
            <>
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className={`absolute inset-0 rounded-full ${isError ? "bg-rose-500/10" : "bg-success/10"} animate-pulse`}></div>
                <div className={`relative w-20 h-20 rounded-full ${isError ? "bg-rose-500" : "bg-gradient-to-br from-success to-emerald-500"} flex items-center justify-center shadow-lg`}>
                  {isError ? (
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="animate-in zoom-in duration-500"
                    >
                      <path d="M6 6l12 12M18 6l-12 12" stroke="#7f1d1d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="animate-in zoom-in duration-500"
                    >
                      <path d="M20 6L9 17l-5-5" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className={`text-xl font-bold ${isError ? "text-rose-600" : "text-success"}`}>{isError ? "Notice" : "Success"}</p>
                <p className="text-base text-foreground">{title}</p>
                {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const getDefaultLoading = (type: CommunicationLoadingModalProps["type"]) => {
  switch (type) {
    case "email":
      return "Sending email...";
    case "sms":
      return "Sending SMS notification...";
    case "notification":
      return "Sending notification...";
    default:
      return "Sending message...";
  }
};

const getDefaultHelper = (type: CommunicationLoadingModalProps["type"]) => {
  switch (type) {
    case "sms":
      return "Please wait while we notify the parent/guardian.";
    default:
      return "Please wait while we process your request.";
  }
};

const getDefaultSuccess = (type: CommunicationLoadingModalProps["type"]) => {
  switch (type) {
    case "email":
      return "Email sent successfully";
    case "sms":
      return "SMS sent successfully";
    case "notification":
      return "Notification sent";
    default:
      return "Message sent";
  }
};

const getDefaultError = (type: CommunicationLoadingModalProps["type"]) => {
  switch (type) {
    case "email":
      return "Email failed to send";
    case "sms":
      return "SMS failed to send";
    case "notification":
      return "Notification failed";
    default:
      return "Message failed";
  }
};

export default CommunicationLoadingModal;
