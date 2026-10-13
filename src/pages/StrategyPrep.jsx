import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Target, Phone, Mail, Send, CalendarClock, UserPlus, ClipboardCheck, Copy, Check } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import { formatCanadianPhone } from "../lib/phone";
import { getStage, pipelineProgress } from "../lib/pipeline";
import { formatDate, daysAgoLabel } from "../lib/followUp";

// Process / relationship talking points per stage — communication and logistics
// only, never investment or product advice.
const STAGE_AGENDA = {
  cp: ["Confirm contact details and preferred channel", "Understand their goals and priorities", "Agree on next-meeting timing"],
  fc1: ["Recap what you learned in planning", "Listen and take notes on their situation", "Set expectations for the process"],
  fc2: ["Review open questions from FC1", "Clarify priorities and timeline", "Confirm who else should be involved"],
  fc3: ["Summarize everything gathered so far", "Confirm you understand their needs", "Schedule the strategy meeting"],
  strategy_meeting: [
    "Walk through the prepared strategy at a high level",
    "Answer questions and note concerns",
    "Agree on follow-up actions",
  ],
  strategy_followup: ["Revisit any items they wanted to think over", "Address outstanding questions", "Confirm the closing timeline"],
  closing: ["Review paperwork and next steps", "Confirm delivery expectations", "Thank them and set a check-in date"],
  policy_delivery: ["Deliver documents and walk through them", "Confirm they know how to reach you", "Schedule the first review"],
  client: ["Quarterly relationship check-in", "Ask about referrals", "Confirm details are up to date"],
};

export default function StrategyPrep() {
  const { clients } = useClients();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  const selectedId = searchParams.get("client") || (clients[0] ? String(clients[0].id) : "");
  const client = useMemo(() => clients.find((c) => String(c.id) === String(selectedId)), [clients, selectedId]);

  const setSelected = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("client", id);
    setSearchParams(next, { replace: true });
  };

  const stage = client ? getStage(client.currentStage) : null;
  const agenda = client ? STAGE_AGENDA[client.currentStage] || [] : [];

  const prepText = client
    ? [
        `Strategy prep — ${client.first} ${client.last}`.trim(),
        `Stage: ${stage?.label ?? client.currentStage} (${pipelineProgress(client.currentStage)}%)`,
        `Priority: ${client.priority}`,
        `Last contact: ${daysAgoLabel(client.lastContactDate)}`,
        `Next follow-up: ${client.followUpDate ? formatDate(client.followUpDate) : client.nextFollowUp}`,
        client.referredBy ? `Referred by: ${client.referredBy}` : null,
        client.interests?.length ? `Interests: ${client.interests.join(", ")}` : null,
        "",
        "Agenda:",
        ...agenda.map((a) => `• ${a}`),
        client.notes?.[0] ? `\nLatest note: ${client.notes[0].text}` : "",
      ]
        .filter((l) => l !== null)
        .join("\n")
    : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prepText);
      setCopied(true);
      addToast("Prep notes copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("Could not copy — select the text manually");
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
          <Target size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">Strategy Prep</h1>
          <p className="text-sm text-slate-500">Get meeting-ready for a client in seconds.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="strategy-client" className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Client
        </label>
        <select
          id="strategy-client"
          value={selectedId}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 sm:max-w-sm"
        >
          {clients.length === 0 && <option value="">No clients yet</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first} {c.last} — {getStage(c.currentStage)?.short}
            </option>
          ))}
        </select>
      </div>

      {!client ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          Add a client to prepare for a strategy meeting.
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy">Snapshot</h2>
              <span className="rounded-full bg-navy/5 px-2.5 py-0.5 text-xs font-semibold text-navy/70">
                {stage?.label} · {pipelineProgress(client.currentStage)}%
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Row icon={Phone} label="Phone" value={formatCanadianPhone(client.phone) || "—"} />
              <Row icon={Mail} label="Email" value={client.email || "—"} />
              <Row icon={Send} label="Telegram" value={client.telegram || "—"} />
              <Row icon={UserPlus} label="Referred By" value={client.referredBy || "—"} />
              <Row icon={CalendarClock} label="Last Contact" value={daysAgoLabel(client.lastContactDate)} />
              <Row
                icon={CalendarClock}
                label="Next Follow-up"
                value={client.followUpDate ? `${formatDate(client.followUpDate)} · ${client.nextFollowUp}` : client.nextFollowUp}
              />
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy">
              <ClipboardCheck size={15} className="text-gold-dark" />
              Suggested agenda
            </h2>
            <ul className="flex flex-col gap-2">
              {agenda.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {item}
                </li>
              ))}
            </ul>
            {client.notes?.[0] && (
              <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Latest note</p>
                <p className="mt-1 text-sm text-slate-600">{client.notes[0].text}</p>
              </div>
            )}
            <p className="mt-4 text-xs text-slate-400">
              Talking points cover process and relationship only — not investment, product, or financial advice.
            </p>
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-light"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy Prep Notes"}
            </button>
            <button
              onClick={() => navigate(`/clients/${client.id}`)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50"
            >
              Open Profile
            </button>
            <button
              onClick={() => navigate(`/clients/${client.id}?ai=1`)}
              className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold-dark transition hover:bg-gold/20"
            >
              <Sparkles size={15} />
              Draft Message
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-navy">{value}</p>
      </div>
    </div>
  );
}
