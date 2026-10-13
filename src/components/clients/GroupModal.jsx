import Modal, { ModalTitle } from "../ui/Modal";
import { useMemo, useState } from "react";
import { X, Search, Trash2, Check } from "lucide-react";
import { useClients } from "../../context/ClientsContext";

const COLOR_OPTIONS = [
  { id: "av-blue", swatch: "bg-av-blue" },
  { id: "av-green", swatch: "bg-av-green" },
  { id: "av-amber", swatch: "bg-av-amber" },
  { id: "av-red", swatch: "bg-av-red" },
  { id: "av-purple", swatch: "bg-av-purple" },
  { id: "av-teal", swatch: "bg-av-teal" },
];

/**
 * Create/edit a client group — a free-form label the advisor defines
 * themselves (family, company, referral circle, whatever). Not a pipeline
 * concept: membership is just a list of client ids on the group.
 */
export default function GroupModal({ group, initialMemberIds, onClose, onDelete }) {
  const { clients, addGroup, updateGroup, setGroupMembers } = useClients();
  const isEdit = Boolean(group);
  const [name, setName] = useState(group?.name || "");
  const [color, setColor] = useState(group?.color || COLOR_OPTIONS[0].id);
  const [memberIds, setMemberIds] = useState(group?.memberIds || initialMemberIds || []);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => `${c.first} ${c.last}`.toLowerCase().includes(q));
  }, [clients, query]);

  const toggleMember = (clientId) => {
    setMemberIds((prev) =>
      prev.some((id) => String(id) === String(clientId)) ? prev.filter((id) => String(id) !== String(clientId)) : [...prev, clientId]
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (isEdit) {
      updateGroup(group.id, { name: name.trim(), color });
      setGroupMembers(group.id, memberIds);
    } else {
      const created = addGroup(name, color);
      if (created) setGroupMembers(created.id, memberIds);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${group.name}"? This won't delete any clients.`)) return;
    onDelete(group.id);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      variant="sheet"
      panelClassName="flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl sm:max-w-md sm:rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <ModalTitle className="text-lg font-semibold text-navy">{isEdit ? "Edit Group" : "New Group"}</ModalTitle>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Group name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Smith Family, Acme Corp, College friends..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Color</span>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                aria-label={c.id}
                className={`flex h-7 w-7 items-center justify-center rounded-full ${c.swatch} transition ${
                  color === c.id ? "ring-2 ring-offset-2 ring-navy" : ""
                }`}
              >
                {color === c.id && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Members</span>
            <span className="text-xs font-medium text-slate-400">{memberIds.length} selected</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients..."
              className="w-full text-sm text-navy outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">No clients found.</p>
            ) : (
              filtered.map((c) => {
                const checked = memberIds.some((id) => String(id) === String(c.id));
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleMember(c.id)}
                    className={`flex w-full items-center gap-2.5 border-b border-slate-50 px-3 py-2 text-left transition last:border-0 hover:bg-slate-50 ${
                      checked ? "bg-gold/5" : ""
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition ${
                        checked ? "border-gold bg-gold" : "border-slate-300"
                      }`}
                    >
                      {checked && <Check size={11} className="text-white" />}
                    </span>
                    <span className="truncate text-sm text-navy">
                      {c.first} {c.last}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
        {isEdit ? (
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-av-red transition hover:bg-av-red/10"
          >
            <Trash2 size={14} />
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
          >
            {isEdit ? "Save" : "Create Group"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
