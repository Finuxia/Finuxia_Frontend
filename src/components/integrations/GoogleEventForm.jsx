import Modal, { ModalTitle } from "../ui/Modal";
import { useState } from "react";
import { X } from "lucide-react";
import { useGoogleCalendar } from "../../context/GoogleCalendarContext";
import TimeSlotSelect from "../booking/TimeSlotSelect";

function toDateInput(iso) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}
function toTimeInput(iso) {
  if (!iso) return "09:00";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function GoogleEventForm({ title, initial, onSubmit, onClose, submitLabel = "Save" }) {
  const { checkAvailability } = useGoogleCalendar();
  const [summary, setSummary] = useState(initial?.summary || "");
  const [date, setDate] = useState(toDateInput(initial?.startISO) || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(toTimeInput(initial?.startISO));
  const [durationMin, setDurationMin] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim() || !date || !time) return;
    setSaving(true);
    setError("");
    try {
      const start = new Date(`${date}T${time}`);
      const end = new Date(start.getTime() + durationMin * 60 * 1000);

      // Final guard: re-check just this slot right before booking — the
      // dropdown's availability snapshot can go stale between pick and submit.
      const stillBusy = await checkAvailability(start.toISOString(), end.toISOString()).catch(() => null);
      if (stillBusy === null) {
        setError("Couldn't confirm this time is still free — please try again.");
        return;
      }
      if (stillBusy.length > 0) {
        setError("This time is no longer available. Please select another time.");
        setTime("");
        return;
      }

      await onSubmit({
        summary: summary.trim(),
        startISO: start.toISOString(),
        endISO: end.toISOString(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Could not save this event.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} panelClassName="max-w-sm rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <ModalTitle className="text-lg font-semibold text-navy">{title}</ModalTitle>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</span>
          <input
            autoFocus
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Meeting with..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>
          <TimeSlotSelect date={date} value={time} onChange={setTime} durationMinutes={durationMin} />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</span>
          <select
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </label>

        {error && <p className="text-xs text-av-red">{error}</p>}

        <div className="mt-1 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
          >
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
