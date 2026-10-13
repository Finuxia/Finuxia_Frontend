import { useMemo, useState } from "react";
import { ListChecks, Clock, User, Repeat } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { formatTime } from "../lib/notifications";
import { formatDate } from "../lib/followUp";

/**
 * Reminders/to-do items for the day My Day is showing. A separate entity
 * from meetings — visually distinct (blue accent vs the gold/navy meeting
 * styling) and never folded into meeting reports or analytics.
 *
 * On today: overdue (still pending, due before today) + today's reminders,
 * sorted overdue -> timed -> untimed. On any other date: just that date's
 * reminders, since "overdue" is inherently a today-relative concept.
 *
 * A recurring reminder is a *series* of real rows (see src.reminders on the
 * backend — up to RECURRENCE_HORIZON occurrences are pre-created, sharing a
 * seriesId), each with its own dueDate and status — not one row projected
 * forward client-side. So "due on this date" is exact-date matching here,
 * same as a non-repeating reminder; the backend already put one row on
 * every date this series is due.
 */
export default function RemindersSection({ date, isToday, reminders, onToggleStatus, onEdit }) {
  const { clients } = useClients();
  const [showCompleted, setShowCompleted] = useState(false);

  const clientById = useMemo(() => new Map(clients.map((c) => [String(c.id), c])), [clients]);

  const visible = useMemo(() => {
    const inScope = (r) => (isToday ? r.dueDate <= date : r.dueDate === date);
    const statusOn = (r) => r.status;

    const pending = reminders.filter((r) => statusOn(r) === "pending" && inScope(r));
    pending.sort((a, b) => {
      const aOverdue = isToday && a.dueDate < date;
      const bOverdue = isToday && b.dueDate < date;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (Boolean(a.dueTime) !== Boolean(b.dueTime)) return a.dueTime ? -1 : 1;
      if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
      return 0;
    });
    const completed = showCompleted ? reminders.filter((r) => statusOn(r) === "completed" && inScope(r)) : [];
    const hasCompleted = reminders.some((r) => statusOn(r) === "completed" && inScope(r));
    return { pending, completed, hasCompleted };
  }, [reminders, date, isToday, showCompleted]);

  const count = visible.pending.length;
  if (count === 0 && !visible.hasCompleted) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-av-blue/10 text-av-blue">
          <ListChecks size={16} />
        </div>
        <h2 className="text-sm font-semibold text-navy">Reminders</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
        {visible.hasCompleted && (
          <button
            onClick={() => setShowCompleted((s) => !s)}
            className="ml-auto text-xs font-medium text-slate-400 transition hover:text-navy"
          >
            {showCompleted ? "Hide completed" : "Show completed"}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {[...visible.pending, ...visible.completed].map((r) => {
          const effectiveStatus = r.status;
          const overdue = isToday && effectiveStatus === "pending" && r.dueDate < date;
          const done = effectiveStatus === "completed";
          const client = r.clientRef ? clientById.get(String(r.clientRef)) : null;
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm ${
                overdue ? "border-av-red/30" : "border-slate-200"
              }`}
            >
              <button
                onClick={() => onToggleStatus(r, done ? "pending" : "completed")}
                aria-label={done ? "Mark as not done" : "Mark as done"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  done ? "border-av-blue bg-av-blue" : "border-slate-300 hover:border-av-blue"
                }`}
              >
                {done && <span className="h-2 w-2 rounded-full bg-white" />}
              </button>
              <button onClick={() => onEdit(r)} className="min-w-0 flex-1 text-left">
                <p
                  className={`flex items-center gap-1.5 truncate text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-navy"}`}
                >
                  <span className="truncate">{r.title}</span>
                  {r.repeat && r.repeat !== "none" && <Repeat size={11} className="shrink-0 text-slate-400" aria-label="Repeats" />}
                </p>
                <p className="flex items-center gap-2 truncate text-xs text-slate-400">
                  {overdue ? (
                    <span className="font-semibold text-av-red">Overdue — {formatDate(r.dueDate)}</span>
                  ) : r.dueTime ? (
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatTime(r.dueTime)}
                    </span>
                  ) : (
                    <span>No time set</span>
                  )}
                  {client && (
                    <span className="flex items-center gap-1">
                      <User size={11} />
                      {client.first} {client.last}
                    </span>
                  )}
                </p>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
