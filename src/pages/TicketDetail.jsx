import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Bug, Sparkles, Send, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { getTicketStatusMeta, getTicketTypeMeta } from "../lib/ticketMeta";

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTicket(id);
      setTicket(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const updated = await api.addTicketComment(id, reply.trim());
      setTicket(updated);
      setReply("");
    } catch (err) {
      addToast(err.message || "Could not send your reply");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
        Loading…
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-slate-500">{error?.message || "Ticket not found."}</p>
        <Link to="/tickets" className="mt-3 inline-block text-sm font-semibold text-gold-dark">
          Back to Tickets
        </Link>
      </div>
    );
  }

  const statusMeta = getTicketStatusMeta(ticket.status);
  const typeMeta = getTicketTypeMeta(ticket.type);
  const TypeIcon = ticket.type === "feature" ? Sparkles : Bug;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <button
        onClick={() => navigate("/tickets")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy"
      >
        <ArrowLeft size={15} />
        Back to Tickets
      </button>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeMeta.badge}`}>
              <TypeIcon size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-navy">{ticket.title}</h1>
              <p className="text-xs text-slate-400">
                {typeMeta.label} · Filed {formatDateTime(ticket.createdAt)}
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badge}`}>
            {statusMeta.label}
          </span>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{ticket.description}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-navy">Conversation</h2>

        {(ticket.comments || []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
            No replies yet. We'll respond here once we've looked into it.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {ticket.comments.map((c) => (
              <div
                key={c.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  c.isAdmin ? "self-start bg-navy text-white" : "self-end bg-slate-100 text-navy"
                }`}
              >
                <div className={`mb-1 flex items-center gap-1.5 text-xs font-semibold ${c.isAdmin ? "text-gold" : "text-slate-500"}`}>
                  {c.isAdmin && <ShieldCheck size={12} />}
                  {c.authorName}
                  <span className={`font-normal ${c.isAdmin ? "text-slate-300" : "text-slate-400"}`}>
                    · {formatDateTime(c.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed">{c.message}</p>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleReply} className="mt-2 flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add a reply…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-50"
          >
            <Send size={14} />
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
