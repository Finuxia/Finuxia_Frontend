import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  PhoneCall,
  Clock3,
  MessageSquareText,
  AlertTriangle,
  Calendar,
  BellPlus,
  Sparkles,
  Plus,
  Repeat,
  X,
} from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import { getStage, getMissedStage } from "../lib/pipeline";
import { daysAgoLabel, daysUntil, formatDate, todayISO } from "../lib/followUp";
import { api } from "../lib/api";
import ReminderModal from "../components/ReminderModal";
import FollowUpRuleModal from "../components/FollowUpRuleModal";

const PRIORITY_BADGE = {
  High: "bg-av-red/10 text-av-red",
  Medium: "bg-av-amber/10 text-av-amber",
  Low: "bg-av-green/10 text-av-green",
};

const GROUPS = [
  { key: "Today", label: "Today", icon: CalendarClock },
  { key: "This week", label: "This Week", icon: Calendar },
  { key: "Overdue", label: "Overdue", icon: AlertTriangle },
];

export default function FollowUps() {
  const { clients, markContacted, snooze } = useClients();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [reminderFor, setReminderFor] = useState(null); // client to add a follow-up item for, or null
  const [editingFollowUp, setEditingFollowUp] = useState(null); // existing follow-up item being edited/deleted
  const [automatingClient, setAutomatingClient] = useState(null); // client to set up AI automation for, or null
  const [pickerMode, setPickerMode] = useState(null); // null | "followup" | "automate" — "which client?" step
  const [pickerClientId, setPickerClientId] = useState("");
  const [followUpItems, setFollowUpItems] = useState([]);

  const loadFollowUps = () =>
    api
      .getReminders()
      .then((all) => setFollowUpItems(all.filter((r) => r.kind === "followup" && r.status === "pending")))
      .catch(() => {});
  useEffect(() => {
    loadFollowUps();
  }, []);

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        clients: clients.filter((c) => c.nextFollowUp === g.key),
      })),
    [clients]
  );

  const missed = useMemo(() => {
    const today = todayISO();
    return clients
      .map((c) => ({ client: c, stage: getMissedStage(c, today) }))
      .filter((x) => x.stage);
  }, [clients]);

  // A recurring follow-up (e.g. daily) pre-materializes several real rows
  // sharing a seriesId — showing every one of them would mean the same
  // person shows up 7 times in a week. Keep only the soonest still-pending
  // occurrence per series (or per plain item), then bucket that into
  // Overdue / Today / This Week / Next Week for display.
  const followUpBuckets = useMemo(() => {
    const bySeries = new Map();
    for (const item of followUpItems) {
      const key = item.seriesId || `single-${item.id}`;
      const existing = bySeries.get(key);
      if (!existing || item.dueDate < existing.dueDate) bySeries.set(key, item);
    }
    const buckets = { Overdue: [], Today: [], "This week": [], "Next week": [] };
    for (const item of bySeries.values()) {
      const diff = daysUntil(item.dueDate);
      if (diff < 0) buckets.Overdue.push(item);
      else if (diff === 0) buckets.Today.push(item);
      else if (diff <= 7) buckets["This week"].push(item);
      else if (diff <= 14) buckets["Next week"].push(item);
    }
    Object.values(buckets).forEach((list) => list.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
    return buckets;
  }, [followUpItems]);
  const totalFollowUpItems = Object.values(followUpBuckets).reduce((n, list) => n + list.length, 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Follow-ups</h1>
          <p className="text-sm text-slate-500">Everyone waiting to hear from you, grouped by urgency.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setPickerClientId("");
              setPickerMode("followup");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-av-blue/30 bg-av-blue/10 px-4 py-2 text-sm font-semibold text-av-blue transition hover:bg-av-blue/20"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add a Follow-up
          </button>
          <button
            onClick={() => {
              setPickerClientId("");
              setPickerMode("automate");
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:bg-gold-light"
          >
            <Sparkles size={16} strokeWidth={2.5} />
            Automate a Follow-up
          </button>
        </div>
      </div>

      {missed.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-av-red/10 text-av-red">
              <AlertTriangle size={16} />
            </div>
            <h2 className="text-sm font-semibold text-navy">Missed Meetings</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {missed.length}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {missed.map(({ client: c, stage }) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-av-red/30 bg-white px-4 py-3 shadow-sm"
              >
                <button onClick={() => navigate(`/clients/${c.id}`)} className="min-w-[160px] flex-1 text-left">
                  <p className="text-sm font-semibold text-navy">
                    {c.first} {c.last}
                  </p>
                  <p className="text-xs text-av-red">
                    {stage.label} was {daysAgoLabel(stage.date).toLowerCase()} — no action taken
                  </p>
                </button>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={() => {
                      markContacted(c.id);
                      addToast(`Marked ${c.first} ${c.last} as contacted`);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
                  >
                    <PhoneCall size={13} />
                    Contacted
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalFollowUpItems > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-av-blue/10 text-av-blue">
              <BellPlus size={16} />
            </div>
            <h2 className="text-sm font-semibold text-navy">Follow-up Reminders</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {totalFollowUpItems}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {["Overdue", "Today", "This week", "Next week"].map((bucketKey) => {
              const items = followUpBuckets[bucketKey];
              if (!items.length) return null;
              return (
                <div key={bucketKey}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{bucketKey}</p>
                  <div className="flex flex-col gap-2.5">
                    {items.map((item) => {
                      const client = item.clientRef ? clients.find((c) => String(c.id) === String(item.clientRef)) : null;
                      const overdue = bucketKey === "Overdue";
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm ${
                            overdue ? "border-av-red/30" : "border-slate-200"
                          }`}
                        >
                          <button onClick={() => setEditingFollowUp(item)} className="min-w-0 flex-1 text-left">
                            <p className={`flex items-center gap-1.5 text-sm font-semibold ${overdue ? "text-av-red" : "text-navy"}`}>
                              <span className="truncate">{item.title}</span>
                              {item.seriesId && <Repeat size={11} className="shrink-0 text-slate-400" aria-label="Repeats" />}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatDate(item.dueDate)}
                              {client ? ` · ${client.first} ${client.last}` : ""}
                            </p>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.key}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
              <group.icon size={16} />
            </div>
            <h2 className="text-sm font-semibold text-navy">{group.label}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {group.clients.length}
            </span>
          </div>

          {group.clients.length === 0 ? (
            <p className="pl-10 text-sm text-slate-400">Nothing here.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {group.clients.map((c) => {
                const stage = getStage(c.currentStage);
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <button
                      onClick={() => navigate(`/clients/${c.id}`)}
                      className="min-w-[160px] flex-1 text-left"
                    >
                      <p className="text-sm font-semibold text-navy">
                        {c.first} {c.last}
                      </p>
                      <p className="text-xs text-slate-400">
                        {stage?.label} · Last contact {daysAgoLabel(c.lastContactDate).toLowerCase()}
                      </p>
                    </button>

                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[c.priority]}`}>
                      {c.priority}
                    </span>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        onClick={() => {
                          markContacted(c.id);
                          addToast(`Marked ${c.first} ${c.last} as contacted`);
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
                      >
                        <PhoneCall size={13} />
                        Contacted
                      </button>
                      <button
                        onClick={() => {
                          snooze(c.id, 3);
                          addToast(`Snoozed ${c.first} ${c.last} 3 days`);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <Clock3 size={13} />
                        Snooze
                      </button>
                      <button
                        onClick={() => navigate(`/clients/${c.id}?ai=1`)}
                        className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-dark transition hover:bg-gold/20"
                      >
                        <MessageSquareText size={13} />
                        Generate Message
                      </button>
                      <button
                        onClick={() => setReminderFor(c)}
                        className="flex items-center gap-1.5 rounded-lg border border-av-blue/30 bg-av-blue/10 px-3 py-1.5 text-xs font-semibold text-av-blue transition hover:bg-av-blue/20"
                      >
                        <BellPlus size={13} />
                        Add Follow-up
                      </button>
                      <button
                        onClick={() => setAutomatingClient(c)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <Sparkles size={13} />
                        Automate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {reminderFor && (
        <ReminderModal
          kind="followup"
          lockClient={reminderFor}
          initial={{
            title: `Follow up with ${reminderFor.first} ${reminderFor.last}`.trim(),
            dueDate: todayISO(),
          }}
          onClose={() => setReminderFor(null)}
          onSubmit={async (payload) => {
            await api.createReminder(payload);
            addToast(`Follow-up set for ${reminderFor.first} ${reminderFor.last}`);
            setReminderFor(null);
            loadFollowUps();
          }}
        />
      )}

      {editingFollowUp && (
        <ReminderModal
          kind="followup"
          initial={editingFollowUp}
          onClose={() => setEditingFollowUp(null)}
          onSubmit={async (payload) => {
            await api.updateReminder(editingFollowUp.id, payload);
            addToast("Follow-up updated");
            setEditingFollowUp(null);
            loadFollowUps();
          }}
          onDelete={async (scope) => {
            if (scope === "series" && editingFollowUp.seriesId) {
              await api.deleteReminderSeries(editingFollowUp.seriesId);
              addToast("Follow-up series deleted");
            } else {
              await api.deleteReminder(editingFollowUp.id);
              addToast("Follow-up deleted");
            }
            setEditingFollowUp(null);
            loadFollowUps();
          }}
        />
      )}

      {pickerMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setPickerMode(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy">
                {pickerMode === "automate" ? "Automate a Follow-up" : "Add a Follow-up"}
              </h2>
              <button
                onClick={() => setPickerMode(null)}
                className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Works the same whether or not this client shows up in a bucket above — pick anyone.
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Client</span>
              <select
                value={pickerClientId}
                onChange={(e) => setPickerClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              >
                <option value="">Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first} {c.last}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setPickerMode(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const client = clients.find((c) => String(c.id) === String(pickerClientId));
                  if (!client) return;
                  const mode = pickerMode;
                  setPickerMode(null);
                  if (mode === "automate") setAutomatingClient(client);
                  else setReminderFor(client);
                }}
                disabled={!pickerClientId}
                className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {automatingClient && (
        <FollowUpRuleModal client={automatingClient} onClose={() => setAutomatingClient(null)} />
      )}
    </div>
  );
}
