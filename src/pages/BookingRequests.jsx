import { useEffect, useState } from "react";
import { CalendarClock, Check, X, RefreshCcw, Clock, Mail, Phone, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import TimeInput from "../components/TimeInput";

const STATUS_META = {
  pending: { label: "Pending", badge: "bg-av-amber/10 text-av-amber" },
  confirmed: { label: "Confirmed", badge: "bg-av-green/10 text-av-green" },
  cancelled: { label: "Cancelled", badge: "bg-slate-100 text-slate-500" },
};

function formatTimeLabel(time) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function toISO(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

/**
 * The advisor's review queue for their public booking link — approve
 * (creates the Google Calendar event, if connected), decline, or reschedule
 * each request.
 */
export default function BookingRequests() {
  const { addToast } = useToast();
  const { status: calStatus, createEvent } = useGoogleCalendar();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rescheduling, setRescheduling] = useState(null); // request being rescheduled, or null

  const load = () => {
    setLoading(true);
    api
      .getBookingRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (req) => {
    setBusyId(req.id);
    try {
      await api.approveBookingRequest(req.id);
      // The backend only puts a request straight on the calendar at the
      // moment it's created (instant booking). Approving one that was left
      // pending — because the calendar wasn't connected yet at that time —
      // still needs the event created now, from here.
      if (calStatus === "connected" && !req.googleEventId) {
        try {
          const start = toISO(req.date, req.time);
          const end = new Date(new Date(start).getTime() + req.durationMinutes * 60 * 1000).toISOString();
          const attendees = [req.clientEmail, ...(req.guestEmails || [])].filter(Boolean);
          const created = await createEvent({
            summary: `Meeting with ${req.clientName}`,
            description: req.note || undefined,
            startISO: start,
            endISO: end,
            attendees: attendees.length ? attendees : undefined,
          });
          await api.setBookingRequestGoogleEvent(req.id, created.id);
        } catch (err) {
          addToast("Confirmed, but couldn't add it to Google Calendar — add it manually.");
        }
      } else if (calStatus !== "connected") {
        addToast("Confirmed. Connect Google Calendar (Profile) to add these automatically.");
      }
      addToast(`Confirmed meeting with ${req.clientName}`);
      load();
    } catch (err) {
      addToast(err.message || "Could not confirm this request");
    } finally {
      setBusyId(null);
    }
  };

  // Cancelling/rescheduling a request that's already on the calendar is
  // handled entirely on the backend (same Calendar connection) — nothing
  // for the browser to do here beyond the request itself.
  const handleCancel = async (req) => {
    if (!window.confirm(`Cancel the meeting with ${req.clientName}?`)) return;
    setBusyId(req.id);
    try {
      await api.cancelBookingRequest(req.id);
      addToast("Cancelled");
      load();
    } catch (err) {
      addToast(err.message || "Could not cancel this request");
    } finally {
      setBusyId(null);
    }
  };

  const handleReschedule = async (req, date, time) => {
    setBusyId(req.id);
    try {
      await api.rescheduleBookingRequest(req.id, date, time);
      addToast("Rescheduled");
      setRescheduling(null);
      load();
    } catch (err) {
      addToast(err.message || "Could not reschedule this request");
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const rest = requests.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
          <CalendarClock size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">Booking Requests</h1>
          <p className="text-sm text-slate-500">Meetings clients requested through your booking link.</p>
        </div>
      </div>

      {calStatus === "connected" ? (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-av-green/40 bg-av-green/5 px-4 py-3 text-sm text-av-green">
          <Check size={15} className="mt-0.5 shrink-0" />
          Instant booking is on — new requests confirm and land on your calendar automatically, no approval needed.
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-av-amber/40 bg-av-amber/5 px-4 py-3 text-sm text-av-amber">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Connect Google Calendar on your Profile page to skip the approval step entirely and add meetings
          automatically.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
          Loading…
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <CalendarClock size={24} className="text-slate-300" />
          <p className="text-sm text-slate-400">No booking requests yet. Share your booking link to get started.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-sm font-semibold text-navy">Needs your response</h2>
              <div className="flex flex-col gap-2.5">
                {pending.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    busy={busyId === req.id}
                    onApprove={() => handleApprove(req)}
                    onCancel={() => handleCancel(req)}
                    onReschedule={() => setRescheduling(req)}
                  />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-sm font-semibold text-navy">All Requests</h2>
              <div className="flex flex-col gap-2.5">
                {rest.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    busy={busyId === req.id}
                    onCancel={req.status === "confirmed" ? () => handleCancel(req) : undefined}
                    onReschedule={req.status === "confirmed" ? () => setRescheduling(req) : undefined}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {rescheduling && (
        <RescheduleModal
          req={rescheduling}
          onClose={() => setRescheduling(null)}
          onConfirm={(date, time) => handleReschedule(rescheduling, date, time)}
        />
      )}
    </div>
  );
}

function RequestCard({ req, busy, onApprove, onCancel, onReschedule }) {
  const meta = STATUS_META[req.status] ?? STATUS_META.pending;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-navy">{req.clientName}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>{meta.label}</span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock size={12} />
            {req.date} at {formatTimeLabel(req.time)} · {req.durationMinutes} min
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Mail size={11} />
            {req.clientEmail}
            {req.clientPhone && (
              <>
                <Phone size={11} className="ml-1.5" />
                {req.clientPhone}
              </>
            )}
          </p>
          {req.guestEmails?.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">Guests: {req.guestEmails.join(", ")}</p>
          )}
          {req.answers?.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-0.5">
              {req.answers.map((a) => (
                <p key={a.questionId} className="text-xs text-slate-500">
                  <span className="text-slate-400">{a.label || "Answer"}:</span> {a.answer}
                </p>
              ))}
            </div>
          )}
          {req.note && <p className="mt-1.5 text-xs text-slate-500">"{req.note}"</p>}
        </div>

        <div className="flex shrink-0 gap-1.5">
          {onApprove && (
            <button
              onClick={onApprove}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg bg-av-green/10 px-2.5 py-1.5 text-xs font-semibold text-av-green transition hover:bg-av-green/20 disabled:opacity-50"
            >
              <Check size={13} />
              Approve
            </button>
          )}
          {onReschedule && (
            <button
              onClick={onReschedule}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCcw size={12} />
              Reschedule
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-av-red transition hover:bg-av-red/5 disabled:opacity-50"
            >
              <X size={13} />
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({ req, onClose, onConfirm }) {
  const [date, setDate] = useState(req.date);
  const [time, setTime] = useState(req.time);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-navy">Reschedule {req.clientName}</h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>
          <TimeInput label="Time" value={time} onChange={setTime} />
          <div className="mt-1 flex justify-end gap-3">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(date, time)}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
