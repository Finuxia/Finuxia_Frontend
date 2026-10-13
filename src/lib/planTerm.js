import { formatCents } from "./currency";

const plural = (n, unit) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/**
 * How long one purchase of a plan grants access for, in words a customer reads: "1 month", "3 months", "1 year", "30 days",
 * "until December 31, 2026", "no end". Read from the plan's own `accessDuration` (the server's record), never worked out from the price.
 * @param {import("./types").AccessDuration | null | undefined} duration
 */
export function describeTerm(duration) {
  if (!duration) return "";
  switch (duration.kind) {
    case "never":
      return "no end";
    case "days":
      return plural(duration.days ?? 0, "day");
    case "months":
      return plural(duration.months ?? 0, "month");
    case "years":
      return plural(duration.years ?? 0, "year");
    case "until_date": {
      const [y, m, d] = String(duration.until || "")
        .split("-")
        .map(Number);
      const date = y && m && d ? new Date(y, m - 1, d) : null; // a calendar date: built from its own parts so no time zone can move it
      return date ? `until ${date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` : "";
    }
    default:
      return "";
  }
}

/**
 * The price line of a plan: "Free", or "$49.00 for 1 month" ("$99.00 CAD one-time" when access never ends). The amount is shown from the
 * whole number of cents, with no arithmetic on a fraction.
 * @param {import("./types").Plan} plan
 */
export function priceLine(plan) {
  if (plan.priceCents === 0) return "Free";
  const amount = formatCents(plan.priceCents, plan.currency);
  const duration = plan.accessDuration;
  if (!duration) return amount;
  if (duration.kind === "never") return `${amount} one-time`;
  if (duration.kind === "until_date") return `${amount} ${describeTerm(duration)}`;
  return `${amount} for ${describeTerm(duration)}`;
}
