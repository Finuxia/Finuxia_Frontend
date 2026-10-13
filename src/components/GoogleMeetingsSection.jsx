import { useState } from "react";
import { CalendarClock, Link2, RefreshCcw, AlertTriangle, Clock, User, UserPlus, CalendarCheck, Trash2, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import { isAllDay, eventStart } from "../services/googleCalendarApi";
import { matchClientForEvent, guessClientNameFromEvent } from "../services/meetingClients";
import { openGmailCompose, feedbackEmailDraft } from "../lib/gmail";
import { todayISO } from "../lib/followUp";
import AddClientModal from "./AddClientModal";

/**
 * Google Calendar meetings for the date My Day is showing. Presentational —
 * the events/loading/error come from My Day (which owns the per-day cache);
 * this component adds connection controls, client-matching and done-toggling.
 */
export default function GoogleMeetingsSection({ date, events = [], loading = false, error = null, onRefresh }) {
  const { isConfigured, status, connect, deleteEvent } = useGoogleCalendar();
  const { clients, isTaskDoneToday, toggleDailyTask } = useClients();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null); // prefilled values for the Add Client modal, or null
  const [cancellingId, setCancellingId] = useState(null);

  if (!isConfigured) return null;

  const connected = status === "connected";

  if (!connected) {
    return (
      <div>
        <Header count={null} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4">
          <div className="flex items-start gap-2">
            {(status === "expired" || status === "revoked") && <AlertTriangle size={15} className="mt-0.5 shrink-0 text-av-red" />}
            <p className="text-sm text-slate-500">
              {status === "expired" || status === "revoked"
                ? "Your Google Calendar access expired — reconnect to see meetings."
                : "Connect Google Calendar to see meetings here."}
            </p>
          </div>
          <ConnectButton status={status} onConnect={connect} onToast={addToast} />
        </div>
      </div>
    );
  }

  // Opens the Add Client form pre-filled with a name guessed from the event —
  // nothing is created until the user reviews it and hits Save. Adding "as
  // follow-up" is the same client form, just pre-dated so the new client
  // lands in today's Follow-ups bucket right away instead of sitting at
  // "TBD" (invisible there) until a follow-up date gets set by hand — the
  // client and the follow-up are the same record, never two separate things.
  const handleAddClient = (event, { asFollowUp = false } = {}) => {
    const guess = guessClientNameFromEvent(event);
    if (!guess?.first) {
      addToast("Couldn't read a client name from this event.");
      return;
    }
    setDraft({
      first: guess.first,
      last: guess.last || "",
      priority: "Medium",
      nextFollowUpDate: asFollowUp ? todayISO() : "",
    });
  };

  // Delete the event from the connected user's Google Calendar, regardless
  // of whether it was created here or directly in Google Calendar.
  const handleCancelMeeting = async (event) => {
    setCancellingId(event.id);
    try {
      await deleteEvent(event.id);
      addToast("Meeting cancelled and removed from Google Calendar");
      onRefresh?.();
    } catch (err) {
      if (err.needsReconnect) {
        addToast("Google session expired — click Reconnect and try again.");
      } else if (err.accessDenied) {
        addToast("Google doesn't allow this event to be deleted from this calendar.");
      } else {
        addToast(err.message || "Could not cancel the meeting");
      }
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
          <CalendarClock size={16} />
        </div>
        <h2 className="text-sm font-semibold text-navy">Google Calendar</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{events.length}</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-navy"
        >
          <RefreshCcw size={11} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-av-red">{error.message || "Couldn't load calendar."}</p>}

      {loading && events.length === 0 ? (
        <p className="text-sm text-slate-400">Loading calendar…</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          No Google Calendar events this day.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map((event) => {
            const client = matchClientForEvent(event, clients);
            const done = isTaskDoneToday(event.id, "gcal", date);
            return (
              <div key={event.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <button
                  onClick={() => toggleDailyTask(event.id, "gcal", date)}
                  aria-label={done ? "Mark as not done" : "Mark as done"}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    done ? "border-gold bg-gold" : "border-slate-300 hover:border-gold"
                  }`}
                >
                  {done && <span className="h-2 w-2 rounded-full bg-white" />}
                </button>
                <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-gold/10 text-[10px] font-bold leading-tight text-gold-dark">
                  {isAllDay(event) ? (
                    "ALL DAY"
                  ) : (
                    <>
                      <span>{formatHour(event)}</span>
                      <span className="font-semibold">{formatMeridiem(event)}</span>
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-navy"}`}>
                    {event.summary || "(No title)"}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                    <Clock size={11} />
                    {formatRange(event)}
                  </p>
                </div>
                {client ? (
                  <button
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50"
                  >
                    <User size={13} />
                    {client.first}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleAddClient(event)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-gold-dark transition hover:bg-gold/20"
                    >
                      <UserPlus size={13} />
                      Add as client
                    </button>
                    <button
                      onClick={() => handleAddClient(event, { asFollowUp: true })}
                      title="Add as client, and drop them into today's Follow-ups"
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-av-blue/30 bg-av-blue/10 px-2.5 py-1.5 text-xs font-semibold text-av-blue transition hover:bg-av-blue/20"
                    >
                      <CalendarCheck size={13} />
                      Add as follow-up
                    </button>
                  </>
                )}
                {done && client?.email && (
                  <button
                    onClick={() => openGmailCompose(feedbackEmailDraft(client, { meetingLabel: event.summary }))}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-av-blue/10 px-2.5 py-1.5 text-xs font-semibold text-av-blue transition hover:bg-av-blue/20"
                  >
                    <Mail size={13} />
                    Feedback
                  </button>
                )}
                <button
                  onClick={() => handleCancelMeeting(event)}
                  disabled={cancellingId === event.id}
                  aria-label="Delete event from Google Calendar"
                  title="Delete from Google Calendar"
                  className="flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-av-red/30 hover:bg-av-red/5 hover:text-av-red disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <AddClientModal
        open={Boolean(draft)}
        initialValues={draft}
        onClose={() => setDraft(null)}
        onCreated={(created) => navigate(`/clients/${created.id}`)}
      />
    </div>
  );
}

function Header() {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
        <CalendarClock size={16} />
      </div>
      <h2 className="text-sm font-semibold text-navy">Google Calendar</h2>
    </div>
  );
}

function ConnectButton({ status, onConnect, onToast }) {
  // A full-page redirect to Google — nothing after the await runs in this
  // tab, so there's no post-connect toast here (the provider shows one once
  // Google redirects back).
  const handle = async () => {
    try {
      await onConnect();
    } catch (err) {
      onToast(err.message || "Could not connect to Google Calendar");
    }
  };
  const label = status === "expired" || status === "revoked" ? "Reconnect" : "Connect";
  return (
    <button
      onClick={handle}
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
    >
      <Link2 size={13} />
      {label}
    </button>
  );
}

function formatHour(event) {
  const d = eventStart(event);
  if (!d) return "";
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const m = d.getMinutes();
  return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
}

function formatMeridiem(event) {
  const d = eventStart(event);
  if (!d) return "";
  return d.getHours() >= 12 ? "PM" : "AM";
}

function formatRange(event) {
  if (isAllDay(event)) return "All day";
  const start = eventStart(event);
  const endRaw = event.end?.dateTime;
  if (!start) return "";
  const opts = { hour: "numeric", minute: "2-digit" };
  const startText = start.toLocaleTimeString("en-US", opts);
  if (!endRaw) return startText;
  return `${startText} – ${new Date(endRaw).toLocaleTimeString("en-US", opts)}`;
}
