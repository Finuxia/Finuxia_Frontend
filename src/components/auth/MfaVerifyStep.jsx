import { useState } from "react";
import { AuthField, authInputClass } from "../layout/AuthCard";
import { api } from "../../lib/api";
import { digitsOnly, isCompleteCode } from "../../lib/mfa";

// The second step of signing in (SEC-12): the six-digit code from the authenticator app, or one of the recovery codes.
export default function MfaVerifyStep({ challenge, onSignedIn, onBack }) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const ready = useRecovery ? recovery.trim().length >= 10 : isCompleteCode(code);

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.mfaVerify(challenge, useRecovery ? { recoveryCode: recovery.trim() } : { code: digitsOnly(code) });
      onSignedIn(result);
    } catch (err) {
      setError(err);
      if (!useRecovery) setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {useRecovery ? (
        <AuthField label="Recovery code">
          <input
            value={recovery}
            onChange={(e) => setRecovery(e.target.value)}
            className={authInputClass()}
            placeholder="ABCDE-FGHJK"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
          />
        </AuthField>
      ) : (
        <AuthField label="Authenticator code">
          <input
            value={code}
            onChange={(e) => setCode(digitsOnly(e.target.value))}
            className={authInputClass()}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
          />
        </AuthField>
      )}

      {error && (
        <p role="alert" className="text-xs text-av-red">
          {error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || submitting}
        className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-navy-light disabled:opacity-60"
      >
        {submitting ? "Checking..." : "Continue"}
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setUseRecovery((v) => !v);
            setError(null);
          }}
          className="font-medium text-slate-500 hover:text-navy"
        >
          {useRecovery ? "Use my authenticator app" : "Use a recovery code instead"}
        </button>
        <button type="button" onClick={onBack} className="font-medium text-slate-500 hover:text-navy">
          Start over
        </button>
      </div>
    </form>
  );
}
