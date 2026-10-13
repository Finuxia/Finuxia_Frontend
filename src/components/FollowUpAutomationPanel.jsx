import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

const FREQUENCIES = [
  { id: "weekly", label: "Every week" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Every month" },
];

const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "professional", label: "Professional" },
  { id: "reminder", label: "Reminder" },
];

/**
 * Per-client "keep following up automatically" rule — once enabled, the
 * backend drafts a fresh AI message on the chosen cadence and emails the
 * client with no advisor action needed (see src.followups). Nothing here
 * sends anything itself; it only edits the rule the backend's own daily
 * sweep reads.
 */
export default function FollowUpAutomationPanel({ clientRef, clientName }) {
  const { addToast } = useToast();
  const [rule, setRule] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getFollowUpRule(clientRef)
      .then((r) => !cancelled && setRule(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientRef]);

  const save = async (patch) => {
    const next = { ...rule, ...patch };
    setRule(next);
    setSaving(true);
    try {
      const saved = await api.setFollowUpRule(clientRef, {
        enabled: next.enabled,
        frequency: next.frequency,
        tone: next.tone,
      });
      setRule(saved);
      if ("enabled" in patch) {
        addToast(saved.enabled ? `Automated follow-ups on for ${clientName}` : `Automated follow-ups off for ${clientName}`);
      }
    } catch (err) {
      addToast(err.message || "Could not save follow-up automation");
    } finally {
      setSaving(false);
    }
  };

  if (!rule) return null;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold-dark">
            <Sparkles size={15} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-navy">Automated Follow-ups</h2>
            <p className="text-xs text-slate-400">AI drafts and sends a check-in on its own, on this schedule.</p>
          </div>
        </div>
        <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
          <input
            type="checkbox"
            checked={rule.enabled}
            disabled={saving}
            onChange={(e) => save({ enabled: e.target.checked })}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-gold" />
          <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
        </label>
      </div>

      {rule.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Frequency</span>
            <select
              value={rule.frequency}
              disabled={saving}
              onChange={(e) => save({ frequency: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
            >
              {FREQUENCIES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Tone</span>
            <select
              value={rule.tone}
              disabled={saving}
              onChange={(e) => save({ tone: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
            >
              {TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {rule.enabled && rule.lastSentAt && (
        <p className="mt-3 text-xs text-slate-400">Last sent {new Date(rule.lastSentAt).toLocaleDateString()}</p>
      )}
    </section>
  );
}
