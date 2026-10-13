import { AlertTriangle } from "lucide-react";

/** Shown above a list that was loaded only in part (`isIncompleteList`): a partial list must never look like the whole one. */
export default function IncompleteListNotice({ what, className = "" }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg border border-av-red/40 bg-av-red/10 px-3 py-2.5 text-xs text-av-red ${className}`}
    >
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <p>This list of {what} is incomplete: there are more than could be loaded here, so some are not shown. Please contact support.</p>
    </div>
  );
}
