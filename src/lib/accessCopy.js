import { formatLongDate } from "./dates";

/**
 * What to tell the customer about their access, from the server's own summary (`billing.access`, see the backend's billing_page module). The
 * server decides whether access is valid, when it ends and how loudly to warn; this only turns that into words.
 *
 * Returns { tone, headline, detail } — tone is "ok" | "soon" | "urgent" | "ended" — or null when the server sent no summary.
 * @param {import("./types").AccessSummary | null | undefined} access
 */
export function accessCopy(access) {
  if (!access) return null;
  const on = formatLongDate(access.endsAt);
  const days = access.daysLeft;
  const inDays = days === 0 ? "today" : days === 1 ? "in 1 day" : `in ${days} days`;
  switch (access.status) {
    case "unlimited":
      return { tone: "ok", headline: "Your access does not end.", detail: "" };
    case "lapsed":
      return {
        tone: "ended",
        headline: on ? `Your access ended on ${on}.` : "Your access has ended.",
        detail: "Nothing you added has been deleted. Buy a plan and everything switches back on right away.",
      };
    case "lapsing":
      return {
        tone: access.warning === "urgent" ? "urgent" : "soon",
        headline: on ? `Your access ends ${inDays}, on ${on}.` : `Your access ends ${inDays}.`,
        detail: "Nothing renews by itself. Buy a plan before then to keep going without a break.",
      };
    default:
      return {
        tone: "ok",
        headline: on ? `You have access until ${on}.` : "You have access.",
        detail: days === null ? "" : days === 1 ? "1 day left." : `${days} days left.`,
      };
  }
}
