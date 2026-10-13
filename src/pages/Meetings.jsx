import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import { todayLong, todayISO, addDays } from "../lib/followUp";
import GoogleMeetingsSection from "../components/GoogleMeetingsSection";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * All of the advisor's Google Calendar meetings for a day — independent
 * from Clients (no client list, no follow-up buckets). Client matching still
 * shows up per-event inside GoogleMeetingsSection when it can, but nothing
 * here requires a client to exist.
 */
export default function Meetings() {
  const { status, fetchDay, getDayState } = useGoogleCalendar();
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

  useEffect(() => {
    if (status === "connected") fetchDay(selectedDate).catch(() => {});
  }, [status, selectedDate, fetchDay]);
  const dayState = getDayState(selectedDate);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Meetings</h1>
          <p className="text-sm text-slate-500">Your calendar, on its own — nothing here needs a client to exist.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <label className="relative flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-navy">
            <CalendarDays size={15} className="text-gold-dark" />
            {todayLong(selectedDate)}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              onClick={(e) => {
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
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
        </div>
      </div>

      <GoogleMeetingsSection
        date={selectedDate}
        events={dayState.events}
        loading={dayState.status === "loading"}
        error={dayState.error}
        onRefresh={() => fetchDay(selectedDate, { force: true }).catch(() => {})}
      />
    </div>
  );
}
