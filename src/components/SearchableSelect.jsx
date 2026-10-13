import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

/**
 * A dropdown you can type into to filter its options.
 *
 * - Default mode: pick one of `options` ({ value, label, search? }). While
 *   the list is open the input is the search box; when closed it shows the
 *   selected option's label.
 * - `freeText` mode: the input's text IS the value (any string), and the
 *   options are just suggestions — used where the advisor may type a name
 *   that isn't in the list at all.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  freeText = false,
  disabled = false,
  emptyText = "No matches",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);

  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)), [options, value]);
  const text = freeText ? value || "" : open ? query : selected?.label || "";
  const needle = (freeText ? value || "" : query).trim().toLowerCase();

  const filtered = useMemo(
    () => (needle ? options.filter((o) => (o.search || o.label).toLowerCase().includes(needle)) : options),
    [options, needle]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => setHighlight(0), [needle, open]);

  const pick = (option) => {
    onChange(freeText ? option.label : option.value, option);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && filtered[highlight]) {
      e.preventDefault();
      pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const clearable = !disabled && (freeText ? Boolean(value) : Boolean(selected));

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setOpen(true);
          if (freeText) onChange(e.target.value, null);
          else setQuery(e.target.value);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-2.5 pr-14 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:bg-slate-50 disabled:text-slate-400"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-slate-400">
        {clearable && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              onChange(freeText ? "" : "", null);
              setQuery("");
            }}
            className="rounded p-0.5 hover:text-navy"
            aria-label="Clear"
          >
            <X size={13} />
          </button>
        )}
        <ChevronDown size={14} className="pointer-events-none" />
      </div>
      {open && !disabled && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-400">{freeText ? "No saved match — keep typing to use this name." : emptyText}</li>
          ) : (
            filtered.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    i === highlight ? "bg-gold/10 text-navy" : "text-slate-600"
                  } ${String(o.value) === String(value) ? "font-semibold" : ""}`}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
