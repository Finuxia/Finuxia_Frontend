import { useEffect, useRef, useState } from "react";
import { UsersRound, Plus, Check } from "lucide-react";
import { useClients } from "../../context/ClientsContext";
import GroupModal from "./GroupModal";

const DOT_BG = {
  "av-blue": "bg-av-blue",
  "av-green": "bg-av-green",
  "av-amber": "bg-av-amber",
  "av-red": "bg-av-red",
  "av-purple": "bg-av-purple",
  "av-teal": "bg-av-teal",
};

/**
 * Compact group-membership chips + a popover to toggle which groups this one
 * client belongs to (and quick-create a new group inline). Lives on
 * ClientDetail — the full Groups page is for bulk management.
 */
export default function ClientGroupsPicker({ clientId }) {
  const { groups, toggleClientInGroup } = useClients();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);

  const mine = groups.filter((g) => g.memberIds.some((id) => String(id) === String(clientId)));

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative flex flex-wrap items-center gap-1.5" ref={ref}>
      {mine.map((g) => (
        <span key={g.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-navy">
          <span className={`h-1.5 w-1.5 rounded-full ${DOT_BG[g.color] ?? "bg-navy"}`} />
          {g.name}
        </span>
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-gold hover:text-gold-dark"
      >
        <UsersRound size={12} />
        {mine.length === 0 ? "Add to group" : "Edit groups"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <div className="max-h-48 overflow-y-auto">
            {groups.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">No groups yet.</p>
            ) : (
              groups.map((g) => {
                const checked = g.memberIds.some((id) => String(id) === String(clientId));
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleClientInGroup(g.id, clientId)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-navy transition hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition ${
                        checked ? "border-gold bg-gold" : "border-slate-300"
                      }`}
                    >
                      {checked && <Check size={11} className="text-white" />}
                    </span>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_BG[g.color] ?? "bg-navy"}`} />
                    <span className="truncate">{g.name}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="mt-1.5 border-t border-slate-100 pt-1.5">
            <button
              onClick={() => {
                setCreating(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-gold-dark transition hover:bg-gold/10"
            >
              <Plus size={14} />
              New group...
            </button>
          </div>
        </div>
      )}

      {creating && <GroupModal initialMemberIds={[clientId]} onClose={() => setCreating(false)} />}
    </div>
  );
}
