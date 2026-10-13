import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import AuthCard, { AuthField, authInputClass } from "../components/layout/AuthCard";
import { useAuth } from "../context/AuthContext";

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Check your inbox" subtitle="">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-av-green/10 text-av-green">
            <MailCheck size={22} />
          </div>
          <p className="text-sm text-slate-600">
            If an account exists for <span className="font-semibold text-navy">{email}</span>, we've emailed a link to reset the password.
            It works once and expires in one hour.
          </p>
          <Link to="/login" className="mt-2 text-sm font-semibold text-gold-dark hover:underline">
            Back to log in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you reset instructions."
      footer={
        <Link to="/login" className="font-semibold text-gold-dark hover:underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass()}
            placeholder="you@example.com"
          />
        </AuthField>

        {error && <p className="text-xs text-av-red">{error}</p>}

        <button
          type="submit"
          className="mt-1 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
        >
          Send Reset Link
        </button>
      </form>
    </AuthCard>
  );
}
