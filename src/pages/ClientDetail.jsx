import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Sparkles, X, Phone, Mail, Send, CalendarDays, CalendarClock, Copy, Check, UserPlus, Pencil, Trash2, Briefcase, Cake, Instagram, BellPlus } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import { formatCanadianPhone } from "../lib/phone";
import { pipelineProgress, getStage } from "../lib/pipeline";
import { formatDate, daysAgoLabel, todayISO } from "../lib/followUp";
import { generateFollowUpMessage, MESSAGE_TONES } from "../lib/ai";
import { api } from "../lib/api";
import MeetingModal from "../components/MeetingModal";
import Timeline from "../components/Timeline";
import NotesSection from "../components/NotesSection";
import AddClientModal from "../components/AddClientModal";
import OpenDriveFolderButton from "../components/OpenDriveFolderButton";
import UploadClientFileButton from "../components/UploadClientFileButton";
import ClientGroupsPicker from "../components/ClientGroupsPicker";
import FollowUpAutomationPanel from "../components/FollowUpAutomationPanel";
import ReminderModal from "../components/ReminderModal";

const AVATAR_BG = {
  "av-blue": "bg-av-blue",
  "av-green": "bg-av-green",
  "av-amber": "bg-av-amber",
  "av-red": "bg-av-red",
  "av-purple": "bg-av-purple",
  "av-teal": "bg-av-teal",
};

export default function ClientDetail() {
  const { id } = useParams();
  const { getClient, addNote, editNote, deleteNote, deleteClient } = useClients();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [aiOpen, setAiOpen] = useState(searchParams.get("ai") === "1");
  const [editingStageId, setEditingStageId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingFollowUp, setAddingFollowUp] = useState(false);

  const client = getClient(id);

  if (!client) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-slate-500">Client not found.</p>
        <Link to="/clients" className="mt-3 inline-block text-sm font-semibold text-gold-dark">
          Back to Clients
        </Link>
      </div>
    );
  }

  const progress = pipelineProgress(client.currentStage);
  const fullName = `${client.first} ${client.last}`;

  const closeAi = () => {
    setAiOpen(false);
    searchParams.delete("ai");
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="flex flex-col gap-6">
      <Link to="/clients" className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-navy">
        <ArrowLeft size={15} />
        Back to Clients
      </Link>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white ${AVATAR_BG[client.color] ?? "bg-navy"}`}>
              {client.first[0]}
              {client.last[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy">{fullName}</h1>
              <p className="text-sm text-slate-500">{client.priority} priority · Joined {formatDate(client.joined)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-av-red transition hover:bg-av-red/5"
            >
              <Trash2 size={14} />
              Delete
            </button>
            <OpenDriveFolderButton clientId={client.id} clientName={fullName} />
            <UploadClientFileButton clientId={client.id} clientName={fullName} clientEmail={client.email} />
            <button
              onClick={() => setAddingFollowUp(true)}
              className="flex items-center gap-1.5 rounded-lg border border-av-blue/30 bg-av-blue/10 px-3 py-2 text-sm font-semibold text-av-blue transition hover:bg-av-blue/20"
            >
              <BellPlus size={14} />
              Add as Follow-up
            </button>
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-light"
            >
              <Sparkles size={15} />
              Draft Message
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow icon={Phone} label="Phone" value={formatCanadianPhone(client.phone) || "—"} />
          <InfoRow icon={Mail} label="Email" value={client.email || "—"} />
          <InfoRow icon={Send} label="Telegram" value={client.telegram || "—"} />
          <InfoRow icon={UserPlus} label="Referred By" value={client.referredBy || "—"} />
          <InfoRow icon={Instagram} label="Instagram" value={client.instagram || "—"} />
          <InfoRow icon={Briefcase} label="Job" value={client.job || "—"} />
          <InfoRow icon={Cake} label="Date of Birth" value={client.dateOfBirth ? formatDate(client.dateOfBirth) : "—"} />
          <InfoRow icon={CalendarDays} label="Last Contact" value={daysAgoLabel(client.lastContactDate)} />
          <InfoRow
            icon={CalendarClock}
            label="Next Follow-up"
            value={client.followUpDate ? `${formatDate(client.followUpDate)} · ${client.nextFollowUp}` : client.nextFollowUp || "TBD"}
          />
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <ClientGroupsPicker clientId={client.id} />
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Current Stage Progress</h2>
            <span className="text-sm font-semibold text-gold-dark">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <FollowUpAutomationPanel clientRef={client.id} clientName={fullName} />

      {addingFollowUp && (
        <ReminderModal
          kind="followup"
          lockClient={client}
          initial={{ title: `Follow up with ${fullName}`.trim(), dueDate: todayISO() }}
          onClose={() => setAddingFollowUp(false)}
          onSubmit={async (payload) => {
            await api.createReminder(payload);
            addToast(`Follow-up set for ${fullName}`);
            setAddingFollowUp(false);
          }}
        />
      )}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-navy">Notes</h2>
        <NotesSection
          notes={client.notes}
          onAdd={(text) => addNote(client.id, text)}
          onEdit={(noteId, text) => editNote(client.id, noteId, text)}
          onDelete={(noteId) => deleteNote(client.id, noteId)}
        />
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-navy">Timeline</h2>
        <Timeline client={client} onEditStage={(stage) => setEditingStageId(stage.id)} />
      </section>

      {editingStageId && (
        <MeetingModal client={client} stage={getStage(editingStageId)} onClose={() => setEditingStageId(null)} />
      )}

      {aiOpen && <AIMessagePanel client={client} onClose={closeAi} />}

      <AddClientModal open={editOpen} onClose={() => setEditOpen(false)} client={client} />

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setConfirmDelete(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-av-red/10 text-av-red">
              <Trash2 size={20} />
            </div>
            <h2 className="text-lg font-semibold text-navy">Delete {fullName}?</h2>
            <p className="mt-1 text-sm text-slate-500">
              This permanently removes the client and their notes from your pipeline. This can't be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteClient(client.id);
                  setConfirmDelete(false);
                  addToast(`${fullName} deleted`.trim());
                  navigate("/clients", { replace: true });
                }}
                className="rounded-lg bg-av-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-av-red/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AIMessagePanel({ client, onClose }) {
  const { addToast } = useToast();
  const [tone, setTone] = useState("friendly");
  const [message, setMessage] = useState(() => generateFollowUpMessage(client, "friendly"));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMessage(generateFollowUpMessage(client, tone));
    setCopied(false);
  }, [tone, client.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      addToast("Message copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("Could not copy — select the text manually");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-navy/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
            <Sparkles size={17} className="text-gold-dark" />
            Draft Message
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-500">
          Suggested follow-up for <span className="font-semibold text-navy">{client.first} {client.last}</span>.
          Communication only — no product or investment recommendations.
        </p>

        <div className="mt-4 flex gap-1.5 rounded-lg bg-slate-100 p-1">
          {MESSAGE_TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTone(t.id)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                tone === t.id ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          rows={10}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-4 w-full rounded-lg border border-slate-200 p-3 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        />

        <button
          onClick={handleCopy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy Message"}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-navy">{value}</p>
      </div>
    </div>
  );
}
