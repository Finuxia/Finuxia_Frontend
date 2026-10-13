import { Plus, Trash2 } from "lucide-react";

/** Shown when the advisor already has sales packages: continue one, delete a draft, or start a new package. */
export default function PackagePicker({
  packages,
  onResume,
  onDelete,
  onStartNew,
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Sales Package Prep</h1>
        <p className="text-sm text-slate-500">
          You have saved sales packages in progress — continue one, or start a
          new one.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        {packages.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-gold"
          >
            <button
              type="button"
              onClick={() => onResume(p.id)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-semibold text-navy">
                {p.insuredPerson || p.policyOwner || "Untitled package"}
              </p>
              <p className="text-xs text-slate-400">
                {p.status === "completed" ? "Completed" : "Draft"} · last saved{" "}
                {new Date(p.updatedAt).toLocaleString()}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onDelete(p.id, p.insuredPerson || p.policyOwner)}
              className="flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={() => onResume(p.id)}
              className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white"
            >
              Continue
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onStartNew}
        className="flex w-fit items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:bg-gold-light"
      >
        <Plus size={15} />
        Start a New Sales Package
      </button>
    </div>
  );
}
