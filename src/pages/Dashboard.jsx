import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserCheck, CalendarClock, AlertTriangle, Sparkles, Flame, PhoneCall, FileText, ArrowRight } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useAuth } from "../context/AuthContext";
import { isLead } from "../lib/pipeline";
import { formatTime } from "../lib/notifications";
import { todayISO, todayLong } from "../lib/followUp";
import { runPipeline, filterByMonth, clientActivityDate, currentMonthKey, monthLabel } from "../lib/chartPipeline";
import PipelineBarChart from "../components/PipelineBarChart";
import FollowUpDonutChart from "../components/FollowUpDonutChart";
import MonthFilter from "../components/MonthFilter";

export default function Dashboard() {
  const { clients } = useClients();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = todayISO();

  // Charts default to the current calendar month.
  const [month, setMonth] = useState(currentMonthKey());
  const monthClients = useMemo(
    () => runPipeline(clients, [filterByMonth(month, clientActivityDate)]),
    [clients, month]
  );

  const totalLeads = clients.filter((c) => isLead(c.currentStage)).length;
  const totalClients = clients.filter((c) => !isLead(c.currentStage)).length;
  const dueToday = clients.filter((c) => c.nextFollowUp === "Today").length;
  const overdue = clients.filter((c) => c.nextFollowUp === "Overdue").length;
  const newLeadsThisWeek = clients.filter((c) => {
    if (!isLead(c.currentStage)) return false;
    const joined = new Date(c.joined);
    const diffDays = Math.round((Date.now() - joined.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }).length;

  const highPriority = useMemo(
    () =>
      clients.filter(
        (c) => c.priority === "High" && (c.nextFollowUp === "Overdue" || c.nextFollowUp === "Today")
      ),
    [clients]
  );
  const meetingsToday = useMemo(() => clients.filter((c) => c.meeting?.date === today), [clients, today]);
  const meetingIds = new Set(meetingsToday.map((c) => c.id));
  const calls = useMemo(
    () => clients.filter((c) => c.nextFollowUp === "Today" && !meetingIds.has(c.id)),
    [clients, today]
  );
  const pendingFiles = useMemo(() => {
    const items = [];
    clients.forEach((c) => (c.files || []).filter((f) => f.status === "pending").forEach((f) => items.push({ client: c, file: f })));
    return items;
  }, [clients]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Welcome back, {user?.name?.split(" ")[0]}.</h1>
        <p className="text-sm text-slate-500">{todayLong()}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="Total Leads" value={totalLeads} color="text-av-blue" bg="bg-av-blue/10" />
        <StatCard icon={UserCheck} label="Total Clients" value={totalClients} color="text-av-green" bg="bg-av-green/10" />
        <StatCard icon={CalendarClock} label="Due Today" value={dueToday} color="text-av-amber" bg="bg-av-amber/10" />
        <StatCard icon={AlertTriangle} label="Overdue" value={overdue} color="text-av-red" bg="bg-av-red/10" />
        <StatCard icon={Sparkles} label="New Leads This Week" value={newLeadsThisWeek} color="text-av-purple" bg="bg-av-purple/10" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthFilter value={month} onChange={setMonth} includeAll />
        <button
          onClick={() => navigate(`/reports?month=${month}`)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gold-dark transition hover:text-gold"
        >
          View full report
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy">Pipeline by Stage</h2>
            <span className="text-xs text-slate-400">
              {monthClients.length} {month ? `in ${monthLabel(month)}` : "total"}
            </span>
          </div>
          <PipelineBarChart clients={monthClients} onSelectStage={(stageId) => navigate(`/reports?month=${month}&stage=${stageId}`)} />
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-navy">Follow-ups by Urgency</h2>
          </div>
          <FollowUpDonutChart clients={monthClients} />
        </section>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-navy">Today's Priorities</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <PriorityGroup icon={Flame} title="High Priority" items={highPriority.map((c) => ({ id: c.id, label: `${c.first} ${c.last}` }))} onSelect={(id) => navigate(`/clients/${id}`)} empty="Nothing urgent." />
          <PriorityGroup icon={PhoneCall} title="Calls" items={calls.map((c) => ({ id: c.id, label: `${c.first} ${c.last}` }))} onSelect={(id) => navigate(`/clients/${id}`)} empty="No calls scheduled." />
          <PriorityGroup
            icon={CalendarClock}
            title="Meetings"
            items={meetingsToday.map((c) => ({
              id: c.id,
              label: `${c.meeting.label ?? "Meeting"} at ${formatTime(c.meeting.time || "09:00")} — ${c.first} ${c.last}`,
            }))}
            onSelect={(id) => navigate(`/clients/${id}`)}
            empty="No meetings today."
          />
          <PriorityGroup
            icon={FileText}
            title="Files Waiting"
            items={pendingFiles.map(({ client, file }) => ({ id: client.id, label: `${file.name} — ${client.first} ${client.last}` }))}
            onSelect={(id) => navigate(`/clients/${id}`)}
            empty="No pending files."
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${bg} ${color}`}>
        <Icon size={17} />
      </div>
      <p className="text-2xl font-bold text-navy">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function PriorityGroup({ icon: Icon, title, items, onSelect, empty }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy">
        <Icon size={15} className="text-gold-dark" />
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={`${item.id}-${i}`}>
              <button
                onClick={() => onSelect(item.id)}
                className="w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-navy"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
