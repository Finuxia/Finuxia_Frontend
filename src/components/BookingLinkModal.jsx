import { useState } from "react";
import { X, Plus, Trash2, GripVertical, CalendarClock, Link2 } from "lucide-react";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";

const emptyQuestion = () => ({ id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: "", required: false });

const LOCATION_OPTIONS = [
  { value: "google_meet", label: "Google Meet" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "zoom", label: "Zoom" },
  { value: "phone", label: "Phone call" },
  { value: "in_person", label: "In person" },
  { value: "custom", label: "Custom" },
  { value: "ask_invitee", label: "Ask invitee" },
];

// Which location types carry a free-text detail, and what that field asks for.
const LOCATION_VALUE_FIELD = {
  phone: { label: "Phone number", placeholder: "+1 555 010 0100" },
  in_person: { label: "Address", placeholder: "123 Main St, Suite 400" },
  custom: { label: "Details", placeholder: "Paste a link or any instructions" },
};

/**
 * Create/edit a booking link — an advisor can have several, each its own
 * named "event type" (title, description, duration, buffer, guest policy,
 * custom intake questions, confirmation message). Availability (hours) is
 * shared and lives on Profile — this only covers what's specific to the link.
 */
export default function BookingLinkModal({ link, onClose, onSave, onDelete }) {
  const isEdit = Boolean(link);
  const { isConfigured, status: calStatus, connect } = useGoogleCalendar();
  const [connecting, setConnecting] = useState(false);
  const [title, setTitle] = useState(link?.title || "");
  const [description, setDescription] = useState(link?.description || "");
  const [durationMinutes, setDurationMinutes] = useState(link?.durationMinutes ?? 30);
  const [bufferMinutes, setBufferMinutes] = useState(link?.bufferMinutes ?? 0);
  const [guestsAllowed, setGuestsAllowed] = useState(link?.guestsAllowed ?? false);
  const [questions, setQuestions] = useState(link?.customQuestions?.length ? link.customQuestions : []);
  const [confirmationMessage, setConfirmationMessage] = useState(link?.confirmationMessage || "");
  const [locationType, setLocationType] = useState(link?.locationType || "google_meet");
  const [locationValue, setLocationValue] = useState(link?.locationValue || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const addQuestion = () => {
    if (questions.length >= 10) return;
    setQuestions((qs) => [...qs, emptyQuestion()]);
  };
  const updateQuestion = (id, patch) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const removeQuestion = (id) => setQuestions((qs) => qs.filter((q) => q.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        durationMinutes: Number(durationMinutes),
        bufferMinutes: Number(bufferMinutes),
        guestsAllowed,
        customQuestions: questions.filter((q) => q.label.trim()),
        confirmationMessage: confirmationMessage.trim(),
        locationType,
        locationValue: LOCATION_VALUE_FIELD[locationType] ? locationValue.trim() : "",
      });
      onClose();
    } catch (err) {
      setError(err.message || "Could not save this booking link.");
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connect();
      // Unreachable in practice — connect() is a full-page redirect to Google.
    } catch (err) {
      setError(err.message || "Could not connect to Google Calendar");
      setConnecting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${link.title}"? Existing bookings made through it are kept, but the link stops working.`)) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err.message || "Could not delete this link.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-navy">{isEdit ? "Edit Booking Link" : "New Booking Link"}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          {isConfigured && calStatus !== "connected" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-av-amber/40 bg-av-amber/5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <CalendarClock size={15} className="mt-0.5 shrink-0 text-av-amber" />
                <p className="text-xs text-slate-600">
                  Connect Google Calendar so bookings through this link confirm instantly with a Google Meet link,
                  no approval needed.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
              >
                <Link2 size={12} />
                {connecting ? "Connecting..." : "Connect"}
              </button>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Client Introduction Session"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's this meeting for? Shown to clients before they book."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Duration</span>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              >
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Buffer between meetings</span>
              <select
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
              >
                {[0, 5, 10, 15, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "None" : `${m} min`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Location</span>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
            >
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {locationType === "zoom" && (
            <p className="-mt-2 text-xs text-slate-400">
              Needs a connected Zoom account (Profile → Zoom) — without one, bookings still work but land pending
              for you to add the link yourself.
            </p>
          )}
          {locationType === "ask_invitee" && (
            <p className="-mt-2 text-xs text-slate-400">
              The client will be asked where they'd like to meet when they book.
            </p>
          )}
          {LOCATION_VALUE_FIELD[locationType] && (
            <label className="-mt-2 flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {LOCATION_VALUE_FIELD[locationType].label} (optional)
              </span>
              <input
                value={locationValue}
                onChange={(e) => setLocationValue(e.target.value)}
                placeholder={LOCATION_VALUE_FIELD[locationType].placeholder}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
          )}

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
            <span className="text-sm text-navy">Allow guests</span>
            <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={guestsAllowed}
                onChange={(e) => setGuestsAllowed(e.target.checked)}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-gold" />
              <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </label>
          </div>
          {guestsAllowed && (
            <p className="-mt-2 text-xs text-slate-400">
              Clients will see a field to add guest emails when booking through this link.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Intake questions (optional)</span>
              <button
                type="button"
                onClick={addQuestion}
                disabled={questions.length >= 10}
                className="flex items-center gap-1 text-xs font-semibold text-gold-dark transition hover:underline disabled:opacity-40"
              >
                <Plus size={12} />
                Add question
              </button>
            </div>
            {questions.map((q) => (
              <div key={q.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5">
                <GripVertical size={14} className="mt-2 shrink-0 text-slate-300" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <input
                    value={q.label}
                    onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                    placeholder="What would you like to discuss?"
                    className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-navy outline-none focus:border-gold"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                      className="accent-gold"
                    />
                    Required
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  aria-label="Remove question"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Confirmation message (optional)</span>
            <textarea
              value={confirmationMessage}
              onChange={(e) => setConfirmationMessage(e.target.value)}
              rows={2}
              placeholder="Shown to clients right after they book. Leave blank for the default message."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          {error && <p className="text-xs text-av-red">{error}</p>}

          <div className="mt-1 flex items-center justify-between gap-3">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-av-red transition hover:bg-av-red/10 disabled:opacity-60"
              >
                <Trash2 size={14} />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "Saving..." : isEdit ? "Save" : "Create Link"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
