import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Link2, Unlink, RefreshCcw, Plus, Pencil, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import { useToast } from "../context/ToastContext";
import { eventStart } from "../services/googleCalendarApi";
import GoogleEventForm from "./GoogleEventForm";

// Groups upcoming events by local calendar date — once there are more than a
// couple of days' worth, one long flat list gets a lot of scrolling, so each
// day becomes its own collapsible section instead.
function groupEventsByDate(events) {
  const groups = [];
  const byKey = new Map();
  events.forEach((event) => {
    const start = eventStart(event);
    const key = start ? start.toDateString() : "unknown";
    let group = byKey.get(key);
    if (!group) {
      group = { key, date: start, events: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.events.push(event);
  });
  return groups;
}

function formatGroupLabel(date) {
  if (!date) return "Unscheduled";
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const STATUS_META = {
  connected: { label: "Connected", dot: "bg-av-green", text: "text-av-green" },
  expired: { label: "Expired", dot: "bg-av-red", text: "text-av-red" },
  revoked: { label: "Revoked", dot: "bg-av-red", text: "text-av-red" },
  disconnected: { label: "Disconnected", dot: "bg-slate-300", text: "text-slate-400" },
};

export default function GoogleCalendarPanel() {
  const {
    isConfigured,
    status,
    googleEmail,
    connect,
    disconnect,
    events,
    eventsLoading,
    eventsError,
    refreshEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    isAppEvent,
  } = useGoogleCalendar();
  const { addToast } = useToast();
  const [formMode, setFormMode] = useState(null); // null | 'create' | event object being edited
  const [deletingId, setDeletingId] = useState(null);
  const [expandedDates, setExpandedDates] = useState(() => new Set());
  const [panelOpen, setPanelOpen] = useState(false);

  const eventGroups = useMemo(() => groupEventsByDate(events), [events]);

  // The soonest day starts expanded so the panel isn't empty-looking; the
  // rest stay collapsed until asked for. Re-syncs whenever the group of
  // dates actually changes (not on every events refresh with the same days).
  const groupKeysSignature = eventGroups.map((g) => g.key).join("|");
  useEffect(() => {
    setExpandedDates(eventGroups.length ? new Set([eventGroups[0].key]) : new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupKeysSignature]);

  const toggleDate = (key) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Load the upcoming list once when connected (the provider no longer
  // auto-fetches). refreshEvents is stable, so this runs only on status change.
  useEffect(() => {
    if (status === "connected") refreshEvents().catch(() => {});
  }, [status, refreshEvents]);

  if (!isConfigured) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-navy">Google Calendar</h2>
        <p className="text-sm text-slate-500">
          Not configured yet — add a Google OAuth client as{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-navy">GOOGLE_CALENDAR_CLIENT_ID</code> on
          the backend to enable this.
        </p>
      </section>
    );
  }

  const meta = STATUS_META[status] ?? STATUS_META.disconnected;

  const handleConnect = async () => {
    // A full-page redirect to Google — nothing after this line runs; the
    // provider shows a toast once Google redirects back here.
    try {
      await connect();
    } catch (err) {
      addToast(err.message || "Could not connect to Google Calendar");
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    addToast("Google Calendar disconnected");
  };

  const handleCreate = async (payload) => {
    await createEvent(payload);
    addToast("Event added to Google Calendar");
    refreshEvents().catch(() => {});
  };

  const handleUpdate = async (eventId, payload) => {
    await updateEvent(eventId, payload);
    addToast("Event updated");
    refreshEvents().catch(() => {});
  };

  const handleDelete = async (event) => {
    setDeletingId(event.id);
    try {
      await deleteEvent(event.id);
      addToast("Event deleted");
      refreshEvents().catch(() => {});
    } catch (err) {
      if (err.needsReconnect) {
        addToast("Google session expired — reconnect and try again.");
      } else if (err.accessDenied) {
        addToast("Google doesn't allow this event to be deleted from this calendar.");
      } else {
        addToast(err.message || "Could not delete this event");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy">Google Calendar</h2>
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <span className={meta.text}>{meta.label}</span>
        </span>
      </div>
      <p className="mb-4 text-xs text-slate-400">{googleEmail || "Not connected to a Google account"}</p>

      {(status === "expired" || status === "revoked") && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-av-red/10 px-3 py-2 text-xs text-av-red">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Your Google access {status === "revoked" ? "was revoked" : "expired"}. Reconnect to keep syncing meetings.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {status === "connected" ? (
          <>
            <button
              onClick={() => setFormMode("create")}
              className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
            >
              <Plus size={13} />
              New Event
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Unlink size={13} />
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
          >
            <Link2 size={13} />
            {status === "expired" || status === "revoked" ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </button>
        )}
      </div>

      {status === "connected" && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              aria-expanded={panelOpen}
              className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400 transition hover:text-navy"
            >
              Next up
              {events.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-slate-500">
                  {events.length}
                </span>
              )}
              <ChevronDown size={13} className={`transition-transform ${panelOpen ? "rotate-180" : ""}`} />
            </button>
            <button
              onClick={() => refreshEvents().catch(() => {})}
              disabled={eventsLoading}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-navy"
            >
              <RefreshCcw size={11} className={eventsLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {eventsError && <p className="mb-2 text-xs text-av-red">{eventsError.message}</p>}

          {!panelOpen ? null : eventsLoading && events.length === 0 ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming events on your calendar.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {eventGroups.map((group) => {
                const open = expandedDates.has(group.key);
                return (
                  <div key={group.key} className="overflow-hidden rounded-lg border border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleDate(group.key)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-2 bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100"
                    >
                      <span className="text-xs font-semibold text-navy">{formatGroupLabel(group.date)}</span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-400">
                        {group.events.length} {group.events.length === 1 ? "event" : "events"}
                        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {open && (
                      <ul className="flex flex-col gap-2 p-2">
                        {group.events.map((event) => {
                          const editable = isAppEvent(event);
                          return (
                            <li key={event.id} className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
                              <CalendarDays size={14} className="mt-0.5 shrink-0 text-gold-dark" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-navy">{event.summary || "(No title)"}</p>
                                <p className="text-xs text-slate-400">{formatEventTime(event)}</p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                {editable && (
                                  <button
                                    onClick={() => setFormMode(event)}
                                    aria-label="Edit event"
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-navy"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDelete(event)}
                                  disabled={deletingId === event.id}
                                  aria-label="Delete event from Google Calendar"
                                  title="Delete from Google Calendar"
                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red disabled:opacity-50"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {formMode === "create" && (
        <GoogleEventForm title="New Calendar Event" onSubmit={handleCreate} onClose={() => setFormMode(null)} submitLabel="Create" />
      )}
      {formMode && formMode !== "create" && (
        <GoogleEventForm
          title="Edit Event"
          initial={{ summary: formMode.summary, startISO: formMode.start?.dateTime }}
          onSubmit={(payload) => handleUpdate(formMode.id, payload)}
          onClose={() => setFormMode(null)}
          submitLabel="Save"
        />
      )}
    </section>
  );
}

function formatEventTime(event) {
  const raw = event.start?.dateTime || event.start?.date;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const hasTime = Boolean(event.start?.dateTime);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}
