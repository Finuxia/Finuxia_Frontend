import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, Link2, RefreshCcw, AlertTriangle, Users, CalendarCheck, Presentation, Download, FileText, Table2, CheckCircle2 } from "lucide-react";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import {
  runPipeline,
  filterByDateRange,
  groupByStage,
  countBy,
  classifyEventType,
  eventDate,
  clientActivityDate,
  monthKeyOf,
  monthShortLabel,
  currentMonthKey,
  monthRange,
} from "../lib/chartPipeline";
import { matchClientForEvent, guessClientNameFromEvent } from "../services/meetingClients";
import { toCsv, downloadCsv } from "../lib/csv";
import { PIPELINE_STAGES, STAGE_INDEX } from "../lib/pipeline";
import { openPrintableReport } from "../lib/pdfReport";
import { buildFunnelWorkbook, downloadWorkbook } from "../lib/spreadsheet";

function firstOfMonth(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}
function toInput(d) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { key: "this", label: "This month", range: () => ({ start: firstOfMonth(0), end: firstOfMonth(1) }) },
  { key: "last", label: "Last month", range: () => ({ start: firstOfMonth(-1), end: firstOfMonth(0) }) },
  { key: "3mo", label: "Last 3 months", range: () => ({ start: firstOfMonth(-2), end: firstOfMonth(1) }) },
  { key: "6mo", label: "Last 6 months", range: () => ({ start: firstOfMonth(-5), end: firstOfMonth(1) }) },
];

