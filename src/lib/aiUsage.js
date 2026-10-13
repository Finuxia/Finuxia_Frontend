// Presentation helpers for the AI usage view. Everything here is in CREDITS: token counts are provider detail and mean nothing to an advisor,
// so the API never sends them and this never shows them. The warning level ("warning" / "critical" / "exhausted") and the blocked state are
// decided by the server; this only words them, so the page cannot disagree with the server about when a warning starts.

/** Money from a whole number of cents, by integer arithmetic only: 1005 -> "$10.05". Anything that is not a whole number reads as $0.00. */
export function formatCents(cents) {
  if (!Number.isInteger(cents)) return "$0.00";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

export function creditsLabel(n) {
  const value = Number.isFinite(n) ? n : 0;
  return `${value.toLocaleString("en-US")} ${value === 1 ? "credit" : "credits"}`;
}

/** "November 4": the day the credit starts again, in the advisor's own time zone. Empty if there is none. */
export function formatResetDay(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/** An AI call that was refused because the account cannot pay for it (HTTP 402). The server's sentence names the limit; `data.actions` the way out. */
export function isAiBlocked(error) {
  return error?.status === 402;
}

/**
 * The sentence shown inline once 80% of the period's credits are used, or null when there is nothing to say: below 80%, no allowance to run out of,
 * unlimited, or already blocked (the blocked notice says it better). When the allowance is used up but the wallet can still pay, it says the wallet is paying.
 */
export function warningMessage(usage) {
  if (
    !usage ||
    !usage.warning ||
    usage.blocked ||
    usage.mode !== "allowance" ||
    !usage.credits
  )
    return null;
  const { remaining, total } = usage.credits;
  const again = formatResetDay(usage.period?.end);
  const reset = again ? ` They start again on ${again}.` : "";
  if (usage.warning === "exhausted") {
    return `You've used all ${creditsLabel(total)} included in your plan this period, so AI is now paid from your wallet (${formatCents(usage.wallet?.balanceCents)}).${reset}`;
  }
  return `You've used ${usage.percentUsed}% of your AI credits this period: ${creditsLabel(remaining)} left.${reset}`;
}
