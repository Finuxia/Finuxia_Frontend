import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { accessCopy } from "../../lib/accessCopy";

/**
 * The line across the top of every page when access is close to its end (or has ended), so nobody loses access by surprise. Whether to show it
 * and how loudly comes from the server (`billing.access.warning`); nothing is worked out here from a date.
 */
export default function AccessBanner() {
  const { billing } = useAuth();
  const access = billing?.access;
  if (!access || access.warning === "none") return null;
  // Someone who has told us they do not plan to continue is not waiting to be reminded: the countdown would
  // be nagging, not helping. Carried over from the trial banner this replaces (BIL-12).
  if (billing.notContinuingSince) return null;
  const copy = accessCopy(access);
  if (!copy) return null;
  const tone = access.warning === "soon" ? "bg-gold/15 text-gold-dark" : "bg-av-red/10 text-av-red";

  return (
    <div role="status" data-testid="access-banner" className={`px-4 py-2 text-center text-xs font-medium sm:px-6 ${tone}`}>
      {copy.headline}{" "}
      <NavLink to="/billing" className="font-semibold underline">
        Buy a plan
      </NavLink>
    </div>
  );
}
