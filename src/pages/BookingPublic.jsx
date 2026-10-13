import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Video, X, Plus, User, Globe } from "lucide-react";
import Logo from "../components/Logo";
import Footer from "../components/Footer";
import { api, ApiError } from "../lib/api";
import { formatCanadianPhone } from "../lib/phone";

// Renders plain text with any bare URLs turned into clickable links — the
// description field is free text, so a pasted Zoom/Drive/website link needs
// to actually be clickable rather than just sitting there as dead text.
const URL_RE = /(https?:\/\/[^\s]+)/g;
function linkifyText(text) {
  // A capturing-group split alternates [text, url, text, url, ..., text] —
  // odd indices are always the matched URLs.
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-av-blue underline hover:text-navy">
        {part}
      </a>
    ) : (
      part
    )
  );
}

const LOCATION_LABELS = {
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  zoom: "Zoom",
  phone: "Phone call",
  in_person: "In person",
  custom: "Custom",
  ask_invitee: "You'll be asked where to meet",
};

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function formatDateLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// Formats a slot's viewer-local instant for display, in the viewer's own
// timezone — this is what fixes "I'm in Turkey, the advisor's in Canada,
// the times didn't line up": the backend converts, this just renders it.
function formatSlotTime(slot) {
  return new Date(slot.viewerIso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// The *date* shown to the viewer also has to come from their own local
// instant, not the advisor's calendar date (`slot.date`) — near midnight
// the two can be different days, and showing the advisor's day back to the
// viewer here would silently reintroduce the same "times don't line up"
// confusion for the date half of a slot instead of the time half.
function formatSlotDateLabel(slot) {
  return new Date(slot.viewerIso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const VIEWER_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
})();

/**
 * Public, unauthenticated "book a meeting with me" page — the link the
 * advisor shares with clients. No app chrome/nav: this is meant to be
 * opened cold by someone who isn't an Finuxia user.
 */
export default function BookingPublic() {
  const { slug } = useParams();
  const [info, setInfo] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", note: "" });
  const [guestEmails, setGuestEmails] = useState([]);
  const [guestInput, setGuestInput] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    api
      .getPublicBookingInfo(slug)
      .then(setInfo)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
  }, [slug]);

  useEffect(() => {
    if (!info) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot(null);
    api
      .getPublicBookingSlots(slug, selectedDate, VIEWER_TZ)
      .then((data) => {
        if (!cancelled) setSlots(data.slots || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, selectedDate, info]);

  const isPast = useMemo(() => selectedDate < toISODate(new Date()), [selectedDate]);

  const addGuest = () => {
    const value = guestInput.trim();
    if (!value) return;
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError("That guest email doesn't look right.");
      return;
    }
    if (!guestEmails.includes(value)) setGuestEmails((g) => [...g, value]);
    setGuestInput("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError("Pick a time first.");
      return;
    }
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    // A guest email typed into the box but never explicitly "added" (no
    // Enter, no clicking Add) was being silently dropped from the booking
    // entirely — submit must fold in whatever's still sitting there, not
    // just the already-committed guestEmails list.
    let submittedGuestEmails = guestEmails;
    const pendingGuest = guestInput.trim();
    if (pendingGuest) {
      if (!/^\S+@\S+\.\S+$/.test(pendingGuest)) {
        setError("That guest email doesn't look right — fix it or remove it before booking.");
        return;
      }
      submittedGuestEmails = guestEmails.includes(pendingGuest) ? guestEmails : [...guestEmails, pendingGuest];
      setGuestEmails(submittedGuestEmails);
      setGuestInput("");
    }

    const missingRequired = (info?.customQuestions || []).find((q) => q.required && !answers[q.id]?.trim());
    if (missingRequired) {
      setError(`Please answer: ${missingRequired.label}`);
      return;
    }
    if (info?.locationType === "ask_invitee" && !locationNote.trim()) {
      setError("Let the advisor know where you'd like to meet.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await api.requestBooking(slug, {
        clientName: form.name.trim(),
        clientEmail: form.email.trim(),
        clientPhone: form.phone.trim(),
        guestEmails: submittedGuestEmails,
        note: form.note.trim(),
        answers: Object.entries(answers)
          .filter(([, v]) => v.trim())
          .map(([questionId, answer]) => ({ questionId, answer: answer.trim() })),
        date: selectedSlot.date,
        time: selectedSlot.time,
        locationNote: locationNote.trim(),
      });
      setConfirmed({ slot: selectedSlot, status: result.status });
    } catch (err) {
      setError(err.message || "Could not submit your request.");
      if (err instanceof ApiError && err.status === 409) {
        setSelectedSlot(null);
        api.getPublicBookingSlots(slug, selectedDate, VIEWER_TZ).then((data) => setSlots(data.slots || []));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
          <AlertTriangle size={28} className="text-slate-300" />
          <p className="text-lg font-semibold text-navy">This booking link doesn't exist</p>
          <p className="text-sm text-slate-500">Double-check the link, or ask for a new one.</p>
        </div>
      </PageShell>
    );
  }

  if (confirmed) {
    const isConfirmed = confirmed.status === "confirmed";
    const start = new Date(confirmed.slot.viewerIso);
    const end = new Date(start.getTime() + (info?.durationMinutes || 30) * 60000);
    const time = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
    const dateLabel = start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    const locationLabel = info?.locationType
      ? info.locationValue && info.locationType !== "google_meet"
        ? `${LOCATION_LABELS[info.locationType] || "Location"} — ${info.locationValue}`
        : "Web conferencing details to follow."
      : "Details to follow.";
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-6 rounded-2xl bg-white px-6 py-12 shadow-sm">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-av-green" />
              <h1 className="text-2xl font-bold text-navy">{isConfirmed ? "You are scheduled!" : "Request sent!"}</h1>
            </div>
            <p className="text-sm text-slate-500">
              {info?.confirmationMessage
                ? info.confirmationMessage
                : isConfirmed
                  ? "A calendar invitation has been sent to your email address."
                  : `${info?.advisorName || "Your advisor"} will confirm this time shortly.`}
            </p>
          </div>

          <div className="w-full max-w-md rounded-xl border border-slate-200 p-6">
            <h2 className="mb-4 text-xl font-bold text-navy">{info?.title || "Meeting"}</h2>
            <ul className="flex flex-col gap-3 text-sm font-medium text-slate-600">
              {info?.advisorName && (
                <li className="flex items-center gap-3">
                  <User size={16} className="shrink-0 text-slate-400" />
                  {info.advisorName}
                </li>
              )}
              <li className="flex items-center gap-3">
                <CalendarDays size={16} className="shrink-0 text-slate-400" />
                {time(start)} - {time(end)}, {dateLabel}
              </li>
              <li className="flex items-center gap-3">
                <Globe size={16} className="shrink-0 text-slate-400" />
                {VIEWER_TZ.replace(/_/g, " ")}
              </li>
              <li className="flex items-center gap-3">
                <Video size={16} className="shrink-0 text-slate-400" />
                {locationLabel}
              </li>
            </ul>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h1 className="text-lg font-bold text-navy">{info ? info.title : "Book a meeting"}</h1>
          {info?.advisorName && <p className="text-sm text-slate-500">with {info.advisorName}</p>}
          {info?.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{linkifyText(info.description)}</p>}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock size={12} />
            {info?.durationMinutes} minutes · times shown in {VIEWER_TZ}
          </div>
          {info?.locationType && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Video size={12} />
              {LOCATION_LABELS[info.locationType] || "Video call"}
              {info.locationValue ? ` — ${info.locationValue}` : ""}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
          <div className="border-b border-slate-100 p-6 sm:border-b-0 sm:border-r">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedDate((d) => addDays(d, -1))}
                disabled={addDays(selectedDate, -1) < toISODate(new Date())}
                aria-label="Previous day"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-navy">
                <CalendarDays size={14} className="text-gold-dark" />
                {formatDateLabel(selectedDate)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
                aria-label="Next day"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {isPast ? (
              <p className="py-8 text-center text-sm text-slate-400">Pick a day from today onward.</p>
            ) : slotsLoading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading times...</p>
            ) : slots.length === 0 ? null : (
              <div className="grid grid-cols-2 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.iso}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot)}
                    title={slot.available ? undefined : "Already booked"}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      !slot.available
                        ? "cursor-not-allowed border-slate-100 text-slate-300 line-through"
                        : selectedSlot?.iso === slot.iso
                          ? "border-gold bg-gold/10 text-gold-dark"
                          : "border-slate-200 text-navy hover:border-slate-300"
                    }`}
                  >
                    <Clock size={12} />
                    {formatSlotTime(slot)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-6">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Your name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Phone (optional)</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: formatCanadianPhone(e.target.value) }))}
                placeholder="(123) 456-7890"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>

            {info?.locationType === "ask_invitee" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Where would you like to meet? <span className="text-av-red">*</span>
                </span>
                <input
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  placeholder="Phone number, address, or a video call link"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </label>
            )}

            {info?.guestsAllowed && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Guests (optional)</span>
                {guestEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {guestEmails.map((email) => (
                      <span
                        key={email}
                        className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-navy"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => setGuestEmails((g) => g.filter((e) => e !== email))}
                          className="text-slate-400 hover:text-av-red"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={guestInput}
                    onChange={(e) => setGuestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addGuest();
                      }
                    }}
                    placeholder="guest@example.com"
                    className="w-full min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                  />
                  <button
                    type="button"
                    onClick={addGuest}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy transition hover:bg-slate-50"
                  >
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              </div>
            )}

            {(info?.customQuestions || []).map((q) => (
              <label key={q.id} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {q.label}
                  {q.required && <span className="text-av-red"> *</span>}
                </span>
                <textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                />
              </label>
            ))}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Anything else? (optional)</span>
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>

            {error && <p className="text-xs text-av-red">{error}</p>}

            <button
              type="submit"
              disabled={!selectedSlot || submitting}
              className="mt-1 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? info?.instantConfirm
                  ? "Booking..."
                  : "Requesting..."
                : selectedSlot
                  ? info?.instantConfirm
                    ? `Book ${formatSlotTime(selectedSlot)} on ${formatSlotDateLabel(selectedSlot)}`
                    : `Request ${formatSlotTime(selectedSlot)} on ${formatSlotDateLabel(selectedSlot)}`
                  : "Pick a time first"}
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <Logo size={20} plain />
          <span className="text-base font-bold tracking-tight text-navy">
            Fin<span className="text-gold-dark">uxia</span>
          </span>
        </div>
        {children}
      </div>
      <Footer minimal />
    </div>
  );
}
