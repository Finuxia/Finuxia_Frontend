import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import LoadMore from "../components/ui/LoadMore";
import { useClients } from "../context/ClientsContext";
import usePagedList from "../hooks/usePagedList";
import { getStage, PIPELINE_STAGES } from "../lib/pipeline";
import { formatCanadianPhone } from "../lib/phone";

const PRIORITY_DOT = { High: "bg-av-red", Medium: "bg-av-amber", Low: "bg-av-green" };
const FOLLOWUP_BADGE = {
  Overdue: "bg-av-red/10 text-av-red",
  Today: "bg-av-amber/10 text-av-amber",
  "This week": "bg-av-blue/10 text-av-blue",
  "Next month": "bg-slate-100 text-slate-500",
  TBD: "bg-slate-100 text-slate-500",
};
const AVATAR_BG = {
  "av-blue": "bg-av-blue",
  "av-green": "bg-av-green",
  "av-amber": "bg-av-amber",
  "av-red": "bg-av-red",
  "av-purple": "bg-av-purple",
  "av-teal": "bg-av-teal",
};

const SEARCH_DELAY_MS = 300;

/** `value`, but only once it has stopped changing for `delay` ms: typing in the search box must not send a request per keystroke. */
function useDebounced(value, delay) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export default function Clients() {
  // The complete list is held by the clients context (it is what edits are synced against); it gives the total here. WHAT IS SHOWN is asked of the server,
  // which filters and pages it, so the filters work across every page and not only across what happens to be loaded.
  const { clients } = useClients();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState(searchParams.get("stage") || "all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const search = useDebounced(query.trim(), SEARCH_DELAY_MS);
  const {
    items: shown,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    reload,
  } = usePagedList("/api/clients", {
    q: search,
    stage: stageFilter === "all" ? "" : stageFilter,
    priority: priorityFilter === "all" ? "" : priorityFilter,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Clients</h1>
          <p className="text-sm text-slate-500">{clients.length} total</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={15} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, email, Telegram..."
            className="w-full text-sm text-navy outline-hidden placeholder:text-slate-400"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-hidden"
        >
          <option value="all">All Stages</option>
          {PIPELINE_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-hidden"
        >
          <option value="all">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {loading && shown.length === 0 ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
          Loading clients…
        </div>
      ) : error && shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-av-red/30 bg-white px-6 py-10 text-center text-sm text-av-red">
          {error.message}
          <button
            type="button"
            onClick={reload}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50"
          >
            Try again
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          No clients match your filters.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((c) => {
            const stage = getStage(c.currentStage);
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-xs transition hover:shadow-md"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                    AVATAR_BG[c.color] ?? "bg-navy"
                  }`}
                >
                  {c.first[0]}
                  {c.last[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">
                    {c.first} {c.last}
                  </p>
                  <p className="truncate text-xs text-slate-400">{formatCanadianPhone(c.phone) || c.email || "—"}</p>
                </div>
                <span className={`hidden shrink-0 h-2.5 w-2.5 rounded-full sm:block ${PRIORITY_DOT[c.priority]}`} />
                <span className="hidden shrink-0 rounded-full bg-navy/5 px-2.5 py-0.5 text-xs font-medium text-navy/70 sm:block">
                  {stage?.short}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    FOLLOWUP_BADGE[c.nextFollowUp] ?? FOLLOWUP_BADGE.TBD
                  }`}
                >
                  {c.nextFollowUp}
                </span>
              </button>
            );
          })}
          <LoadMore hasMore={hasMore} loadingMore={loadingMore} error={shown.length > 0 ? error : null} onLoadMore={loadMore} />
        </div>
      )}
    </div>
  );
}
