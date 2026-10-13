// Formats a raw digit string into "$1,234,567.89" as the advisor types —
// strips everything but digits and a single decimal point, re-inserts
// thousand-separator commas into the integer part, and keeps up to 2
// decimal digits as typed. Used for every money field in Sales Package
// Prep (Annual Income, Mortgage Balance, Coverage, Premium, ...).
export function formatCurrencyInput(value) {
  let cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = cleaned.split(".");
  if (!intPart && decPart === undefined) return "";
  const withCommas = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let result = `$${withCommas || "0"}`;
  if (decPart !== undefined) result += `.${decPart.slice(0, 2)}`;
  return result;
}

/**
 * An amount in minor units (cents) as money for a person to read: 9900, "usd" -> "$99.00"; 4999, "cad" -> "$49.99 CAD". Built from the integer
 * alone (whole units, then the two cents digits): an amount is never turned into a fractional number and back, so a price can never be shown a cent out.
 * Anything that is not a whole number of cents (a fraction, text, NaN) shows as a dash rather than a wrong figure.
 * @param {number | null | undefined} cents
 * @param {string} [currency]
 */
export function formatCents(cents, currency = "usd") {
  const amount = cents ?? 0; // nothing at all reads as zero, as it always has (a wallet with no balance yet)
  if (!Number.isSafeInteger(amount)) return "–";
  const sign = amount < 0 ? "-" : "";
  const magnitude = Math.abs(amount);
  const centsPart = magnitude % 100;
  const whole = (magnitude - centsPart) / 100; // exact: the numerator is a multiple of 100
  const grouped = whole.toLocaleString("en-US");
  const digits = String(centsPart).padStart(2, "0");
  const code = String(currency || "usd").toUpperCase();
  if (code === "USD") return `${sign}$${grouped}.${digits}`;
  if (code === "CAD") return `${sign}$${grouped}.${digits} CAD`;
  return `${sign}${grouped}.${digits} ${code}`;
}
