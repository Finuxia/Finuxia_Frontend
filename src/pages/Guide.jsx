import { useEffect, useState } from "react";
import { ChevronDown, BookOpen, LifeBuoy } from "lucide-react";
import { api } from "../lib/api";

export default function Guide() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getGuides();
        if (!cancelled) {
          setGroups(data);
          // open the very first question by default
          setOpenId(data?.[0]?.items?.[0]?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
          <BookOpen size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">Guide &amp; Tutorial</h1>
          <p className="text-sm text-slate-500">Everything you need to get productive in Finuxia.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
          Loading guide…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-av-red/30 bg-white px-6 py-10 text-center">
          <p className="text-sm text-av-red">{error.message}</p>
          <p className="mt-1 text-xs text-slate-400">Is the backend running?</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <LifeBuoy size={24} className="text-slate-300" />
          <p className="text-sm text-slate-400">No guide entries yet. Add some in the admin panel.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-gold-dark">{group.category}</h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {group.items.map((item, i) => {
                const open = openId === item.id;
                return (
                  <div key={item.id} className={i > 0 ? "border-t border-slate-100" : ""}>
                    <button
                      onClick={() => setOpenId(open ? null : item.id)}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                      aria-expanded={open}
                    >
                      <span className={`text-sm font-semibold ${open ? "text-navy" : "text-slate-700"}`}>{item.question}</span>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div className={`grid transition-all duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <p className="whitespace-pre-line px-5 pb-4 text-sm leading-relaxed text-slate-600">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
