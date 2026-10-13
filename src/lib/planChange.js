// What the plan-change dialog says, from the server's quote. The server decides everything that matters (the kind, the amount, the end date, what
// is lost, whether the change is allowed); this only turns it into words, so the screen cannot offer or promise anything the server will not do.
import { formatBytes } from "./bytes";
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

/**
 * "You have 300 clients; this plan allows 100." A cap counted in bytes is said in words instead of digits:
 * "You are using 7 MB of storage; this plan allows 5 MB."
 *
 * The unit is read from the cap's key, which the server names and which ends in `_bytes` for a size
 * (`storage_bytes` is the only one today). It used to be read from `usedText`/`limitText` on the quote, which
 * the server has never sent: `quote_to_primitives` emits key, label, limit and used, and the backend's own test
 * pins that set. The dialog's test supplied those two fields itself, so it passed while an advisor over their
 * storage was being told "You have 7340032 storage cap; this plan allows 5242880."
 */
export function overLimitSentence(item) {
  if (/_bytes$/.test(item.key)) {
    const what = item.label.replace(/ cap$/i, "").toLowerCase();
    return `You are using ${formatBytes(item.used)} of ${what}; this plan allows ${formatBytes(item.limit)}.`;
  }
  return `You have ${item.used.toLocaleString("en-US")} ${item.label.toLowerCase()}; this plan allows ${item.limit.toLocaleString("en-US")}.`;
}
