import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LifeBuoy, Plus, MessageSquare, Bug, Sparkles } from "lucide-react";
import usePagedList from "../hooks/usePagedList";
import { formatDate } from "../lib/followUp";
import { getTicketStatusMeta, getTicketTypeMeta } from "../lib/ticketMeta";
import LoadMore from "../components/ui/LoadMore";
import NewTicketModal from "../components/tickets/NewTicketModal";

export default function Tickets() {
  const navigate = useNavigate();
  const { items: tickets, loading, loadingMore, hasMore, loadMore, error } = usePagedList("/api/tickets");
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
            <LifeBuoy size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">Support Tickets</h1>
            <p className="text-sm text-slate-500">Report a bug or ask for a feature — we read every one.</p>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:bg-gold-light"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Ticket
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
          Loading…
        </div>
      ) : error && tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-av-red/30 bg-white px-6 py-10 text-center text-sm text-av-red">
          {error.message}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <LifeBuoy size={24} className="text-slate-300" />
          <p className="text-sm text-slate-400">No tickets yet. Found a bug or have an idea? Let us know.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tickets.map((t) => {
            const statusMeta = getTicketStatusMeta(t.status);
            const typeMeta = getTicketTypeMeta(t.type);
            const TypeIcon = t.type === "feature" ? Sparkles : Bug;
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/tickets/${t.id}`)}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition hover:shadow-md"
              >
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeMeta.badge}`}>
                  <TypeIcon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{t.title}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatDate(t.updatedAt || t.createdAt)}</span>
                    {t.commentCount > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare size={11} />
                        {t.commentCount}
                      </span>
                    )}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.badge}`}>{statusMeta.label}</span>
              </button>
            );
          })}
          <LoadMore hasMore={hasMore} loadingMore={loadingMore} error={tickets.length > 0 ? error : null} onLoadMore={loadMore} />
        </div>
      )}

      <NewTicketModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={(ticket) => navigate(`/tickets/${ticket.id}`)} />
    </div>
  );
}
