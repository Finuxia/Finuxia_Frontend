import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { digitsOnly, isCompleteCode, recoveryCodesText } from "../../lib/mfa";

// Where an account sees its second factor (SEC-12): that it is on, how many recovery codes remain, and a way to get a fresh set.
export default function TwoFactorPanel() {
  const { user, refreshUser } = useAuth();
  const mfa = user?.mfa;
  const [asking, setAsking] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [codes, setCodes] = useState(null);

  if (!mfa) return null;

  const regenerate = async (e) => {
    e.preventDefault();
    if (!isCompleteCode(code) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { recoveryCodes } = await api.mfaRegenerateRecoveryCodes(digitsOnly(code));
      setCodes(recoveryCodes);
      setAsking(false);
      setCode("");
      refreshUser().catch(() => {});
    } catch (err) {
      setError(err);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const low = mfa.enrolled && mfa.recoveryCodesRemaining <= 2;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm" aria-labelledby="two-factor-heading">
      <h2 id="two-factor-heading" className="mb-1 text-sm font-semibold text-navy">
        Two-factor sign-in
      </h2>
      {!mfa.required ? (
        <p className="text-xs text-slate-500">Two-factor sign-in is not required for this account.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {mfa.enrolled
              ? "On. You sign in with your password and a code from your authenticator app."
              : "Not set up yet. You will be asked to set it up the next time you sign in."}
          </p>
          {mfa.enrolled && (
            <p className={`mt-3 text-sm ${low ? "font-semibold text-av-red" : "text-slate-600"}`}>
              Recovery codes left: <span data-testid="recovery-count">{mfa.recoveryCodesRemaining}</span>
              {low && " (get a new set before you run out)"}
            </p>
          )}
          {mfa.enrolled && !codes && !asking && (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-navy hover:bg-slate-50"
            >
              Get new recovery codes
            </button>
          )}
          {asking && (
            <form onSubmit={regenerate} className="mt-3 flex flex-col gap-3">
              <p className="text-xs text-slate-500">
                New codes replace the old ones, which stop working. Enter the current code from your app to confirm it is you.
              </p>
              <input
                aria-label="Code from your authenticator app"
                value={code}
                onChange={(e) => setCode(digitsOnly(e.target.value))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                placeholder="123456"
                className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
              {error && (
                <p role="alert" className="text-xs text-av-red">
                  {error.message}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!isCompleteCode(code) || busy}
                  className="rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Checking..." : "Replace my recovery codes"}
                </button>
                <button type="button" onClick={() => setAsking(false)} className="text-xs font-medium text-slate-500 hover:text-navy">
                  Cancel
                </button>
              </div>
            </form>
          )}
          {codes && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-xs text-slate-600">Your new recovery codes. Each works once, and they are not shown again.</p>
              <ul aria-label="New recovery codes" className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 font-mono text-sm text-navy">
                {codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(recoveryCodesText(codes, user.email)).catch(() => {})}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50"
                >
                  Copy
                </button>
                <button type="button" onClick={() => setCodes(null)} className="text-xs font-medium text-slate-500 hover:text-navy">
                  I have saved them
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
