import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Sparkles, Wallet } from "lucide-react";
import AiBlockedNotice from "./AiBlockedNotice";
import AiUsageInline from "./AiUsageInline";
import useAiUsage from "../hooks/useAiUsage";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatLongDate } from "../lib/dates";
import { createAttemptKeys, isRetryable } from "../lib/idempotency";
import { creditsLabel, formatCents } from "../lib/aiUsage";

const TOP_UPS = [500, 1000, 2500];

function ProgressBar({ percent, level }) {
  const shown = Math.min(Math.max(percent, 0), 100);
  const color = level === "exhausted" || level === "critical" ? "bg-av-red" : level === "warning" ? "bg-gold" : "bg-av-green";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="AI credits used" aria-valuenow={shown} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${shown}%` }} />
    </div>
  );
}

function Card({ children }) {
  return <section className="rounded-2xl bg-white p-6 shadow-sm">{children}</section>;
}

/** Profile → AI usage: what AI the advisor has used this billing period and what is left, in credits, with the wallet that pays beyond it. */
export default function AiUsagePanel() {
  const { usage, error, refresh } = useAiUsage();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [purchasesOpen, setPurchasesOpen] = useState(true);
  const [toppingUp, setToppingUp] = useState(null);
  const attemptKeys = useRef(createAttemptKeys());
  const returned = searchParams.get("topup");

  useEffect(() => {
    api.getBillingPlans().then((res) => setPurchasesOpen(res.purchasesOpen !== false)).catch(() => {});
  }, []);

  const handleTopUp = async (cents) => {
    if (toppingUp !== null) return;
    setToppingUp(cents);
    try {
      const result = await api.topUpWallet(cents, attemptKeys.current.keyFor(cents));
      attemptKeys.current.settle(cents);
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      addToast(`Added ${formatCents(cents)} to your AI wallet (test top-up, no real charge).`);
      await refresh();
    } catch (err) {
      if (!isRetryable(err)) attemptKeys.current.settle(cents);
      addToast(err.message || "Could not add credit");
    } finally {
      setToppingUp(null);
    }
  };

  if (error && !usage) return <Card><p className="text-sm text-slate-500">AI usage isn't available right now. Try again in a moment.</p></Card>;
  if (!usage) return <Card><p className="text-sm text-slate-500">Loading your AI usage…</p></Card>;

  const { credits, mode } = usage;
  const resetDate = formatLongDate(usage.period?.end);

  return (
    <div className="flex flex-col gap-6">
      {returned === "success" && (
        <p role="status" className="rounded-lg bg-av-green/10 px-3 py-2 text-sm text-navy">
          Thanks. Your top-up is added to your wallet as soon as the payment is confirmed.
        </p>
      )}
      <Card>
        <div className="mb-1 flex items-center gap-2 text-navy">
          <Sparkles size={16} className="text-gold-dark" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">AI credits this period</h2>
        </div>
        <p className="mb-4 text-xs text-slate-500">Credits are what AI features use each time you draft a letter, summarise a document or write a follow-up.</p>

        {mode === "none" && (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Your plan doesn't include the AI features.{" "}
            <Link to="/billing" className="font-semibold text-gold-dark underline">See plans</Link>
          </p>
        )}

        {mode === "wallet" && (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
            Your plan doesn't include a monthly allowance of AI credits, so AI is paid from your wallet below.
          </p>
        )}

        {mode === "unlimited" && (
          <p className="rounded-lg bg-av-green/10 px-3 py-3 text-sm text-navy">
            Your plan includes unlimited AI, so there is nothing to run out of. You've used {creditsLabel(credits.used)} this period.
          </p>
        )}

        {mode === "allowance" && (
          <>
            <div className="mb-2 flex items-end justify-between gap-3">
              <p className="text-2xl font-bold text-navy">
                {credits.remaining.toLocaleString("en-US")} <span className="text-sm font-medium text-slate-500">of {credits.total.toLocaleString("en-US")} credits left</span>
              </p>
              {resetDate && <p className="text-right text-xs text-slate-500">Start again {resetDate}</p>}
            </div>
            <ProgressBar percent={usage.percentUsed ?? 0} level={usage.warning} />
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
              <span>
                {credits.used.toLocaleString("en-US")} used{credits.inFlight ? ` · ${credits.inFlight.toLocaleString("en-US")} in progress` : ""}
              </span>
              <span>
                {credits.included.toLocaleString("en-US")} included{credits.extra ? ` + ${credits.extra.toLocaleString("en-US")} extra` : ""}
              </span>
            </div>
            <AiUsageInline usage={usage} className="mt-3" />
          </>
        )}

        {usage.blocked && <AiBlockedNotice className="mt-3" message={usage.blocked.message} actions={usage.blocked.actions} hideTopUp />}
      </Card>

      {mode !== "none" && (
        <Card>
          <div className="mb-3 flex items-center gap-2 text-navy">
            <Wallet size={16} className="text-gold-dark" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">AI wallet</h2>
          </div>
          <p className="text-2xl font-bold text-navy">{formatCents(usage.wallet.balanceCents)}</p>
          <p className="mb-3 text-xs text-slate-500">Pays for AI use beyond the credits your plan includes.</p>
          {purchasesOpen ? (
            <div className="flex flex-wrap gap-2">
              {TOP_UPS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  disabled={toppingUp !== null}
                  onClick={() => handleTopUp(cents)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {toppingUp === cents ? "Adding…" : `Add ${formatCents(cents)}`}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Adding credit isn't open yet.</p>
          )}
        </Card>
      )}

      {usage.byFeature.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy">This period by feature</h2>
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {usage.byFeature.map((f) => (
              <li key={f.feature} className="flex items-center justify-between py-2">
                <span className="text-navy">{f.label}</span>
                <span className="text-slate-500">
                  {f.calls} {f.calls === 1 ? "use" : "uses"} · {creditsLabel(f.credits)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {mode !== "none" && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-navy">Recent AI use</h2>
          {usage.recentUsage.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing yet. Your AI use will show up here.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 text-sm">
              {usage.recentUsage.map((r, i) => (
                <li key={`${r.createdAt}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-navy">{r.label}</span>
                  <span className="text-xs text-slate-500">{formatLongDate(r.createdAt)}</span>
                  <span className="w-28 text-right text-slate-600">
                    {creditsLabel(r.credits)}
                    {r.pending && <span className="block text-[11px] text-slate-400">in progress</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
