// What the plan-change dialog says, from the server's quote. The server decides everything that matters (the kind, the amount, the end date, what
// is lost, whether the change is allowed); this only turns it into words, so the screen cannot offer or promise anything the server will not do.
import { formatCents } from "./currency";
import { formatLongDate } from "./dates";

/** The label of a plan card's button for a customer who has access now: Upgrade for a dearer plan, Downgrade for a cheaper one, Switch for the same price. */
export function changeButtonLabel(currentPriceCents, plan) {
  if (plan.priceCents > currentPriceCents) return "Upgrade";
  if (plan.priceCents < currentPriceCents) return "Downgrade";
  return "Switch plan";
}

export function dialogTitle(quote) {
  return quote.kind === "upgrade" ? `Upgrade to ${quote.toPlan.name}` : `Switch to ${quote.toPlan.name}`;
}

/** What the confirm button says: the amount is in it, so nobody confirms a payment without reading how much. */
export function confirmLabel(quote) {
  if (quote.kind === "downgrade") return `Switch to ${quote.toPlan.name} now`;
  if (quote.amountDueCents > 0) return `Pay ${formatCents(quote.amountDueCents, quote.currency)} and upgrade`;
  return `Switch to ${quote.toPlan.name}`;
}

export function dueNow(quote) {
  return quote.amountDueCents > 0 ? formatCents(quote.amountDueCents, quote.currency) : "Nothing to pay";
}

/** One sentence about the access end after the change. */
export function accessEndSentence(quote) {
  const after = formatLongDate(quote.newAccessEndsAt);
  const now = formatLongDate(quote.currentAccessEndsAt);
  if (!quote.newAccessEndsAt) return "Your access will not end.";
  if (quote.kind === "downgrade")
    return now ? `Your access still ends on ${now}. Nothing is refunded and nothing is charged.` : "Your access end does not change.";
  if (!quote.addsTime && now)
    return `Your access still ends on ${now}: you already have longer than this plan would add, so this buys its features, not extra time.`;
  return after ? `Your access will end on ${after}.` : "Your access end will be set when the payment is confirmed.";
}

/** "You have 300 clients; this plan allows 100." */
export function overLimitSentence(item) {
  return `You have ${item.used.toLocaleString("en-US")} ${item.label.toLowerCase()}; this plan allows ${item.limit.toLocaleString("en-US")}.`;
}
