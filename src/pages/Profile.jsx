import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, LogOut, Trash2, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import GoogleCalendarPanel from "../components/integrations/GoogleCalendarPanel";
import GoogleDrivePanel from "../components/integrations/GoogleDrivePanel";
import ZoomPanel from "../components/integrations/ZoomPanel";
import AvailabilityPanel from "../components/booking/AvailabilityPanel";
import ComplianceProfilePanel from "../components/account/ComplianceProfilePanel";
import AiUsagePanel from "../components/AiUsagePanel";
import TwoFactorPanel from "../components/account/TwoFactorPanel";

const TABS = [
  { key: "account", label: "Account" },
  { key: "integrations", label: "Integrations" },
  { key: "availability", label: "Availability" },
  { key: "compliance", label: "Compliance" },
  { key: "ai-usage", label: "AI usage" },
];

export default function Profile() {
  const { user, updateProfile, changePassword, uploadAvatar, removeAvatar, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  // The login email is the account's recovery handle, so changing it asks for the password.
  const [emailPassword, setEmailPassword] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "account");
  const [avatarBust, setAvatarBust] = useState(Date.now());
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef(null);

  const emailChanged = email.trim().toLowerCase() !== user.email;

  const handleSave = async (e) => {
    e.preventDefault();
    const newEmail = email.trim().toLowerCase();
    try {
      await updateProfile({ name, email: newEmail, ...(emailChanged ? { currentPassword: emailPassword } : {}) });
      setEmailPassword("");
      addToast("Profile updated");
    } catch (err) {
      addToast(err.message || "Could not update profile");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pw.next.length < 12) {
      addToast("The new password must be at least 12 characters.");
      return;
    }
    if (pw.next !== pw.confirm) {
      addToast("The new passwords don't match.");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      addToast("Password changed. Your other devices were signed out.");
    } catch (err) {
      addToast(err.message || "Could not change the password");
    } finally {
      setPwSaving(false);
    }
  };

  const handleAvatarChange = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      addToast("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast("Image is larger than 5 MB.");
      return;
    }
    setAvatarSaving(true);
    try {
      await uploadAvatar(file);
      setAvatarBust(Date.now());
      addToast("Photo updated");
    } catch (err) {
      addToast(err.message || "Could not upload photo");
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarSaving(true);
    try {
      await removeAvatar();
      setAvatarBust(Date.now());
    } catch (err) {
      addToast(err.message || "Could not remove photo");
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="group relative h-16 w-16 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarSaving}
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-navy text-2xl font-bold text-gold transition disabled:opacity-60"
            title="Change photo"
            aria-label="Change photo"
          >
            {user.hasAvatar ? (
              <img src={`${api.avatarUrl(user.id)}?t=${avatarBust}`} alt="" className="h-full w-full object-cover" />
            ) : (
              (user.name?.[0]?.toUpperCase() ?? <User size={24} />)
            )}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarSaving}
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-gold text-navy shadow-xs transition hover:bg-gold-light"
            title="Change photo"
            aria-label="Change photo"
          >
            <Camera size={12} />
          </button>
          {user.hasAvatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={avatarSaving}
              className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-white text-av-red shadow-xs transition hover:bg-av-red/10"
              title="Remove photo"
              aria-label="Remove photo"
            >
              <Trash2 size={12} />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatarChange(e.target.files?.[0])}
          />
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy">{user.name}</h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-navy text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "account" && (
        <section className="rounded-2xl bg-white p-6 shadow-xs">
          <h2 className="mb-4 text-sm font-semibold text-navy">Account details</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Full Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-hidden transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-hidden transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            {emailChanged && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Current password (required to change your email)
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-hidden transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </label>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-navy-light"
              >
                Save Changes
              </button>
            </div>
          </form>
        </section>
      )}

      {tab === "account" && (
        <section className="rounded-2xl bg-white p-6 shadow-xs">
          <h2 className="mb-1 text-sm font-semibold text-navy">Change password</h2>
          <p className="mb-4 text-xs text-slate-500">At least 12 characters. Changing it signs out your other devices.</p>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            {[
              ["current", "Current password", "current-password"],
              ["next", "New password", "new-password"],
              ["confirm", "Confirm new password", "new-password"],
            ].map(([key, label, autoComplete]) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
                <input
                  type="password"
                  autoComplete={autoComplete}
                  required
                  value={pw[key]}
                  onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-hidden transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </label>
            ))}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwSaving}
                className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-navy-light disabled:opacity-60"
              >
                {pwSaving ? "Saving..." : "Change Password"}
              </button>
            </div>
          </form>
        </section>
      )}

      {tab === "account" && <TwoFactorPanel />}

      {tab === "integrations" && (
        <div className="flex flex-col gap-6">
          <GoogleCalendarPanel />
          <GoogleDrivePanel />
          <ZoomPanel />
        </div>
      )}

      {tab === "availability" && <AvailabilityPanel />}

      {tab === "compliance" && <ComplianceProfilePanel />}

      {tab === "ai-usage" && <AiUsagePanel />}

      <button
        onClick={handleLogout}
        className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-av-red transition hover:bg-av-red/5"
      >
        <LogOut size={15} />
        Log Out
      </button>
    </div>
  );
}
