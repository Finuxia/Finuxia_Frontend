import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UsersRound, Pencil } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import GroupModal from "../components/GroupModal";

const AVATAR_BG = {
  "av-blue": "bg-av-blue",
  "av-green": "bg-av-green",
  "av-amber": "bg-av-amber",
  "av-red": "bg-av-red",
  "av-purple": "bg-av-purple",
  "av-teal": "bg-av-teal",
};

/**
 * Free-form client groups the advisor defines themselves — families, company
 * teams, referral circles, whatever grouping helps them manage clients.
 * Deliberately not tied to the pipeline: a group is just a label + a list
 * of client ids.
 */
export default function Groups() {
  const { groups, clients, deleteGroup } = useClients();
  const navigate = useNavigate();
  const [modalGroup, setModalGroup] = useState(undefined); // undefined = closed, null = create, group = edit

  const clientById = new Map(clients.map((c) => [String(c.id), c]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Groups</h1>
          <p className="text-sm text-slate-500">Organize clients into your own groups — family, company, referral circles, anything.</p>
        </div>
        <button
          onClick={() => setModalGroup(null)}
          className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
        >
          <Plus size={15} />
          New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy/5 text-navy">
            <UsersRound size={22} />
          </div>
          <p className="text-sm font-medium text-navy">No groups yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Create a group to organize related clients — e.g. a family, a company's team, or a referral circle.
          </p>
          <button
            onClick={() => setModalGroup(null)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
          >
            <Plus size={15} />
            New Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const members = g.memberIds.map((id) => clientById.get(String(id))).filter(Boolean);
            return (
              <div key={g.id} className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${AVATAR_BG[g.color] ?? "bg-navy"}`} />
                    <h2 className="truncate text-base font-semibold text-navy">{g.name}</h2>
                  </div>
                  <button
                    onClick={() => setModalGroup(g)}
                    aria-label="Edit group"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {members.length} {members.length === 1 ? "member" : "members"}
                </p>

                {members.length === 0 ? (
                  <p className="text-sm text-slate-400">No clients added yet.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {members.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => navigate(`/clients/${c.id}`)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-navy transition hover:bg-slate-50"
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${AVATAR_BG[c.color] ?? "bg-navy"}`}
                        >
                          {c.first[0]}
                          {c.last[0]}
                        </span>
                        <span className="truncate">
                          {c.first} {c.last}
                        </span>
                      </button>
                    ))}
                    {members.length > 5 && (
                      <button
                        onClick={() => setModalGroup(g)}
                        className="px-2 py-1 text-left text-xs font-medium text-gold-dark hover:underline"
                      >
                        +{members.length - 5} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalGroup !== undefined && <GroupModal group={modalGroup} onClose={() => setModalGroup(undefined)} onDelete={deleteGroup} />}
    </div>
  );
}
