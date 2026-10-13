import { useEffect, useRef, useState } from "react";
import { Clock, ChevronDown, Lock, AlertTriangle, RefreshCcw } from "lucide-react";
import { useAvailability } from "../hooks/useAvailability";
import { formatSlotLabel } from "../lib/timeSlots";

/**
 * Meeting-time dropdown with Google Calendar availability built in. This is
 * the ONE place the app picks a meeting time — no separate availability page.
 *
 * Slots stay visible even when busy (never silently removed), so the user can
 * see *why* a time is unavailable rather than wondering where it went. Busy
 * options are real disabled buttons, so keyboard/screen-reader users get the
 * same "can't select this" behavior for free.
 */
export default function TimeSlotSelect({ date, durationMinutes = 30, value, onChange, label = "Time", disabled = false }) {
  const { status, slots, error, retry } = useAvailability(date, durationMinutes);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const isLoading = status === "loading";
  const isError = status === "error";
  const isTriggerDisabled = disabled || !date || isLoading;

  const selectedSlot = slots.find((s) => s.time === value);
  const triggerLabel = !date
    ? "Select a date first"
    : isLoading
      ? "Loading availability..."
      : isError
        ? "Availability unavailable"
        : value
          ? formatSlotLabel(value)
          : "Select time...";

  const handlePick = (slot) => {
    if (!slot.available) return; // extra guard — the button is also natively disabled
    onChange(slot.time);
    setOpen(false);
  };

  return (
    <div className="relative flex flex-col gap-1.5" ref={ref}>
      {label && <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>}

      <button
        type="button"
        onClick={() => !isTriggerDisabled && setOpen((o) => !o)}
        disabled={isTriggerDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 ${
          isError
            ? "border-av-red/40 text-av-red"
            : isTriggerDisabled
              ? "cursor-not-allowed border-slate-200 text-slate-400"
              : "border-slate-200 text-navy hover:border-slate-300"
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {isLoading ? (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-navy" />
          ) : isError ? (
            <AlertTriangle size={14} className="shrink-0" />
          ) : (
            <Clock size={14} className="shrink-0 text-slate-400" />
          )}
          <span className={`truncate ${!value && !isLoading && !isError ? "text-slate-400" : ""}`}>{triggerLabel}</span>
          {selectedSlot && !selectedSlot.available && (
            <span className="shrink-0 rounded-full bg-av-red/10 px-1.5 py-0.5 text-[10px] font-semibold text-av-red">
              Busy
            </span>
          )}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {isError && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-av-red/5 px-2.5 py-1.5 text-xs text-av-red">
          <span>Unable to check Google Calendar availability.</span>
          <button
            type="button"
            onClick={retry}
            className="flex shrink-0 items-center gap-1 font-semibold underline decoration-dotted hover:no-underline"
          >
            <RefreshCcw size={11} />
            Retry
          </button>
        </div>
      )}

      {status === "unchecked" && date && (
        <p className="text-xs text-slate-400">Connect Google Calendar to see busy times here.</p>
      )}

      {open && !isTriggerDisabled && (
        <div
          role="listbox"
          aria-label="Meeting time"
          className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          {slots.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No time slots available.</p>
          ) : (
            slots.map((slot) => {
              const selected = slot.time === value;
              return (
                <button
                  key={slot.time}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={!slot.available}
                  disabled={!slot.available}
                  onClick={() => handlePick(slot)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition ${
                    !slot.available
                      ? "cursor-not-allowed bg-av-red/[0.04] text-av-red/70 opacity-60"
                      : selected
                        ? "bg-gold/10 font-semibold text-gold-dark"
                        : "text-navy hover:bg-slate-50"
                  }`}
                >
                  <span>{formatSlotLabel(slot.time)}</span>
                  {!slot.available && (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">
                      <Lock size={11} />
                      Busy
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
