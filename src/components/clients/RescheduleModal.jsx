import Modal, { ModalTitle } from "../ui/Modal";
import { useState } from "react";
import { X } from "lucide-react";
import { todayISO } from "../../lib/followUp";

export default function RescheduleModal({ title, currentDate, onSave, onClose }) {
  const [date, setDate] = useState(currentDate || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date) return;
    onSave(date);
    onClose();
  };

  return (
    <Modal onClose={onClose} panelClassName="max-w-sm rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <ModalTitle className="text-lg font-semibold text-navy">{title}</ModalTitle>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">New Date</span>
          <input
            type="date"
            autoFocus
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </label>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
