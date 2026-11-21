import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, ExternalLink, Link2, MessageSquareQuote, Plus, Star, Trash2 } from "lucide-react";
import { api, isIncompleteList, testimonialPublicUrl } from "../lib/api";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import IncompleteListNotice from "../components/IncompleteListNotice";
import Switch from "../components/ui/Switch";

function Stars({ value }) {
  if (!value) return null;
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} className={n <= value ? "fill-gold text-gold" : "text-slate-200"} />
      ))}
    </span>
  );
}

/** The person's photo. It is only served to the advisor it belongs to, so it is fetched with the session and shown from a blob URL. */
function Photo({ id, name }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    let made = "";
    api
      .getTestimonialPhotoUrl(id)
      .then((u) => {
        made = u;
        if (cancelled) URL.revokeObjectURL(u);
        else setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  if (!url) return <div className="h-12 w-12 shrink-0 rounded-full bg-slate-100" aria-hidden="true" />;
  return <img src={url} alt={name} className="h-12 w-12 shrink-0 rounded-full object-cover" />;
}

/**
 * Testimonials: links an advisor sends to clients (one for a particular client, or a general one anyone can use), and what people wrote through them.
 */
export default function Testimonials() {
  const { clients } = useClients();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [links, setLinks] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incomplete, setIncomplete] = useState(false);
  const [clientRef, setClientRef] = useState(searchParams.get("client") || "");
  const [copied, setCopied] = useState(null);

  const load = useCallback(() => {
    return Promise.all([api.getTestimonialLinks(), api.getTestimonials()])
      .then(([l, t]) => {
        setLinks(l);
        setItems(t);
        setIncomplete(isIncompleteList(t));
      })
      .catch((err) => addToast(err.message || "Could not load testimonials."))
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const unread = useMemo(() => items.filter((t) => !t.isRead).length, [items]);
  const sortedClients = useMemo(() => [...clients].sort((a, b) => `${a.first} ${a.last}`.localeCompare(`${b.first} ${b.last}`)), [clients]);

  const run = async (action, fail) => {
    try {
      await action();
    } catch (err) {
      addToast(err.message || fail);
    }
  };

  const createLink = (ref) =>
    run(async () => {
      const link = await api.createTestimonialLink(ref ? { clientRef: ref } : {});
      setLinks((l) => [link, ...l]);
      if (ref) setClientRef("");
    }, "Could not create the link.");

  const copy = async (slug) => {
    try {
      await navigator.clipboard.writeText(testimonialPublicUrl(slug));
      setCopied(slug);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      addToast("Could not copy — copy the link manually.");
    }
  };

  const toggleLink = (link) =>
    run(async () => {
      const updated = await api.updateTestimonialLink(link.id, { isActive: !link.isActive });
      setLinks((all) => all.map((l) => (l.id === link.id ? { ...l, ...updated } : l)));
    }, "Could not change the link.");

  const removeLink = (link) => {
    if (!window.confirm("Delete this link? What people already wrote through it is kept, but the link stops working.")) return;
    return run(async () => {
      await api.deleteTestimonialLink(link.id);
      setLinks((all) => all.filter((l) => l.id !== link.id));
    }, "Could not delete the link.");
  };

  const patch = (t, change) =>
    run(async () => {
      const updated = await api.updateTestimonial(t.id, change);
      setItems((all) => all.map((x) => (x.id === t.id ? { ...x, ...updated } : x)));
    }, "Could not update this testimonial.");

  const remove = (t) => {
    if (!window.confirm(`Delete the testimonial from ${t.name}? This cannot be undone.`)) return;
    return run(async () => {
      await api.deleteTestimonial(t.id);
      setItems((all) => all.filter((x) => x.id !== t.id));
    }, "Could not delete this testimonial.");
  };

  const markAllRead = () =>
    run(async () => {
      await api.markAllTestimonialsRead();
      setItems((all) => all.map((t) => ({ ...t, isRead: true })));
    }, "Could not mark them as read.");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
          <MessageSquareQuote size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">Testimonials</h1>
          <p className="text-sm text-slate-500">Send a link, and clients tell you what they think. Only you see what comes back.</p>
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="links-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="links-heading" className="text-base font-semibold text-navy">
            Your links
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Client"
              value={clientRef}
              onChange={(e) => setClientRef(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-navy"
            >
              <option value="">Choose a client…</option>
              {sortedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.first} ${c.last}`.trim() || c.email || c.id}
                </option>
              ))}
            </select>
            <button
              onClick={() => createLink(clientRef)}
              disabled={!clientRef}
              className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-40"
            >
              <Plus size={15} /> Link for this client
            </button>
            <button
              onClick={() => createLink("")}
              className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-navy transition hover:bg-gold-light"
            >
              <Plus size={15} /> General link
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : links.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-400">
            No links yet. A <strong>general link</strong> can be sent to anyone; a <strong>link for a client</strong> greets them by name
            and files what they write under them.
          </p>
        ) : (
          links.map((link) => (
            <div key={link.id} className="rounded-2xl bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{link.clientName ? `For ${link.clientName}` : "General link"}</p>
                  <p className="text-xs text-slate-400">
                    {link.submissions} testimonial{link.submissions === 1 ? "" : "s"} received
                    {!link.isActive && " · switched off"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch label={`Link open: ${link.clientName || "general"}`} checked={link.isActive} onChange={() => toggleLink(link)} />
                  <button
                    onClick={() => removeLink(link)}
                    aria-label="Delete link"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <Link2 size={13} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-xs text-navy">{testimonialPublicUrl(link.slug)}</span>
                <button
                  onClick={() => copy(link.slug)}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
                >
                  {copied === link.slug ? <Check size={12} /> : <Copy size={12} />}
                  {copied === link.slug ? "Copied" : "Copy"}
                </button>
                <a
                  href={testimonialPublicUrl(link.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-100"
                >
                  <ExternalLink size={12} /> Preview
                </a>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="received-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="received-heading" className="text-base font-semibold text-navy">
            Received {items.length > 0 && <span className="font-normal text-slate-400">({items.length})</span>}
          </h2>
          <button
            onClick={markAllRead}
            disabled={unread === 0}
            className="text-xs font-medium text-av-blue transition hover:underline disabled:cursor-default disabled:text-slate-300 disabled:no-underline"
          >
            Mark all as read
          </button>
        </div>
        {incomplete && <IncompleteListNotice what="testimonials" />}
        {!loading && items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-400">
            Nothing yet. When someone sends one, it appears here.
          </p>
        )}
        {items.map((t) => (
          <article key={t.id} className="rounded-2xl bg-white p-4 shadow-xs">
            <div className="flex items-start gap-3">
              {t.hasPhoto ? (
                <Photo id={t.id} name={t.name} />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-full bg-slate-100" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-navy">{t.name}</h3>
                  {!t.isRead && <span className="rounded-full bg-av-blue/10 px-2 py-0.5 text-[11px] font-semibold text-av-blue">New</span>}
                  {t.clientName && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">Client: {t.clientName}</span>
                  )}
                </div>
                {t.roleCompany && <p className="text-xs text-slate-400">{t.roleCompany}</p>}
                <div className="mt-1">
                  <Stars value={t.rating} />
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{t.text}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(t.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                  {[t.email, t.phone].filter(Boolean).map((v) => ` · ${v}`)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => patch(t, { isFeatured: !t.isFeatured })}
                  aria-label={t.isFeatured ? "Unfeature" : "Feature"}
                  aria-pressed={t.isFeatured}
                  className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-gold"
                >
                  <Star size={15} className={t.isFeatured ? "fill-gold text-gold" : ""} />
                </button>
                <button
                  onClick={() => patch(t, { isRead: !t.isRead })}
                  aria-label={t.isRead ? "Mark as unread" : "Mark as read"}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => remove(t)}
                  aria-label="Delete testimonial"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
