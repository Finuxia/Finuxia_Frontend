import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarRange,
  Link2,
  RefreshCcw,
  AlertTriangle,
  CalendarCheck,
  Presentation,
  Download,
  FileText,
  Table2,
  CheckCircle2,
} from "lucide-react";
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
  monthKeysBetween,
} from "../lib/chartPipeline";
import MeetingGrowth from "../components/reports/MeetingGrowth";
import { toCsv, downloadCsv } from "../lib/csv";
import { PIPELINE_STAGES, STAGE_INDEX } from "../lib/pipeline";
import { openPrintableReport } from "../lib/pdfReport";
import { buildFunnelWorkbook, downloadWorkbook } from "../lib/spreadsheet";

function firstOfMonth(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}
// The calendar date as the person sees it. (toISOString is in UTC, which for anyone ahead of UTC turned local midnight into the day before.)
function toInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [initialYear, initialMonthNumber] = initialMonth.split("-").map(Number);
  const [preset, setPreset] = useState("this");
  const [startDate, setStartDate] = useState(`${initialMonth}-01`);
  // The last day of that month (day 0 of the next one), not the first day of the next month.
  const [endDate, setEndDate] = useState(toInput(new Date(initialYear, initialMonthNumber, 0)));

  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startISO = new Date(`${startDate}T00:00:00`).toISOString();
  const endISO = new Date(`${endDate}T23:59:59`).toISOString();
  const rangeStart = new Date(`${startDate}T00:00:00`);
  const growthStartISO = new Date(rangeStart.getFullYear(), rangeStart.getMonth() - 1, 1).toISOString();

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
      // From the month BEFORE the range: the growth chart compares each month with the one before it, so "This month" needs last month too.
      const items = await fetchEventsInRange(growthStartISO, endISO);
      setAllEvents(items);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloads when the connection or the dates change; loadEvents is rebuilt every render
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
  const closingRate = businessMeetingClients.length ? Math.round((closedClients.length / businessMeetingClients.length) * 100) : 0;

  /* --------- calendar-based metrics (need a live connection) ----------- */
  // Everything on the page except the growth chart is about the chosen range; the chart also wants the month before it.
  const events = useMemo(() => {
    const from = new Date(startISO).getTime();
    const to = new Date(endISO).getTime();
    return allEvents.filter((e) => {
      const t = eventDate(e).getTime();
      return t >= from && t <= to;
    });
  }, [allEvents, startISO, endISO]);
  const growthMonths = useMemo(() => {
    const [year, month] = startDate.split("-").map(Number);
    const before = new Date(year, month - 2, 1);
    return monthKeysBetween(monthKeyOf(before), endDate.slice(0, 7));
  }, [startDate, endDate]);
  const meetingsByType = useMemo(() => runPipeline(events, [countBy(classifyEventType)]), [events]);

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
    rows.push(["Meetings Held", totalMeetings]);
    rows.push(["CP Meetings", cpMeetings]);
    rows.push(["Business Meeting -> Closing Rate", `${closingRate}% (${closedClients.length}/${businessMeetingClients.length})`]);
    rows.push([]);
    rows.push(["Meetings Month Over Month", "Count"]);
    monthOverMonth.forEach((m) => rows.push([monthShortLabel(m.key), m.count]));
    rows.push([]);
    rows.push(["Pipeline Stage Breakdown", "Clients"]);
    stageBreakdown.forEach((s) => rows.push([s.stage.label, s.count]));

    downloadCsv(`advisorpilot-report-${startDate}_to_${endDate}.csv`, toCsv(rows));
    addToast("Report exported");
  };

  const handleExportPdf = () => {
    try {
      openPrintableReport({
        title: "Finuxia Report",
        rangeLabel: `${startDate} to ${endDate}`,
        stats: [
          { label: "Meetings Held", value: totalMeetings },
          { label: "CP Meetings", value: cpMeetings },
          { label: "Business Meeting -> Closing", value: `${closingRate}% (${closedClients.length}/${businessMeetingClients.length})` },
        ],
        sections: [
          {
            heading: "Meetings Month Over Month",
            rows: monthOverMonth.map((m) => ({ label: monthShortLabel(m.key), value: m.count })),
            emptyText: "No meetings in this range.",
          },
          {
            heading: "Pipeline Stage Breakdown",
            rows: stageBreakdown.map((s) => ({ label: s.stage.label, value: s.count })),
            emptyText: "No client activity in this range.",
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
        return [i + 1, `${c.first} ${c.last}`.trim(), c.priority || "", ...PIPELINE_STAGES.map((s, idx) => idx <= currentIdx)];
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
            className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-navy-light"
          >
            <FileText size={14} />
            Export PDF
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy shadow-xs transition hover:bg-slate-50"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={handleExportFunnel}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy shadow-xs transition hover:bg-slate-50"
          >
            <Table2 size={14} />
            Export Funnel
          </button>
        </div>
      </div>

      {/* Filters — single row above all report content */}
      <section className="rounded-2xl bg-white p-5 shadow-xs">
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
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-navy outline-hidden focus:border-gold"
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
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-navy outline-hidden focus:border-gold"
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
        <StatTile
          icon={CalendarCheck}
          label="Meetings Held"
          value={totalMeetings}
          hint={status !== "connected" ? "Connect Google" : undefined}
        />
        <StatTile icon={Presentation} label="CP Meetings" value={cpMeetings} hint={status !== "connected" ? "Connect Google" : undefined} />
        <StatTile
          icon={CalendarRange}
          label="Types"
          value={meetingsByType.length}
          hint={status !== "connected" ? "Connect Google" : undefined}
        />
        <StatTile
          icon={CheckCircle2}
          label="Business Meeting → Closing"
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
        {/* How each kind of meeting grows from month to month */}
        <div className="lg:col-span-2">
          <ReportCard title="Meeting Growth Over Month">
            <MeetingGrowth events={allEvents} monthKeys={growthMonths} connected={status === "connected"} />
          </ReportCard>
        </div>

        {/* Stage breakdown (local clients) */}
        <ReportCard title="Pipeline Stage Breakdown">
          <BarList
            rows={stageBreakdown.map((s) => ({ label: s.stage.short, value: s.count }))}
            emptyText="No client activity in this range."
          />
        </ReportCard>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
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
    <section className="rounded-2xl bg-white p-6 shadow-xs">
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
