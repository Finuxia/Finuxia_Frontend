import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CalendarDays, Flame, PhoneCall, CalendarClock, FileText, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import { todayLong, todayISO, addDays, formatDate } from "../lib/followUp";
import { formatTime } from "../lib/notifications";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import ClientCard from "../components/clients/ClientCard";
import RescheduleModal from "../components/clients/RescheduleModal";
import GoogleMeetingsSection from "../components/integrations/GoogleMeetingsSection";
import RemindersSection from "../components/clients/RemindersSection";
import ReminderModal from "../components/clients/ReminderModal";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function MyDay() {
  const { clients, isTaskDoneToday, toggleDailyTask, snooze, rescheduleFollowUp, rescheduleMeeting, toggleFileStatus } = useClients();
  const { status, fetchDay, getDayState } = useGoogleCalendar();
  const { addToast } = useToast();
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [reminderModal, setReminderModal] = useState(null); // null | 'create' | reminder object being edited

  const loadReminders = () =>
    api
      .getReminders()
      .then((all) => setReminders(all.filter((r) => (r.kind || "reminder") === "reminder")))
      .catch(() => {});
  useEffect(() => {
    loadReminders();
  }, []);

  // --- selected date lives in the URL (?date=YYYY-MM-DD), local-time safe ---
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDate = searchParams.get("date");
  const selectedDate = urlDate && ISO_RE.test(urlDate) ? urlDate : todayISO();
  const isToday = selectedDate === todayISO();

  const setSelectedDate = (date) => {
    const next = new URLSearchParams(searchParams);
    if (date === todayISO()) next.delete("date");
    else next.set("date", date);
    setSearchParams(next);
  };

  // --- application data for the selected date ---
  const dueClients = useMemo(() => clients.filter((c) => c.followUpDate === selectedDate), [clients, selectedDate]);
  const meetings = useMemo(() => clients.filter((c) => c.meeting?.date === selectedDate), [clients, selectedDate]);
  const meetingIds = useMemo(() => new Set(meetings.map((c) => c.id)), [meetings]);

  const highPriority = useMemo(() => dueClients.filter((c) => c.priority === "High" && !meetingIds.has(c.id)), [dueClients, meetingIds]);
  const calls = useMemo(() => dueClients.filter((c) => c.priority !== "High" && !meetingIds.has(c.id)), [dueClients, meetingIds]);
  // Files aren't date-bound; only surface them on today's view.
  const pendingFiles = useMemo(() => {
    if (!isToday) return [];
    const items = [];
    clients.forEach((c) => (c.files || []).filter((f) => f.status === "pending").forEach((f) => items.push({ client: c, file: f })));
    return items;
  }, [clients, isToday]);

  // --- Google Calendar data for the selected date (cached + de-duped) ---
  useEffect(() => {
    if (status === "connected") fetchDay(selectedDate).catch(() => {});
  }, [status, selectedDate, fetchDay]);
  const dayState = getDayState(selectedDate);
  const googleEvents = dayState.events;

  // --- reminders for the selected date (same visibility rule as RemindersSection) ---
  const pendingReminders = useMemo(
    () =>
      reminders.filter((r) => {
        const due = isToday ? r.dueDate <= selectedDate : r.dueDate === selectedDate;
        return r.status === "pending" && due;
      }),
    [reminders, selectedDate, isToday]
  );
  const completedRemindersForDate = useMemo(
    () =>
      reminders.filter((r) => {
        const due = isToday ? r.dueDate <= selectedDate : r.dueDate === selectedDate;
        return r.status === "completed" && due;
      }),
    [reminders, selectedDate, isToday]
  );

  // --- stats for the selected date ---
  // Reminders are counted here (My Day's own daily progress) but never in
  // Reports/analytics — those pages never query the reminders endpoint.
  const totalItems =
    highPriority.length +
    calls.length +
    meetings.length +
    pendingFiles.length +
    googleEvents.length +
    pendingReminders.length +
    completedRemindersForDate.length;
  const doneCount =
    highPriority.filter((c) => isTaskDoneToday(c.id, "high", selectedDate)).length +
    calls.filter((c) => isTaskDoneToday(c.id, "call", selectedDate)).length +
    meetings.filter((c) => isTaskDoneToday(c.id, "meeting", selectedDate)).length +
    pendingFiles.filter(({ file }) => file.status === "done").length +
    googleEvents.filter((e) => isTaskDoneToday(e.id, "gcal", selectedDate)).length +
    completedRemindersForDate.length;
  const remainingCount = totalItems - doneCount;
  const progressPct = totalItems === 0 ? 0 : Math.round((doneCount / totalItems) * 100);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl bg-navy px-6 py-7 text-white shadow-lg sm:px-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{isToday ? "Your day, at a glance." : "That day, at a glance."}</h1>

          {/* Date navigator */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/20"
              aria-label="Previous day"
            >
              <ChevronLeft size={16} />
            </button>
            <label className="relative flex cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white">
              <CalendarDays size={15} className="text-gold" />
              {todayLong(selectedDate)}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                onClick={(e) => {
                  // Open the native calendar immediately on click (supported in
                  // modern browsers); falls back to normal focus behavior.
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {
                    /* showPicker not allowed here — ignore */
                  }
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Select date"
              />
            </label>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/20"
              aria-label="Next day"
            >
              <ChevronRight size={16} />
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayISO())}
                className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-gold-light"
              >
                Today
              </button>
            )}
            <Link
              to="/meetings"
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <CalendarClock size={13} />
              Meetings Calendar
            </Link>
            <button
              onClick={() => setReminderModal("create")}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <Plus size={13} />
              Add Reminder
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Remaining" value={remainingCount} accent="text-gold" />
          <Stat label="Done" value={doneCount} accent="text-av-green" />
          <Stat label="Total" value={totalItems} accent="text-white" />
        </div>

        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
            <span>Progress</span>
            <span className="font-semibold text-white">{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gold transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </section>

      {totalItems === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          Nothing scheduled for {formatDate(selectedDate)}.
        </div>
      )}

      <RemindersSection
        date={selectedDate}
        isToday={isToday}
        reminders={reminders}
        onEdit={(r) => setReminderModal(r)}
        onToggleStatus={async (r, status) => {
          try {
            await api.setReminderStatus(r.id, status);
            loadReminders();
          } catch (err) {
            addToast(err.message || "Could not update reminder");
          }
        }}
      />

      <Section icon={Flame} title="High Priority" count={highPriority.length}>
        {highPriority.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            done={isTaskDoneToday(client.id, "high", selectedDate)}
            onToggleDone={() => toggleDailyTask(client.id, "high", selectedDate)}
            onSnooze={(id) => {
              snooze(id, 3);
              addToast(`Follow-up snoozed 3 days for ${client.first} ${client.last}`.trim());
            }}
            onReschedule={(c) => setRescheduleTarget({ type: "followup", client: c })}
          />
        ))}
      </Section>

      <Section icon={PhoneCall} title="Calls" count={calls.length}>
        {calls.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            done={isTaskDoneToday(client.id, "call", selectedDate)}
            onToggleDone={() => toggleDailyTask(client.id, "call", selectedDate)}
            onSnooze={(id) => {
              snooze(id, 3);
              addToast(`Follow-up snoozed 3 days for ${client.first} ${client.last}`.trim());
            }}
            onReschedule={(c) => setRescheduleTarget({ type: "followup", client: c })}
          />
        ))}
      </Section>

      <Section icon={CalendarClock} title="Meetings" count={meetings.length}>
        {meetings.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            subtitle={`${client.meeting.label ?? "Meeting"} at ${formatTime(client.meeting.time || "09:00")}`}
            done={isTaskDoneToday(client.id, "meeting", selectedDate)}
            onToggleDone={() => toggleDailyTask(client.id, "meeting", selectedDate)}
            onReschedule={(c) => setRescheduleTarget({ type: "meeting", client: c })}
            showFeedbackEmail
          />
        ))}
      </Section>

      <GoogleMeetingsSection
        date={selectedDate}
        events={googleEvents}
        loading={dayState.status === "loading"}
        error={dayState.error}
        onRefresh={() => fetchDay(selectedDate, { force: true }).catch(() => {})}
      />

      <Section icon={FileText} title="Pending Files" count={pendingFiles.length}>
        {pendingFiles.map(({ client, file }) => (
          <div key={file.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <button
              onClick={() => toggleFileStatus(client.id, file.id)}
              aria-label={file.status === "done" ? "Mark file pending" : "Mark file done"}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                file.status === "done" ? "border-gold bg-gold" : "border-slate-300 hover:border-gold"
              }`}
            >
              {file.status === "done" && <span className="h-2 w-2 rounded-full bg-white" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-semibold ${file.status === "done" ? "text-slate-400 line-through" : "text-navy"}`}>
                {file.name}
              </p>
              <p className="truncate text-xs text-slate-400">
                {client.first} {client.last}
              </p>
            </div>
          </div>
        ))}
      </Section>

      {rescheduleTarget && (
        <RescheduleModal
          title={rescheduleTarget.type === "meeting" ? "Reschedule Meeting" : "Reschedule Follow-up"}
          currentDate={rescheduleTarget.type === "meeting" ? rescheduleTarget.client.meeting?.date : rescheduleTarget.client.followUpDate}
          onClose={() => setRescheduleTarget(null)}
          onSave={(newDate) => {
            const c = rescheduleTarget.client;
            if (rescheduleTarget.type === "meeting") rescheduleMeeting(c.id, newDate, c.meeting?.time);
            else rescheduleFollowUp(c.id, newDate);
            addToast(`Rescheduled to ${formatDate(newDate)} for ${c.first} ${c.last}`.trim());
          }}
        />
      )}

      {reminderModal && (
        <ReminderModal
          initial={reminderModal === "create" ? { dueDate: selectedDate } : reminderModal}
          onClose={() => setReminderModal(null)}
          onSubmit={async (payload) => {
            if (reminderModal === "create") {
              await api.createReminder(payload);
              addToast("Reminder created");
            } else {
              await api.updateReminder(reminderModal.id, payload);
              addToast("Reminder updated");
            }
            loadReminders();
          }}
          onDelete={
            reminderModal !== "create"
              ? async (scope) => {
                  if (scope === "series" && reminderModal.seriesId) {
                    await api.deleteReminderSeries(reminderModal.seriesId);
                    addToast("Reminder series deleted");
                  } else {
                    await api.deleteReminder(reminderModal.id);
                    addToast("Reminder deleted");
                  }
                  loadReminders();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, count, children }) {
  if (count === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
          <Icon size={16} />
        </div>
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-300">{label}</p>
    </div>
  );
}
