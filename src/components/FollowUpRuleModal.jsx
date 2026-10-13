import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
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
 * Same rule FollowUpAutomationPanel edits on a client's own page, in a
 * modal — for the Follow-ups list, which shows many clients at once and
 * has no room for a full panel per row.
 */
export default function FollowUpRuleModal({ client, onClose }) {
  const { addToast } = useToast();
  const [rule, setRule] = useState(null);
  const [saving, setSaving] = useState(false);
  const name = `${client.first} ${client.last}`.trim();

  useEffect(() => {
    let cancelled = false;
    api
      .getFollowUpRule(client.id)
      .then((r) => !cancelled && setRule(r))
      .catch(() => !cancelled && setRule({ enabled: false, frequency: "monthly", tone: "friendly" }));
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const save = async (patch) => {
    const next = { ...rule, ...patch };
    setRule(next);
    setSaving(true);
    try {
      const saved = await api.setFollowUpRule(client.id, {
        enabled: next.enabled,
        frequency: next.frequency,
        tone: next.tone,
      });
      setRule(saved);
    } catch (err) {
      addToast(err.message || "Could not save follow-up automation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-semibold text-navy">
            <Sparkles size={17} className="text-gold-dark" />
            Automated Follow-ups
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          AI drafts and sends {name} a check-in on its own, on this schedule — no action needed from you once it's on.
        </p>

        {!rule ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <span className="text-sm text-navy">Enabled</span>
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
          </>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
