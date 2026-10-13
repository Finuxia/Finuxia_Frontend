import { useState } from "react";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { formatDate } from "../lib/followUp";

export default function NotesSection({ notes, onAdd, onEdit, onDelete }) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  const handleAdd = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const saveEdit = (id) => {
    onEdit(id, editText);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note... (e.g. Interested in retirement.)"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white transition hover:bg-navy-light"
        >
          <Plus size={15} />
          Add
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-slate-50 px-4 py-3">
              {editingId === note.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-navy outline-none focus:border-gold"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200"
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </button>
                    <button
                      onClick={() => saveEdit(note.id)}
                      className="rounded-lg bg-navy p-1.5 text-white transition hover:bg-navy-light"
                      aria-label="Save"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-600">{note.text}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(note.date)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(note)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-navy"
                      aria-label="Edit note"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(note.id)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red"
                      aria-label="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
