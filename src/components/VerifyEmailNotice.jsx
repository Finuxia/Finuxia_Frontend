import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, LogOut } from "lucide-react";
import AuthCard from "./AuthCard";
import { useAuth } from "../context/AuthContext";

/** Shown instead of the app to a signed-in account whose email isn't confirmed yet. */
export default function VerifyEmailNotice() {
  const { user, logout, refreshUser, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // If the link was opened in another tab/browser, pick that up when the user comes back here.
  useEffect(() => {
    const onFocus = () => refreshUser().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await resendVerification();
      if (res?.alreadyVerified) await refreshUser();
      else setMessage("A new link is on its way. It can take a minute to arrive — check your spam folder too.");
    } catch (err) {
      setError(err.message || "Could not send the email. Try again in a little while.");
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const u = await refreshUser();
      if (u?.emailVerified === false) setError("Not confirmed yet. Open the link in the email we sent you.");
    } catch (err) {
      setError(err.message || "Could not check right now.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <AuthCard
      title="Confirm your email"
      subtitle=""
      footer={
        <button onClick={handleLogout} className="inline-flex items-center gap-1.5 font-semibold text-gold-dark hover:underline">
          <LogOut size={14} />
          Log out
        </button>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold-dark">
          <Mail size={22} />
        </div>
        <p className="text-sm text-slate-600">
          We sent a confirmation link to <span className="font-semibold text-navy">{user?.email}</span>. Open it to start
          your free trial and unlock the app.
        </p>
        {message && <p className="text-xs text-av-green">{message}</p>}
        {error && <p className="text-xs text-av-red">{error}</p>}
        <button
          onClick={recheck}
          disabled={busy}
          className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
        >
          I've confirmed it
        </button>
        <button
          onClick={resend}
          disabled={busy}
          className="text-sm font-semibold text-gold-dark hover:underline disabled:opacity-60"
        >
          Send the email again
        </button>
      </div>
    </AuthCard>
  );
}
