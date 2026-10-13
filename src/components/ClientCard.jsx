import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, MessageSquareText, PhoneCall, Clock3, CalendarClock, Mail } from "lucide-react";
import { pipelineProgress, getStage } from "../lib/pipeline";
import { daysAgoLabel } from "../lib/followUp";
import { formatCanadianPhone } from "../lib/phone";
import { useToast } from "../context/ToastContext";
import { openGmailCompose, feedbackEmailDraft } from "../lib/gmail";

const PRIORITY_DOT = {
  High: "bg-av-red",
  Medium: "bg-av-amber",
  Low: "bg-av-green",
};

const PRIORITY_BADGE = {
  High: "bg-av-red/10 text-av-red",
  Medium: "bg-av-amber/10 text-av-amber",
  Low: "bg-av-green/10 text-av-green",
};

const FOLLOWUP_BADGE = {
  Overdue: "bg-av-red/10 text-av-red",
  Today: "bg-av-amber/10 text-av-amber",
  "This week": "bg-av-blue/10 text-av-blue",
  "Next month": "bg-slate-100 text-slate-500",
  TBD: "bg-slate-100 text-slate-500",
};

export default function ClientCard({ client, done, onToggleDone, onSnooze, onReschedule, subtitle, showFeedbackEmail }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const fullName = `${client.first} ${client.last}`;
  const stage = getStage(client.currentStage);
  const progress = pipelineProgress(client.currentStage);
  const firstNote = client.notes?.[0]?.text;

  const handleSendFeedbackEmail = () => {
    if (!client.email) {
      addToast(`No email on file for ${fullName}`.trim());
      return;
    }
    openGmailCompose(feedbackEmailDraft(client, { meetingLabel: client.meeting?.label }));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onToggleDone?.(client.id)}
          aria-label={done ? "Mark as not done" : "Mark as done"}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
            done ? "border-gold bg-gold" : "border-slate-300 hover:border-gold"
          }`}
        >
          {done && <span className="h-2 w-2 rounded-full bg-white" />}
        </button>

        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_DOT[client.priority]}`} />

        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="min-w-0">
            <span
              className={`block truncate text-sm font-semibold ${
                done ? "text-slate-400 line-through" : "text-navy"
              }`}
            >
              {fullName}
            </span>
            {subtitle && <span className="block truncate text-xs text-slate-400">{subtitle}</span>}
          </span>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_BADGE[client.priority]}`}>
              {client.priority}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                FOLLOWUP_BADGE[client.nextFollowUp] ?? FOLLOWUP_BADGE.TBD
              }`}
            >
              {client.nextFollowUp}
            </span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2 sm:hidden">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              FOLLOWUP_BADGE[client.nextFollowUp] ?? FOLLOWUP_BADGE.TBD
            }`}
          >
            {client.nextFollowUp}
          </span>
        </div>

        <button
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
        >
          <ChevronDown
            size={18}
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {showFeedbackEmail && done && (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <button
            onClick={handleSendFeedbackEmail}
            className="flex items-center gap-1.5 rounded-lg bg-av-blue/10 px-3 py-1.5 text-xs font-semibold text-av-blue transition hover:bg-av-blue/20"
          >
            <Mail size={13} />
            Send feedback email
          </button>
        </div>
      )}

      <div
        className={`grid transition-all duration-200 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-slate-100 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Phone</p>
                <p className="text-navy">{formatCanadianPhone(client.phone) || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Last Contact</p>
                <p className="text-navy">{daysAgoLabel(client.lastContactDate)}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium uppercase tracking-wide text-slate-400">
                  {stage?.label ?? client.currentStage}
                </span>
                <span className="font-semibold text-navy">{progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {firstNote && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Note</p>
                <p className="text-sm text-slate-600">{firstNote}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => navigate(`/clients/${client.id}`)}
                className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
              >
                Open Profile
              </button>
              <button
                onClick={() => navigate(`/clients/${client.id}?ai=1`)}
                className="flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold-dark transition hover:bg-gold/20"
              >
                <MessageSquareText size={13} />
                Draft Message
              </button>
              <button
                onClick={() => addToast("Call logged")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <PhoneCall size={13} />
                Log Call
              </button>
              {onSnooze && (
                <button
                  onClick={() => onSnooze(client.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <Clock3 size={13} />
                  Snooze 3 days
                </button>
              )}
              {onReschedule && (
                <button
                  onClick={() => onReschedule(client)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <CalendarClock size={13} />
                  Reschedule
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
