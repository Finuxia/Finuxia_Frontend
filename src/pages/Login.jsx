import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthCard, { AuthField, authInputClass } from "../components/AuthCard";
import { useAuth } from "../context/AuthContext";
import ErrorNotice from "../components/ErrorNotice";
import useCountdown from "../hooks/useCountdown";
import { describeError } from "../lib/apiErrors";
import { destinationAfterLogin } from "../lib/redirects";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const lockout = error && describeError(error).kind === "login_locked" ? describeError(error) : null;
  const waitLeft = useCountdown(lockout?.retryAfter || 0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockout && waitLeft > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      const redirectTo = destinationAfterLogin(location);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to see what needs your attention today."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-gold-dark hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField label="Email or username">
          <input
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={authInputClass()}
            placeholder="you@example.com"
          />
        </AuthField>
        <AuthField label="Password">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass()}
            placeholder="••••••••"
          />
        </AuthField>

        {lockout ? (
          <ErrorNotice error={error} />
        ) : (
          error && <p className="text-xs text-av-red">{error.message}</p>
        )}

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-slate-500 hover:text-navy">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting || (lockout && waitLeft > 0)}
          className="mt-1 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Log In"}
        </button>
      </form>
    </AuthCard>
  );
}
