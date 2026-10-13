import { useEffect, useState } from "react";
import { Presentation as PresentationIcon, Info, Download, FileX, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";

export default function Presentations() {
  const { addToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getPresentations();
        if (!cancelled) {
          setItems(data);
          // Auto-expand any item that has variants, so they're visible by default.
          setExpanded(new Set(data.filter((d) => d.variants?.length).map((d) => d.slug)));
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

  const toggleExpanded = (slug) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // The PDFs are plan-gated, so they are fetched with the session (and silently
  // refreshed if it expired) rather than opened by URL.
  const handleDownload = async (title, hasPdf, download) => {
    if (!hasPdf) {
      addToast(`"${title}" PDF hasn't been uploaded yet.`);
      return;
    }
    try {
      await download();
    } catch (err) {
      addToast(err.message || `Could not download "${title}"`);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
          <PresentationIcon size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">Presentations</h1>
          <p className="text-sm text-slate-500">Download the presentation decks to use with clients.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-av-red/30 bg-white px-6 py-10 text-center text-sm text-av-red">
          {error.message}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          No presentations yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const hasVariants = item.variants?.length > 0;
            const isOpen = expanded.has(item.slug);
            return (
              <div key={item.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-navy">{item.title}</h2>
                      <InfoTooltip text={item.info} />
                      {hasVariants && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          {item.variants.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {hasVariants ? (
                    <button
                      onClick={() => toggleExpanded(item.slug)}
                      aria-label={isOpen ? "Collapse" : "Expand"}
                      className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                    >
                      <ChevronDown size={18} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                  ) : (
                    <DownloadButton
                      hasPdf={item.hasPdf}
                      onClick={() =>
                        handleDownload(item.title, item.hasPdf, () => api.downloadPresentationPdf(item.slug, `${item.title}.pdf`))
                      }
                    />
                  )}
                </div>

                {hasVariants && (
                  <div className={`grid transition-all duration-200 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden">
                      <div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
                        {item.variants.map((variant) => (
                          <div key={variant.id} className="flex items-center gap-3 px-5 py-3 pl-8">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">{variant.label}</span>
                              <InfoTooltip text={variant.info} />
                            </div>
                            <DownloadButton
                              compact
                              hasPdf={variant.hasPdf}
                              onClick={() =>
                                handleDownload(`${item.title} — ${variant.label}`, variant.hasPdf, () =>
                                  api.downloadPresentationVariantPdf(item.slug, variant.id, `${item.title} - ${variant.label}.pdf`)
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoTooltip({ text }) {
  if (!text) return null;
  return (
    <span className="group relative inline-flex">
      <Info size={15} className="shrink-0 cursor-help text-slate-400" />
      <span className="pointer-events-none absolute left-0 top-6 z-10 w-56 rounded-lg bg-navy px-3 py-2 text-xs font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function DownloadButton({ hasPdf, onClick, compact = false }) {
  return (
    <button
      onClick={onClick}
      disabled={!hasPdf}
      className={`flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold transition ${
        compact ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
      } ${hasPdf ? "bg-navy text-white hover:bg-navy-light" : "cursor-not-allowed border border-slate-200 text-slate-400"}`}
    >
      {hasPdf ? (
        <>
          <Download size={compact ? 13 : 15} />
          Download
        </>
      ) : (
        <>
          <FileX size={compact ? 13 : 15} />
          {compact ? "No PDF" : "Not uploaded yet"}
        </>
      )}
    </button>
  );
}
