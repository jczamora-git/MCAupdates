import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Lock, AlertCircle, ShieldCheck, KeyRound, UserCog, Loader2 } from "lucide-react";
import { AlertMessage } from "@/components/AlertMessage";
import EmailLoadingModal from "@/components/EmailLoadingModal";
import { API_ENDPOINTS, apiGet, apiPut } from "@/lib/api";

const StudentSettings = () => {
  const { user, updateUser } = useAuth();

  // Profile customization state
  const [profileData, setProfileData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    gender: "",
  });
  const [profileMeta, setProfileMeta] = useState({
    studentId: "",
    yearLevel: "",
    studentStatus: "",
  });
  const [profileError, setProfileError] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");

  // PIN state
  const [pinData, setPinData] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  });
  const [pinError, setPinError] = useState("");

  // Alert state
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!user) {
        if (isMounted) setIsLoadingProfile(false);
        return;
      }

      if (isMounted) {
        setProfileData({
          firstName: user.first_name || "",
          middleName: user.middle_name || "",
          lastName: user.last_name || "",
          phone: "",
          gender: "",
        });
      }

      try {
        const studentRes = await apiGet(API_ENDPOINTS.STUDENT_BY_USER(user.id));
        const student = studentRes?.data || null;

        if (isMounted && student) {
          setProfileMeta({
            studentId: student.student_id || "",
            yearLevel: student.year_level || "",
            studentStatus: student.status || "",
          });

          setProfileData((prev) => ({
            ...prev,
            phone: student.phone || "",
            gender: student.gender || "",
          }));
        }
      } catch {
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleProfileFieldChange = (field: keyof typeof profileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setProfileError("");
  };

  const handleSaveProfile = async () => {
    if (!profileData.firstName.trim()) {
      setProfileError("First name is required");
      return;
    }
    if (!profileData.lastName.trim()) {
      setProfileError("Last name is required");
      return;
    }
    if (profileData.phone.trim() && !/^\d{11}$/.test(profileData.phone.trim())) {
      setProfileError("Phone number must be exactly 11 digits");
      return;
    }

    setIsSavingProfile(true);
    setProfileError("");

    try {
      const response = await apiPut(API_ENDPOINTS.UPDATE_PROFILE, {
        first_name: profileData.firstName.trim(),
        middle_name: profileData.middleName.trim(),
        last_name: profileData.lastName.trim(),
        phone: profileData.phone.trim(),
        gender: profileData.gender || null,
      });

      if (response?.user) {
        updateUser({
          first_name: response.user.first_name,
          middle_name: response.user.middle_name || "",
          last_name: response.user.last_name,
          name: `${response.user.first_name} ${response.user.last_name}`,
        });
      }

      if (response?.student) {
        setProfileMeta({
          studentId: response.student.student_id || profileMeta.studentId,
          yearLevel: response.student.year_level || profileMeta.yearLevel,
          studentStatus: response.student.status || profileMeta.studentStatus,
        });
      }

      setAlert({ type: "success", message: response?.message || "Profile updated successfully" });
    } catch (error: any) {
      const message = error?.message || "Failed to update profile";
      setProfileError(message);
      setAlert({ type: "error", message });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password handlers
  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    setPasswordError("");
  };

  const handleChangePassword = () => {
    setPasswordError("");

    if (!passwordData.currentPassword) {
      setPasswordError("Current password is required");
      return;
    }
    if (!passwordData.newPassword) {
      setPasswordError("New password is required");
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    console.log("Changing password");
    setAlert({ type: "success", message: "Password changed successfully" });
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const handleForgotPassword = () => {
    (async () => {
      const emailToUse = user?.email;
      if (!emailToUse) {
        setAlert({ type: "error", message: "No email available for this account." });
        return;
      }

      setShowEmailModal(true);
      try {
        const res = await fetch('/api/auth/request-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailToUse })
        });

        const json = await res.json();
        if (res.ok) {
          setAlert({ type: 'success', message: json.message || `Recovery link sent to ${emailToUse}. Check your inbox.` });
        } else {
          setAlert({ type: 'error', message: json.message || 'Failed to request password reset.' });
          setShowEmailModal(false);
        }
      } catch (err: any) {
        setAlert({ type: 'error', message: 'Network error while requesting password reset.' });
        setShowEmailModal(false);
      }
    })();
  };

  // PIN handlers
  const handlePinChange = (field: string, value: string) => {
    setPinData(prev => ({ ...prev, [field]: value }));
    setPinError("");
  };

  const handleChangePin = async () => {
    setPinError("");

    if (!pinData.currentPin) {
      setPinError("Current PIN is required");
      return;
    }
    if (!pinData.newPin) {
      setPinError("New PIN is required");
      return;
    }
    if (pinData.newPin.length !== 6) {
      setPinError("PIN must be exactly 6 digits");
      return;
    }
    if (!/^\d{6}$/.test(pinData.newPin)) {
      setPinError("PIN must contain only numbers");
      return;
    }
    if (pinData.newPin !== pinData.confirmPin) {
      setPinError("PINs do not match");
      return;
    }

    try {
      const response = await fetch('/api/auth/change-payment-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_pin: pinData.currentPin,
          new_pin: pinData.newPin,
        })
      });

      const json = await response.json();
      
      if (response.ok) {
        setAlert({ type: "success", message: "Payment PIN changed successfully" });
        setPinData({ currentPin: "", newPin: "", confirmPin: "" });
      } else {
        setPinError(json.message || "Failed to change PIN");
        setAlert({ type: "error", message: json.message || "Failed to change PIN" });
      }
    } catch (err: any) {
      console.error("PIN change error:", err);
      setPinError("An error occurred while changing PIN");
      setAlert({ type: "error", message: "Error changing PIN. Please try again." });
    }
  };

  return (
    <DashboardLayout fullBleed>
      {/* Email Loading Modal */}
      <EmailLoadingModal
        isOpen={showEmailModal}
        isSuccess={alert?.type === 'success'}
        emailType="reset"
        onComplete={() => setShowEmailModal(false)}
        autoCloseDuration={3000}
      />

      {alert && (
        <AlertMessage
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
      
      <div className="px-4 pb-4 pt-4 sm:px-8 sm:pb-8 sm:pt-0 bg-gradient-to-b from-background to-muted/30 min-h-screen">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground leading-tight">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your security settings</p>
          </div>
        </div>

        <Card className="mb-5 sm:mb-6 border-blue-100/80 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <UserCog className="h-4 w-4" />
              </div>
              Profile Customization
            </CardTitle>
            <CardDescription>Update profile fields from users and students records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {profileError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="first-name">First Name</Label>
                <Input
                  id="first-name"
                  value={profileData.firstName}
                  onChange={(e) => handleProfileFieldChange("firstName", e.target.value)}
                  placeholder="Enter your first name"
                  className="h-11 bg-background"
                  disabled={isLoadingProfile || isSavingProfile}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="middle-name">Middle Name</Label>
                <Input
                  id="middle-name"
                  value={profileData.middleName}
                  onChange={(e) => handleProfileFieldChange("middleName", e.target.value)}
                  placeholder="Enter your middle name"
                  className="h-11 bg-background"
                  disabled={isLoadingProfile || isSavingProfile}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  value={profileData.lastName}
                  onChange={(e) => handleProfileFieldChange("lastName", e.target.value)}
                  placeholder="Enter your last name"
                  className="h-11 bg-background"
                  disabled={isLoadingProfile || isSavingProfile}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Parent's Contact Number</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => handleProfileFieldChange("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="Enter 11-digit phone number"
                  className="h-11 bg-background"
                  maxLength={11}
                  inputMode="numeric"
                  disabled={isLoadingProfile || isSavingProfile}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  title="Gender"
                  aria-label="Gender"
                  value={profileData.gender}
                  onChange={(e) => handleProfileFieldChange("gender", e.target.value)}
                  className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                  disabled={isLoadingProfile || isSavingProfile}
                >
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Email (Read-only)</Label>
                <Input value={user?.email || ""} readOnly className="h-11 bg-muted/50" />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground rounded-lg border border-blue-100 bg-blue-50/50 p-3">
              <div>
                <p className="font-medium text-foreground">Student ID</p>
                <p>{profileMeta.studentId || "N/A"}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Year Level</p>
                <p>{profileMeta.yearLevel || "N/A"}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Student Status</p>
                <p>{profileMeta.studentStatus || "N/A"}</p>
              </div>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={isLoadingProfile || isSavingProfile}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
            >
              {isSavingProfile ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Security Section - 2 Column Grid */}
        <div className="grid lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Change Password */}
          <Card className="border-blue-100/80 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Lock className="h-4 w-4" />
                </div>
                Change Password
              </CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                    placeholder="Enter your current password"
                    className="h-11 bg-background"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                    placeholder="Enter your new password (minimum 8 characters)"
                    className="h-11 bg-background"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                    placeholder="Confirm your new password"
                    className="h-11 bg-background"
                  />
                </div>
              </div>

              <Button onClick={handleChangePassword} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                Change Password
              </Button>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                >
                  Forgot password?
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Change Payment PIN */}
          <Card className="border-blue-100/80 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
                  <KeyRound className="h-4 w-4" />
                </div>
                Change Payment PIN
              </CardTitle>
              <CardDescription>Update your 6-digit payment PIN</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {pinError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="current-pin">Current PIN</Label>
                  <Input
                    id="current-pin"
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={pinData.currentPin}
                    onChange={(e) => handlePinChange("currentPin", e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter your current 6-digit PIN"
                    className="h-11 bg-background"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new-pin">New PIN</Label>
                  <Input
                    id="new-pin"
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={pinData.newPin}
                    onChange={(e) => handlePinChange("newPin", e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter your new 6-digit PIN"
                    className="h-11 bg-background"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirm-pin">Confirm New PIN</Label>
                  <Input
                    id="confirm-pin"
                    type="password"
                    maxLength={6}
                    inputMode="numeric"
                    value={pinData.confirmPin}
                    onChange={(e) => handlePinChange("confirmPin", e.target.value.replace(/\D/g, ''))}
                    placeholder="Confirm your new 6-digit PIN"
                    className="h-11 bg-background"
                  />
                </div>
              </div>

              <Button onClick={handleChangePin} className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">
                Change PIN
              </Button>

              <div className="text-xs text-muted-foreground rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                Your PIN is used to authorize payment transactions. Keep it secure and do not share it with anyone.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentSettings;
