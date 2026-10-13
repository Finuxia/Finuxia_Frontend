import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useClients } from "../context/ClientsContext";

export default function GlobalSearch() {
  const { clients } = useClients();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? clients
        .filter((c) => {
          const haystack = `${c.first} ${c.last} ${c.phone} ${c.email} ${c.telegram}`.toLowerCase();
          return haystack.includes(q);
        })
        .slice(0, 6)
    : [];

  const goTo = (id) => {
    setOpen(false);
    setQuery("");
    navigate(`/clients/${id}`);
  };

  return (
    <div className="relative w-full max-w-xs" ref={ref}>
      <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white focus-within:bg-white/15">
        <Search size={15} className="shrink-0 text-slate-300" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search name, phone, email, Telegram..."
          className="w-full bg-transparent text-sm text-white placeholder:text-slate-400 outline-none"
        />
      </div>

      {open && q && (
        <div className="absolute left-0 z-50 mt-2 w-full min-w-[280px] animate-fade-in rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {results.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-slate-400">No matches for "{query}"</p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                onClick={() => goTo(c.id)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-50"
              >
                <span className="font-medium text-navy">
                  {c.first} {c.last}
                </span>
                <span className="text-xs text-slate-400">{c.phone || c.email || c.telegram}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
