import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import AuthCard from "../components/AuthCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

/** Landing page for the link in the verification email. Works signed in or out. */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState(uid && token ? "verifying" : "invalid"); // verifying | done | invalid
  const [trialStarted, setTrialStarted] = useState(true);
  const [message, setMessage] = useState("");
  // The link is single use, so it must be sent exactly once (React StrictMode runs effects twice).
  const sent = useRef(false);

  useEffect(() => {
    if (!uid || !token || sent.current) return;
    sent.current = true;
    (async () => {
      try {
        const res = await api.verifyEmail(uid, token);
        setTrialStarted(res?.trialStarted !== false);
        setState("done");
      } catch (err) {
        setMessage(err.message || "");
        setState("invalid");
        return;
      }
      // Signed in here? Pick up the new status so the app unlocks without a re-login.
      if (user) refreshUser().catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A used link fails by design; if this browser's account is already verified, that's fine.
  const alreadyVerified = state === "invalid" && user?.emailVerified === true;

  if (state === "verifying") {
    return (
      <AuthCard title="Confirming your email…" subtitle="">
        <div className="flex justify-center py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
        </div>
      </AuthCard>
    );
  }

  if (state === "done" || alreadyVerified) {
    return (
      <AuthCard title={alreadyVerified ? "Already confirmed" : "Email confirmed"} subtitle="">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-av-green/10 text-av-green">
            <CheckCircle2 size={22} />
          </div>
          <p className="text-sm text-slate-600">
            {alreadyVerified
              ? "This address is already confirmed."
              : trialStarted
                ? "Thanks — your free trial has started."
                : "Thanks — your email is confirmed. A free trial was already used with this address, so contact us to continue."}
          </p>
          <Link
            to={user ? "/dashboard" : "/login"}
            className="w-full rounded-lg bg-navy px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            {user ? "Go to the app" : "Log in"}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Link not valid" subtitle="">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-av-red/10 text-av-red">
          <XCircle size={22} />
        </div>
        <p className="text-sm text-slate-600">
          {message || "This confirmation link is incomplete."} Log in and we'll show you how to get a new one.
        </p>
        <Link to="/login" className="text-sm font-semibold text-gold-dark hover:underline">
          Go to log in
        </Link>
      </div>
    </AuthCard>
  );
}
