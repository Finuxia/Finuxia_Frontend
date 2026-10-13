import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { todayISO } from "../lib/followUp";
import TimeInput from "./TimeInput";

/**
 * Create/edit a reminder — a standalone to-do, not a meeting. No Google
 * Calendar sync, no meeting-only fields; the only thing it can optionally
 * touch is tagging a client for context.
 *
 * Also doubles as the "Add as Follow-up" flow (kind="followup") — same
 * fields/backend entity, just tagged differently so it shows up on the
 * Follow-ups page instead of My Day. lockClient pins the client picker to a
 * single client (used from ClientDetail, where the client is already known).
 */
export default function ReminderModal({ initial, kind = "reminder", lockClient, onSubmit, onDelete, onClose }) {
  const { clients } = useClients();
  const isEdit = Boolean(initial?.id);
  const isFollowUp = (initial?.kind || kind) === "followup";
  const [title, setTitle] = useState(initial?.title || "");
  const [note, setNote] = useState(initial?.note || "");
  const [dueDate, setDueDate] = useState(initial?.dueDate || todayISO());
  const [dueTime, setDueTime] = useState(initial?.dueTime || "");
  const [clientRef, setClientRef] = useState(initial?.clientRef || lockClient?.id || "");
  const [repeat, setRepeat] = useState(initial?.repeat || "none");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        title: title.trim(),
        note: note.trim(),
        dueDate,
        dueTime: dueTime || null,
        clientRef: (lockClient?.id || clientRef) || null,
        repeat,
        kind: initial?.kind || kind,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Could not save this reminder.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const isRecurring = Boolean(initial?.repeat && initial.repeat !== "none" && initial?.seriesId);
    let scope = "single";
    if (isRecurring) {
      const deleteAll = window.confirm(
        "This repeats. Click OK to delete the entire series (every occurrence), or Cancel to only delete this one."
      );
      if (deleteAll) {
        scope = "series";
      } else if (!window.confirm("Delete just this occurrence? This can't be undone.")) {
        return;
      }
    } else if (!window.confirm("Delete this reminder? This can't be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(scope);
      onClose();
    } catch (err) {
      setError(err.message || "Could not delete this reminder.");
      setDeleting(false);
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">
            {isFollowUp ? (isEdit ? "Edit Follow-up" : "New Follow-up") : isEdit ? "Edit Reminder" : "New Reminder"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call about renewal..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Due date</span>
              <input
                type="date"
                value={dueDate}
                min={todayISO()}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <TimeInput label="Due time (optional)" value={dueTime} onChange={setDueTime} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {lockClient ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Client</span>
                <div className="flex w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-navy">
                  {lockClient.first} {lockClient.last}
                </div>
              </label>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Client (optional)</span>
                <select
                  value={clientRef}
                  onChange={(e) => setClientRef(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                >
                  <option value="">None</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first} {c.last}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Repeat</span>
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="every_other_day">Every other day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </label>
          </div>

          {error && <p className="text-xs text-av-red">{error}</p>}

          <div className="mt-1 flex items-center justify-between gap-3">
            {isEdit && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-av-red transition hover:bg-av-red/10 disabled:opacity-60"
              >
                <Trash2 size={14} />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "Saving..." : isEdit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
