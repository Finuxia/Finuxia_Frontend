import { useEffect, useRef, useState } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { generateSlotTimes, formatSlotLabel } from "../lib/timeSlots";
import { parseTimeInput } from "../lib/timeInput";

// Same 288 five-minute marks as always (nothing removed) — just rotated to
// start the list at 8 AM and wrap around through midnight to 7:55 AM, since
// scrolling past a wall of pre-dawn hours before reaching the workday was
// the actual complaint, not wanting fewer options.
const START_HOUR = 8;
const ALL_TIMES = generateSlotTimes({ stepMinutes: 5 });
const ROTATE_AT = ALL_TIMES.findIndex((t) => t === `${String(START_HOUR).padStart(2, "0")}:00`);
const OPTIONS = [...ALL_TIMES.slice(ROTATE_AT), ...ALL_TIMES.slice(0, ROTATE_AT)];

/**
 * A time field that's both typeable and pickable — replaces the native
 * `<input type="time">` used across the app, whose spinner/wheel scrolls
 * one minute at a time and looks/behaves differently on every browser.
 *
 * Typing accepts "9:30am", "930p", "14:00", etc. (see lib/timeInput.js);
 * the dropdown offers every 5-minute mark, matching TimeSlotSelect's look.
 * Value/onChange stay "HH:MM" 24-hour, same as before — a drop-in swap.
 */
export default function TimeInput({
  value,
  onChange,
  label,
  disabled = false,
  placeholder = "Select time...",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ? formatSlotLabel(value) : "");
  const ref = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setText(value ? formatSlotLabel(value) : "");
  }, [value]);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) closeAndRevert();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const scrollToCurrent = () => {
    requestAnimationFrame(() => {
      listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: "center" });
    });
  };

  const closeAndRevert = () => {
    setText(value ? formatSlotLabel(value) : "");
    setOpen(false);
  };

  const commit = () => {
    if (!text.trim()) {
      // An emptied field is a deliberate clear, not garbage to revert —
      // matters for the optional time fields (e.g. a reminder's due time).
      onChange("");
      setOpen(false);
      return;
    }
    const parsed = parseTimeInput(text);
    if (parsed) {
      onChange(parsed);
      setText(formatSlotLabel(parsed));
    } else {
      setText(value ? formatSlotLabel(value) : "");
    }
    setOpen(false);
  };

  const handlePick = (time) => {
    onChange(time);
    setText(formatSlotLabel(time));
    setOpen(false);
  };

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={ref}>
      {label && <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>}

      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50"
            : "border-slate-200 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30"
        }`}
      >
        <Clock size={14} className="shrink-0 text-slate-400" />
        <input
          type="text"
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            setOpen(true);
            scrollToCurrent();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              closeAndRevert();
            }
          }}
          onBlur={() => {
            // Let a dropdown-option click register before we revert on blur.
            setTimeout(() => {
              if (!ref.current?.contains(document.activeElement)) commit();
            }, 0);
          }}
          className="w-full min-w-0 bg-transparent text-sm text-navy outline-none placeholder:text-slate-400 disabled:text-slate-400"
        />
        <button
          type="button"
          disabled={disabled}
          tabIndex={-1}
          onClick={() => {
            if (open) {
              closeAndRevert();
            } else {
              setOpen(true);
              scrollToCurrent();
            }
          }}
          aria-label="Open time list"
          className="shrink-0 text-slate-400 disabled:cursor-not-allowed"
        >
          <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && !disabled && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={label || "Time"}
          className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          {OPTIONS.map((time) => {
            const selected = time === value;
            return (
              <button
                key={time}
                type="button"
                role="option"
                aria-selected={selected}
                data-current={selected ? "true" : undefined}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the text input so blur-commit doesn't race the click
                onClick={() => handlePick(time)}
                className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm transition ${
                  selected ? "bg-gold/10 font-semibold text-gold-dark" : "text-navy hover:bg-slate-50"
                }`}
              >
                {formatSlotLabel(time)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
