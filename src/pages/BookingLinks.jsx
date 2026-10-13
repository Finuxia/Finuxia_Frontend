import { useEffect, useState } from "react";
import { Link2, Plus, Copy, Check, ExternalLink, Pencil, Trash2, Users, ListChecks } from "lucide-react";
import { api, bookingPublicUrl } from "../lib/api";
import { useToast } from "../context/ToastContext";
import BookingLinkModal from "../components/booking/BookingLinkModal";

/**
 * An advisor's booking links — each a separately-customized "event type"
 * (Calendly-style) they can hand out to different kinds of clients. All
 * draw from the same shared Availability (see Profile).
 */
export default function BookingLinks() {
  const { addToast } = useToast();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalLink, setModalLink] = useState(undefined); // undefined = closed, null = create, link = edit
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .getBookingLinks()
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCopy = async (slug) => {
    try {
      await navigator.clipboard.writeText(bookingPublicUrl(slug));
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1500);
    } catch {
      addToast("Could not copy — copy the link manually.");
    }
  };

  const handleSave = async (payload) => {
    if (modalLink) {
      await api.updateBookingLink(modalLink.id, payload);
    } else {
      await api.createBookingLink(payload);
    }
    load();
  };

  const handleDelete = async () => {
    await api.deleteBookingLink(modalLink.id);
    load();
  };

  const handleQuickDelete = async (link) => {
    if (!window.confirm(`Delete "${link.title}"? Existing bookings made through it are kept, but the link stops working.`)) return;
    setDeletingId(link.id);
    try {
      await api.deleteBookingLink(link.id);
      load();
    } catch (err) {
      addToast(err.message || "Could not delete this link.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
            <Link2 size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">Booking Links</h1>
            <p className="text-sm text-slate-500">Give clients a link to book a meeting with you directly.</p>
          </div>
        </div>
        <button
          onClick={() => setModalLink(null)}
          className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:bg-gold-light"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Link
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
          Loading…
        </div>
      ) : links.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <Link2 size={24} className="text-slate-300" />
          <p className="text-sm text-slate-400">No booking links yet. Create one to start taking requests.</p>
          <button
            onClick={() => setModalLink(null)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
          >
            <Plus size={15} />
            New Link
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {links.map((link) => (
            <div key={link.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-navy">{link.title}</h2>
                    {!link.isActive && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Inactive</span>
                    )}
                  </div>
                  {link.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{link.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>{link.durationMinutes} min</span>
                    {link.bufferMinutes > 0 && <span>{link.bufferMinutes} min buffer</span>}
                    {link.guestsAllowed && (
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        Guests allowed
                      </span>
                    )}
                    {link.customQuestions?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ListChecks size={11} />
                        {link.customQuestions.length} question{link.customQuestions.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setModalLink(link)}
                    aria-label="Edit link"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleQuickDelete(link)}
                    disabled={deletingId === link.id}
                    aria-label="Delete link"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <Link2 size={13} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-xs text-navy">{bookingPublicUrl(link.slug)}</span>
                <button
                  onClick={() => handleCopy(link.slug)}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-navy px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
                >
                  {copiedSlug === link.slug ? <Check size={12} /> : <Copy size={12} />}
                  {copiedSlug === link.slug ? "Copied" : "Copy"}
                </button>
                <a
                  href={bookingPublicUrl(link.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-100"
                >
                  <ExternalLink size={12} />
                  Preview
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalLink !== undefined && (
        <BookingLinkModal link={modalLink} onClose={() => setModalLink(undefined)} onSave={handleSave} onDelete={handleDelete} />
      )}
    </div>
  );
}
