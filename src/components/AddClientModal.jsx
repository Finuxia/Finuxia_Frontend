import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import { formatCanadianPhone } from "../lib/phone";
import { PROVINCES } from "../lib/salesPackageOptions";
import { birthDateError, MIN_BIRTH_DATE, todayISO } from "../lib/dates";

const EMPTY_FORM = {
  first: "",
  last: "",
  phone: "",
  email: "",
  telegram: "",
  referredBy: "",
  preferredContact: "phone",
  job: "",
  dateOfBirth: "",
  province: "",
  instagram: "",
  priority: "Medium",
  nextFollowUpDate: "",
  lastContactDate: "",
  notes: "",
};

/**
 * Add or Edit a client. Pass a `client` to open in edit mode — the same form
 * and business logic are reused, so an imported client edits exactly like a
 * manually created one.
 *
 * Pass `initialValues` (create mode only) to open with a prefilled draft —
 * e.g. a name guessed from a Google Calendar event title — so the user can
 * review/edit before anything is actually saved. Nothing is created until
 * they submit the form.
 */
export default function AddClientModal({ open, onClose, client = null, initialValues = null, onCreated }) {
  const { addClient, editClient } = useClients();
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // One idempotency key per "add" attempt: if the request fails or is retried,
  // the server returns the same client instead of creating a duplicate.
  const clientTokenRef = useRef(null);
  const isEdit = Boolean(client);

  // Prefill from the client when editing, from a draft when adding with a
  // suggested starting point, or reset to blank otherwise.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    clientTokenRef.current = null;
    if (client) {
      setForm({
        first: client.first || "",
        last: client.last || "",
        phone: formatCanadianPhone(client.phone || ""),
        email: client.email || "",
        telegram: client.telegram || "",
        referredBy: client.referredBy || "",
        preferredContact: client.preferredContact || "phone",
        job: client.job || "",
        dateOfBirth: client.dateOfBirth || "",
        province: client.province || "",
        instagram: client.instagram || "",
        priority: client.priority || "Medium",
        nextFollowUpDate: client.followUpDate || "",
        lastContactDate: client.lastContactDate || "",
        notes: "",
      });
    } else {
      setForm({ ...EMPTY_FORM, ...initialValues });
    }
  }, [open, client, initialValues]);

  if (!open) return null;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const nextErrors = {};
    if (!form.first.trim()) nextErrors.first = "First name is required";
    if (birthDateError(form.dateOfBirth)) nextErrors.dateOfBirth = birthDateError(form.dateOfBirth);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    if (isEdit) {
      editClient(client.id, form);
      addToast(`${form.first} ${form.last}`.trim() + " updated");
    } else {
      clientTokenRef.current ??= typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
      setSaving(true);
      try {
        const created = await addClient(form, { clientToken: clientTokenRef.current });
        clientTokenRef.current = null;
        addToast(`${created.first} ${created.last} added to pipeline`.trim());
        onCreated?.(created);
      } catch (err) {
        // Keep the form open (and the same token) so the user can simply try again.
        addToast(err.message || "Couldn't save the client — please try again");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl animate-slide-up sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-navy">{isEdit ? "Edit Client" : "Add Client"}</h2>
          <button
            onClick={handleClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" required error={errors.first}>
              <input
                autoFocus
                value={form.first}
                onChange={update("first")}
                className={inputClass(errors.first)}
                placeholder="Jane"
              />
            </Field>
            <Field label="Last Name">
              <input
                value={form.last}
                onChange={update("last")}
                className={inputClass()}
                placeholder="Doe"
              />
            </Field>
          </div>

          <Field label="Phone">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: formatCanadianPhone(e.target.value) }))}
              className={inputClass()}
              placeholder="(555) 123-4567"
            />
          </Field>

          <Field label="Referred By">
            <input
              value={form.referredBy}
              onChange={update("referredBy")}
              className={inputClass()}
              placeholder="Who referred this client?"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={update("email")}
                className={inputClass()}
                placeholder="jane.doe@email.com"
              />
            </Field>
            <Field label="Telegram Username">
              <input
                value={form.telegram}
                onChange={update("telegram")}
                className={inputClass()}
                placeholder="@janedoe"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Job">
              <input
                value={form.job}
                onChange={update("job")}
                className={inputClass()}
                placeholder="Occupation"
              />
            </Field>
            <Field label="Instagram Username">
              <input
                value={form.instagram}
                onChange={update("instagram")}
                className={inputClass()}
                placeholder="@janedoe"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of Birth" error={errors.dateOfBirth}>
              <input
                type="date"
                min={MIN_BIRTH_DATE}
                max={todayISO()}
                value={form.dateOfBirth}
                onChange={update("dateOfBirth")}
                className={inputClass(errors.dateOfBirth)}
              />
            </Field>
            <Field label="Province">
              <select value={form.province} onChange={update("province")} className={inputClass()}>
                <option value="">Select...</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <select value={form.priority} onChange={update("priority")} className={inputClass()}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </Field>
            <Field label="Preferred Contact">
              <select value={form.preferredContact} onChange={update("preferredContact")} className={inputClass()}>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="telegram">Telegram</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Last Contact Date">
              <input
                type="date"
                value={form.lastContactDate}
                onChange={update("lastContactDate")}
                className={inputClass()}
              />
            </Field>
            <Field label="Next Follow-up Date">
              <input
                type="date"
                value={form.nextFollowUpDate}
                onChange={update("nextFollowUpDate")}
                className={inputClass()}
              />
            </Field>
          </div>

          {!isEdit && (
            <Field label="Initial Notes">
              <textarea
                value={form.notes}
                onChange={update("notes")}
                rows={3}
                className={inputClass()}
                placeholder="Anything worth remembering about this client..."
              />
            </Field>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="text-av-red"> *</span>}
      </span>
      {children}
      {error && <span className="text-xs text-av-red">{error}</span>}
    </label>
  );
}

function inputClass(error) {
  return `w-full rounded-lg border px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 ${
    error ? "border-av-red" : "border-slate-200"
  }`;
}
