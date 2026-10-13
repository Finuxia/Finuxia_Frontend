import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import AuthCard, { AuthField, authInputClass } from "../components/AuthCard";
import { api } from "../lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Password must be at least 12 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setSaving(true);
    try {
      await api.resetPassword(uid, token, password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err.message || "Could not reset the password");
    } finally {
      setSaving(false);
    }
  };

  if (!uid || !token) {
    return (
      <AuthCard title="Reset link not valid" subtitle="">
        <p className="text-sm text-slate-600">This link is incomplete. Request a new one and try again.</p>
        <Link to="/forgot-password" className="mt-3 inline-block text-sm font-semibold text-gold-dark hover:underline">
          Request a new reset link
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated" subtitle="">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-av-green/10 text-av-green">
            <CheckCircle2 size={22} />
          </div>
          <p className="text-sm text-slate-600">Your password was changed. You can log in with it now.</p>
          <Link to="/login" className="text-sm font-semibold text-gold-dark hover:underline">
            Go to log in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Use at least 12 characters."
      footer={
        <Link to="/login" className="font-semibold text-gold-dark hover:underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField label="New password">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass()}
          />
        </AuthField>
        <AuthField label="Confirm new password">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authInputClass()}
          />
        </AuthField>

        {error && <p className="text-xs text-av-red">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-1 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Saving..." : "Set New Password"}
        </button>
      </form>
    </AuthCard>
  );
}
