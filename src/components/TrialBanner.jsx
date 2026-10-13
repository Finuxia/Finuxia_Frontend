import { NavLink } from "react-router-dom";
import { todayISO } from "../lib/followUp";

/** Whole days from the start of today to an instant (a part day counts as a day; negative once passed); null when there is no valid date. */
export function daysUntil(iso) {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const [y, m, d] = todayISO().split("-").map(Number);
  const startOfToday = new Date(y, m - 1, d);
  return Math.ceil((end - startOfToday) / (1000 * 60 * 60 * 24));
}

/**
 * The line across the top of every signed-in page in the last week of the free trial. It stops once the customer has said they do not
 * intend to continue (`billing.notContinuingSince`): the countdown is then not a reminder they want.
 */
export default function TrialBanner({ user, billing }) {
  const left = daysUntil(user?.subscriptionUntil);
  if (left === null || left > 7 || billing?.notContinuingSince) return null;
  return (
    <div data-testid="trial-banner" className="bg-gold/15 px-4 py-2 text-center text-xs font-medium text-gold-dark sm:px-6">
      {left > 0 ? `Your free trial ends in ${left} day${left === 1 ? "" : "s"}.` : "Your free trial ends today."}{" "}
      <NavLink to="/subscribe" className="font-semibold underline">
        Subscribe
      </NavLink>
    </div>
  );
}
