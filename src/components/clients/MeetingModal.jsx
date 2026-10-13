import Modal, { ModalTitle } from "../ui/Modal";
import { useState } from "react";
import { X, CalendarPlus, CalendarX } from "lucide-react";
import { useClients } from "../../context/ClientsContext";
import { useToast } from "../../context/ToastContext";
import { useGoogleCalendar } from "../../context/GoogleCalendarContext";
import { getStageStatusMeta } from "../../lib/stageStatus";
import { todayISO } from "../../lib/followUp";
import TimeSlotSelect from "../booking/TimeSlotSelect";

const MEETING_DURATION_MINUTES = 30;

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Not Scheduled" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "skipped", label: "Skipped" },
];

export default function MeetingModal({ client, stage, onClose }) {
  const { updateStage, setStageGoogleEventId } = useClients();
  const { addToast } = useToast();
  const { isConfigured, status: googleStatus, connect, createEvent, deleteEvent, checkAvailability } = useGoogleCalendar();
  const stageState = client.stages[stage.id];

  const [date, setDate] = useState(stageState?.date ?? "");
  const [time, setTime] = useState("");
  const [status, setStatus] = useState(stageState?.status ?? "upcoming");
  const [note, setNote] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Set the moment "Add to Google Calendar" succeeds; cleared once cancelled.
  // Persisted on the stage itself so it survives closing/reopening this modal.
  const googleEventId = stageState?.googleEventId;

  const handleSubmit = (e) => {
    e.preventDefault();
    updateStage(client.id, stage.id, { date, status, note });
    addToast(`${stage.label} updated for ${client.first} ${client.last}`);
    onClose();
  };

  const handleGoogleButton = async () => {
    if (googleStatus !== "connected") {
      try {
        await connect();
        addToast("Google Calendar connected — click again to add this meeting.");
      } catch (err) {
        addToast(err.message || "Could not connect to Google Calendar");
      }
      return;
    }

    if (!date || !time) return;
    setSyncing(true);
    try {
      const start = new Date(`${date}T${time}`);
      const end = new Date(start.getTime() + MEETING_DURATION_MINUTES * 60 * 1000);

      // Final guard: re-check just this slot right before booking, since the
      // dropdown's availability snapshot can go stale (someone else — or
      // another tab — books over it between selecting and submitting).
      const stillBusy = await checkAvailability(start.toISOString(), end.toISOString()).catch(() => null);
      if (stillBusy === null) {
        addToast("Couldn't confirm this time is still free — please try again.");
        return;
      }
      if (stillBusy.length > 0) {
        addToast("This time is no longer available. Please select another time.");
        setTime(""); // force a fresh, re-checked pick
        return;
      }

      const created = await createEvent({
        summary: `${stage.label} — ${client.first} ${client.last}`,
        description: `Finuxia meeting: ${stage.label} with ${client.first} ${client.last}.`,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        clientId: client.id,
      });
      setStageGoogleEventId(client.id, stage.id, created.id);
      addToast("Added to Google Calendar");
    } catch (err) {
      if (err.needsReconnect) {
        addToast("Google session expired — click Reconnect and try again.");
      } else {
        addToast(err.message || "Could not add to Google Calendar");
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleCancelMeeting = async () => {
    if (!googleEventId) return;
    setCancelling(true);
    try {
      await deleteEvent(googleEventId);
      setStageGoogleEventId(client.id, stage.id, null);
      addToast("Meeting cancelled and removed from Google Calendar");
    } catch (err) {
      if (err.needsReconnect) {
        addToast("Google session expired — click Reconnect and try again.");
      } else {
        addToast(err.message || "Could not cancel the meeting");
      }
    } finally {
      setCancelling(false);
    }
  };

  const googleButtonLabel =
    googleStatus === "connecting"
      ? "Connecting..."
      : googleStatus === "connected"
        ? syncing
          ? "Adding..."
          : "Add to Google Calendar"
        : googleStatus === "expired"
          ? "Reconnect Google Calendar"
          : "Connect Google Calendar";

  return (
    <Modal onClose={onClose} variant="sheet" panelClassName="max-h-[90vh] overflow-y-auto rounded-t-2xl sm:max-w-md sm:rounded-2xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Edit Meeting</p>
          <ModalTitle className="text-lg font-semibold text-navy">{stage.label}</ModalTitle>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Meeting Date</span>
            <input
              type="date"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>
          <TimeSlotSelect date={date} value={time} onChange={setTime} durationMinutes={MEETING_DURATION_MINUTES} />
        </div>

        {isConfigured && googleEventId && googleStatus === "connected" ? (
          <button
            type="button"
            onClick={handleCancelMeeting}
            disabled={cancelling}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-av-red/30 bg-av-red/5 px-3 py-2 text-xs font-semibold text-av-red transition hover:bg-av-red/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CalendarX size={14} />
            {cancelling ? "Cancelling..." : "Cancel Meeting"}
          </button>
        ) : (
          isConfigured && (
            <button
              type="button"
              onClick={handleGoogleButton}
              disabled={(googleStatus === "connected" && (!date || !time)) || syncing || googleStatus === "connecting"}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-dark transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarPlus size={14} />
              {googleButtonLabel}
            </button>
          )
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Outcome</span>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getStageStatusMeta(status).dot}`} />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {(status === "completed" || status === "skipped") && stage.id === client.currentStage && (
            <span className="text-xs text-gold-dark">Pipeline will advance to the next stage on save.</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Add Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What happened in this meeting..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </label>

        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
