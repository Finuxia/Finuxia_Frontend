import { useEffect, useState } from "react";
import { AuthField, authInputClass } from "../layout/AuthCard";
import { api } from "../../lib/api";
import { digitsOnly, formatSecret, isCompleteCode, recoveryCodesText } from "../../lib/mfa";

// Setting up the second factor (SEC-12): scan the QR code (or type the key), prove it saved by entering a code from it, then keep the recovery codes.
// Nothing is switched on, and no session exists, until a real code has been entered, so nobody can lock themselves out with a code that did not save.
export default function MfaEnrolStep({ challenge, onSignedIn, onBack }) {
  const [setup, setSetup] = useState(null); // { secret, otpauthUri, account }
  const [qr, setQr] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // the sign-in result, held until the recovery codes have been saved
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const details = await api.mfaEnrolStart(challenge);
        // The QR generator is only needed on this screen, so it is fetched here and not with the sign-in page.
        const { default: qrcode } = await import("qrcode-generator");
        const generator = qrcode(0, "M");
        generator.addData(details.otpauthUri);
        generator.make();
        if (!cancelled) {
          setSetup(details);
          setQr(generator.createDataURL(5, 2));
        }
      } catch (err) {
        if (!cancelled) setLoadError(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge]);

  const submit = async (e) => {
    e.preventDefault();
    if (!isCompleteCode(code) || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      setDone(await api.mfaEnrolConfirm(challenge, digitsOnly(code)));
    } catch (err) {
      setError(err);
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodesText(done.recoveryCodes, setup?.account));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([recoveryCodesText(done.recoveryCodes, setup?.account)], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "finuxia-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loadError) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-av-red">
          {loadError.message}
        </p>
        <button type="button" onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-navy">
          Start over
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Two-factor sign-in is on. Save these recovery codes now. Each one works <strong>once</strong>, if you lose your phone, and they
          are not shown again.
        </p>
        <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 font-mono text-sm text-navy">
          {done.recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copyCodes}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={downloadCodes}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy hover:bg-slate-50"
          >
            Download
          </button>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5" />
          <span>I have saved these codes somewhere safe.</span>
        </label>
        <button
          type="button"
          disabled={!saved}
          onClick={() => onSignedIn(done)}
          className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
        >
          Continue to Finuxia
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy...).</li>
        <li>Scan this code, or enter the key by hand.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      {setup ? (
        <>
          <img src={qr} alt="QR code for your authenticator app" className="mx-auto h-44 w-44" />
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Key (to type by hand)</span>
            <p
              aria-label="Secret key"
              className="mt-1 select-all break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm tracking-wider text-navy"
            >
              {formatSecret(setup.secret)}
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Preparing your code...</p>
      )}
      <AuthField label="Code from the app">
        <input
          value={code}
          onChange={(e) => setCode(digitsOnly(e.target.value))}
          className={authInputClass()}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          disabled={!setup}
        />
      </AuthField>
      {error && (
        <p role="alert" className="text-xs text-av-red">
          {error.message}
        </p>
      )}
      <button
        type="submit"
        disabled={!setup || !isCompleteCode(code) || submitting}
        className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
      >
        {submitting ? "Checking..." : "Turn on two-factor sign-in"}
      </button>
      <button type="button" onClick={onBack} className="text-xs font-medium text-slate-500 hover:text-navy">
        Start over
      </button>
    </form>
  );
}
