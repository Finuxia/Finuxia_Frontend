import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, ImagePlus, Star, X } from "lucide-react";
import Logo from "../components/layout/Logo";
import Footer from "../components/layout/Footer";
import { api } from "../lib/api";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 3000;
const field =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";
const label = "mb-1 block text-xs font-semibold text-slate-600";

/**
 * The page an advisor's client opens from a testimonial link: no sign-in. They give their name, say what they think, and may add a photo of themselves.
 * What they send goes to the advisor who made the link and nowhere else.
 */
export default function TestimonialPublic() {
  const { slug } = useParams();
  const [info, setInfo] = useState(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", roleCompany: "", text: "", website: "" });
  const [rating, setRating] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getPublicTestimonialInfo(slug)
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setForm((f) => ({ ...f, name: data.prefillName || "" }));
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const choosePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image (JPEG, PNG, WebP or GIF).");
    } else if (file.size > MAX_PHOTO_BYTES) {
      setError("That photo is larger than 5 MB.");
    } else {
      setError("");
      setPhoto(file);
      setPreview(URL.createObjectURL(file));
    }
    e.target.value = "";
  };

  const removePhoto = () => {
    setPhoto(null);
    setPreview("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Please tell us your name.");
    if (!form.text.trim()) return setError("Please write a few words.");
    if (!consent) return setError("Please confirm that your advisor may use what you wrote.");
    const body = new FormData();
    body.append("name", form.name.trim());
    body.append("text", form.text.trim());
    body.append("consent", "true");
    if (form.email.trim()) body.append("email", form.email.trim());
    if (form.phone.trim()) body.append("phone", form.phone.trim());
    if (form.roleCompany.trim()) body.append("roleCompany", form.roleCompany.trim());
    if (rating) body.append("rating", String(rating));
    if (form.website) body.append("website", form.website);
    if (photo) body.append("photo", photo);
    setBusy(true);
    try {
      await api.submitTestimonial(slug, body);
      setDone(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-center px-4 py-5">
        <Logo size={24} plain />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10">
        {missing ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-xs">
            <h1 className="text-lg font-bold text-navy">This link isn't open</h1>
            <p className="mt-2 text-sm text-slate-500">
              It may have been switched off, or the address is not quite right. Please ask the person who sent it for a new one.
            </p>
          </div>
        ) : !info ? (
          <p className="py-16 text-center text-sm text-slate-400">Loading…</p>
        ) : done ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-xs">
            <CheckCircle2 size={36} className="mx-auto text-av-green" />
            <h1 className="mt-3 text-xl font-bold text-navy">Thank you!</h1>
            <p className="mt-2 text-sm text-slate-500">
              Your words have been sent to {info.advisorName}. We really appreciate you taking the time.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-xs" noValidate>
            <div>
              <h1 className="text-xl font-bold text-navy">{info.title}</h1>
              <p className="mt-1 text-sm text-slate-500">For {info.advisorName}</p>
              {info.message && (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{info.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="t-name" className={label}>
                Your name <span className="text-av-red">*</span>
              </label>
              <input id="t-name" value={form.name} onChange={set("name")} maxLength={150} autoComplete="name" className={field} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="t-role" className={label}>
                  Job title or company <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="t-role"
                  value={form.roleCompany}
                  onChange={set("roleCompany")}
                  maxLength={150}
                  autoComplete="organization-title"
                  className={field}
                />
              </div>
              <div>
                <label htmlFor="t-email" className={label}>
                  Email <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="t-email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  maxLength={254}
                  autoComplete="email"
                  className={field}
                />
              </div>
            </div>

            <div>
              <label htmlFor="t-phone" className={label}>
                Phone <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="t-phone"
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                maxLength={60}
                autoComplete="tel"
                className={field}
              />
            </div>

            <div>
              <span className={label}>How would you rate your experience? (optional)</span>
              <div className="flex gap-1" role="group" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? 0 : n)}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    aria-pressed={rating >= n}
                    className="rounded p-0.5 text-slate-300 transition hover:text-gold"
                  >
                    <Star size={26} className={rating >= n ? "fill-gold text-gold" : ""} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="t-text" className={label}>
                What do you think? <span className="text-av-red">*</span>
              </label>
              <textarea
                id="t-text"
                value={form.text}
                onChange={set("text")}
                maxLength={MAX_TEXT}
                rows={6}
                className={field}
                placeholder="Tell us about your experience…"
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {form.text.length} / {MAX_TEXT}
              </p>
            </div>

            <div>
              <span className={label}>A photo of you (optional)</span>
              {preview ? (
                <div className="flex items-center gap-3">
                  <img src={preview} alt="Preview of what you chose" className="h-16 w-16 rounded-full object-cover" />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-av-red"
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition hover:border-gold hover:text-navy"
                >
                  <ImagePlus size={18} /> Add a photo
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={choosePhoto}
                className="sr-only"
                aria-label="Photo"
                tabIndex={-1}
              />
            </div>

            {/* A field a person never sees: a script that fills in every field fills this one too. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="t-website">Website</label>
              <input id="t-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
              <span>
                I agree that {info.advisorName} may use what I wrote{photo ? " and my photo" : ""} as a testimonial.
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-av-red/10 px-3 py-2 text-sm text-av-red">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </main>
      <Footer minimal />
    </div>
  );
}