export default function Reports() {
  const { clients } = useClients();
  const { isConfigured, status, connect, fetchEventsInRange } = useGoogleCalendar();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  // Initialize range from a ?month= link, else the current month.
  const initialMonth = searchParams.get("month") || currentMonthKey();
  const initialRange = monthRange(initialMonth);
  const [preset, setPreset] = useState("this");
  const [startDate, setStartDate] = useState(initialRange.startISO.slice(0, 10));
  const [endDate, setEndDate] = useState(initialRange.endISO.slice(0, 10));

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startISO = new Date(`${startDate}T00:00:00`).toISOString();
  const endISO = new Date(`${endDate}T23:59:59`).toISOString();

  const applyPreset = (p) => {
    setPreset(p.key);
    const { start, end } = p.range();
    setStartDate(toInput(start));
    setEndDate(toInput(new Date(end.getTime() - 1)));
  };

  const loadEvents = async () => {
    if (status !== "connected") return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchEventsInRange(startISO, endISO);
      setEvents(items);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, startDate, endDate]);

  /* -------- client-based metrics (always available, local data) -------- */
  const rangeClients = useMemo(
    () => runPipeline(clients, [filterByDateRange(startISO, endISO, clientActivityDate)]),
    [clients, startISO, endISO]
  );
  const stageBreakdown = useMemo(() => runPipeline(rangeClients, [groupByStage()]), [rangeClients]);

  // Of clients who've had a business (Strategy) meeting, what share made it
  // all the way to Closing? Uses currentStage position, not a separate
  // outcome field — every client's path still funnels through Closing.
  const businessMeetingClients = useMemo(
    () => rangeClients.filter((c) => (STAGE_INDEX[c.currentStage] ?? 0) >= STAGE_INDEX.strategy_meeting),
    [rangeClients]
  );
  const closedClients = useMemo(
    () => businessMeetingClients.filter((c) => (STAGE_INDEX[c.currentStage] ?? 0) >= STAGE_INDEX.closing),
    [businessMeetingClients]
  );
  const closingRate = businessMeetingClients.length
    ? Math.round((closedClients.length / businessMeetingClients.length) * 100)
    : 0;

  /* --------- calendar-based metrics (need a live connection) ----------- */
  const meetingsByType = useMemo(() => runPipeline(events, [countBy(classifyEventType)]), [events]);

  const cpsPerClient = useMemo(() => {
    const cps = events.filter((e) => classifyEventType(e) === "CP");
    const counts = new Map();
    cps.forEach((e) => {
      const client = matchClientForEvent(e, clients);
      const name = client
        ? `${client.first} ${client.last}`
        : (() => {
            const g = guessClientNameFromEvent(e);
            return g ? `${g.first} ${g.last}`.trim() : "Unknown";
          })();
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [events, clients]);

  const monthOverMonth = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const key = monthKeyOf(eventDate(e));
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, count]) => ({ key, count }));
  }, [events]);

  const totalMeetings = events.length;
  const cpMeetings = meetingsByType.find((t) => t.key === "CP")?.count || 0;

  const handleExport = () => {
    const rows = [];
    rows.push(["Finuxia Report", `${startDate} to ${endDate}`]);
    rows.push([]);
    rows.push(["Summary"]);
    rows.push(["Meetings held", totalMeetings]);
    rows.push(["CP meetings", cpMeetings]);
    rows.push(["Clients active", rangeClients.length]);
    rows.push([
      "Business meeting -> Closing rate",
      `${closingRate}% (${closedClients.length}/${businessMeetingClients.length})`,
    ]);
    rows.push([]);
    rows.push(["Meetings by type", "Count"]);
    meetingsByType.forEach((t) => rows.push([t.key, t.count]));
    rows.push([]);
    rows.push(["Meetings month over month", "Count"]);
    monthOverMonth.forEach((m) => rows.push([monthShortLabel(m.key), m.count]));
    rows.push([]);
    rows.push(["Pipeline stage breakdown", "Clients"]);
    stageBreakdown.forEach((s) => rows.push([s.stage.label, s.count]));
    rows.push([]);
    rows.push(["CPs run per client", "Count"]);
    cpsPerClient.forEach((c) => rows.push([c.name, c.count]));

    downloadCsv(`advisorpilot-report-${startDate}_to_${endDate}.csv`, toCsv(rows));
    addToast("Report exported");
  };

  const handleExportPdf = () => {
    try {
      openPrintableReport({
        title: "Finuxia Report",
        rangeLabel: `${startDate} to ${endDate}`,
        stats: [
          { label: "Meetings held", value: totalMeetings },
          { label: "CP meetings", value: cpMeetings },
          { label: "Clients active", value: rangeClients.length },
          { label: "Business meeting -> Closing", value: `${closingRate}% (${closedClients.length}/${businessMeetingClients.length})` },
        ],
        sections: [
          {
            heading: "Meetings by type",
            rows: meetingsByType.map((t) => ({ label: t.key, value: t.count })),
            emptyText: "No meetings in this range.",
          },
          {
            heading: "Meetings month over month",
            rows: monthOverMonth.map((m) => ({ label: monthShortLabel(m.key), value: m.count })),
            emptyText: "No meetings in this range.",
          },
          {
            heading: "Pipeline stage breakdown",
            rows: stageBreakdown.map((s) => ({ label: s.stage.label, value: s.count })),
            emptyText: "No client activity in this range.",
          },
          {
            heading: "CPs run per client",
            rows: cpsPerClient.map((c) => ({ label: c.name, value: c.count })),
            emptyText: "No CP meetings in this range.",
          },
        ],
      });
    } catch (err) {
      addToast(err.message || "Could not open the PDF report");
    }
  };

  // Funnel export — pipeline position for clients active in the report's
  // selected date range (same rangeClients everything else on this page
  // uses), as a styled Excel checklist.
  const handleExportFunnel = async () => {
    try {
      const headerRow = ["#", "Name", "Priority", ...PIPELINE_STAGES.map((s) => s.short)];
      const dataRows = rangeClients.map((c, i) => {
        const currentIdx = STAGE_INDEX[c.currentStage] ?? 0;
        return [
          i + 1,
          `${c.first} ${c.last}`.trim(),
          c.priority || "",
          ...PIPELINE_STAGES.map((s, idx) => idx <= currentIdx),
        ];
      });

      const workbook = await buildFunnelWorkbook({
        banner: `Finuxia Funnel — ${rangeClients.length} clients — ${startDate} to ${endDate}`,
        headerRow,
        dataRows,
        columnWidths: [5, 24, 10, ...PIPELINE_STAGES.map(() => 12)],
      });
      await downloadWorkbook(workbook, `advisorpilot-funnel-${startDate}_to_${endDate}.xlsx`);
      addToast("Funnel exported");
    } catch (err) {
      addToast(err.message || "Could not export the funnel");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reports</h1>
          <p className="text-sm text-slate-500">Aggregate your meetings and pipeline over any date range.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-navy-light"
          >
            <FileText size={14} />
            Export PDF
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy shadow-sm transition hover:bg-slate-50"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={handleExportFunnel}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy shadow-sm transition hover:bg-slate-50"
          >
            <Table2 size={14} />
            Export Funnel
          </button>
        </div>
      </div>

      {/* Filters — single row above all report content */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  preset === p.key ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setPreset("custom");
                  setStartDate(e.target.value);
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-navy outline-none focus:border-gold"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setPreset("custom");
                  setEndDate(e.target.value);
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-navy outline-none focus:border-gold"
              />
            </label>
          </div>
          {status === "connected" && (
            <button
              onClick={loadEvents}
              disabled={loading}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>
      </section>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={CalendarCheck} label="Meetings held" value={totalMeetings} hint={status !== "connected" ? "Connect Google" : undefined} />
        <StatTile icon={Presentation} label="CP meetings" value={cpMeetings} hint={status !== "connected" ? "Connect Google" : undefined} />
        <StatTile icon={Users} label="Clients active" value={rangeClients.length} />
        <StatTile icon={CalendarRange} label="Types" value={meetingsByType.length} hint={status !== "connected" ? "Connect Google" : undefined} />
        <StatTile
          icon={CheckCircle2}
          label="Business meeting → Closing"
          value={`${closingRate}%`}
          hint={`${closedClients.length}/${businessMeetingClients.length} clients`}
        />
      </div>

      {/* Google connection gate for calendar metrics */}
      {isConfigured && status !== "connected" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-4">
          <p className="flex items-center gap-2 text-sm text-slate-500">
            {status === "expired" && <AlertTriangle size={15} className="text-av-red" />}
            Connect Google Calendar to include meeting analytics in this report.
          </p>
          <button
            onClick={async () => {
              try {
                await connect();
              } catch (err) {
                addToast(err.message || "Could not connect");
              }
            }}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
          >
            <Link2 size={13} />
            {status === "expired" ? "Reconnect" : "Connect"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-av-red">{error.message}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Meetings by type */}
        <ReportCard title="Meetings by type">
          {status !== "connected" ? (
            <Empty text="Connect Google Calendar to see meeting types." />
          ) : meetingsByType.length === 0 ? (
            <Empty text="No meetings in this range." />
          ) : (
            <BarList rows={meetingsByType.map((t) => ({ label: t.key, value: t.count }))} />
          )}
        </ReportCard>

        {/* Month over month */}
        <ReportCard title="Meetings month over month">
          {status !== "connected" ? (
            <Empty text="Connect Google Calendar to see monthly trends." />
          ) : monthOverMonth.length === 0 ? (
            <Empty text="No meetings in this range." />
          ) : (
            <BarList rows={monthOverMonth.map((m) => ({ label: monthShortLabel(m.key), value: m.count }))} />
          )}
        </ReportCard>

        {/* Stage breakdown (local clients) */}
        <ReportCard title="Pipeline stage breakdown">
          <BarList
            rows={stageBreakdown.map((s) => ({ label: s.stage.short, value: s.count }))}
            emptyText="No client activity in this range."
          />
        </ReportCard>

        {/* CPs per client */}
        <ReportCard title="CPs run per client">
          {status !== "connected" ? (
            <Empty text="Connect Google Calendar to count CPs." />
          ) : cpsPerClient.length === 0 ? (
            <Empty text="No CP meetings in this range." />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {cpsPerClient.map((row) => (
                <li key={row.name} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-navy">{row.name}</span>
                  <span className="rounded-full bg-navy/5 px-2.5 py-0.5 text-xs font-semibold text-navy">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </ReportCard>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-gold-dark">
        <Icon size={17} />
      </div>
      <p className="text-2xl font-bold text-navy">{hint ? "—" : value}</p>
      <p className="text-xs text-slate-500">{hint || label}</p>
    </div>
  );
}

function ReportCard({ title, children }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-navy">{title}</h2>
      {children}
    </section>
  );
}

function BarList({ rows, emptyText }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0 || rows.every((r) => r.value === 0)) {
    return <Empty text={emptyText || "No data in this range."} />;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-600">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gold transition-all duration-300"
              style={{ width: r.value === 0 ? 0 : `${Math.max((r.value / max) * 100, 4)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-sm font-semibold text-navy">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }) {
  return <p className="py-4 text-center text-sm text-slate-400">{text}</p>;
}
