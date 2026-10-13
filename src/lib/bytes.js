/**
 * A number of bytes as a person reads it: 5242880 -> "5 MB".
 *
 * Binary units (1 KB is 1024 bytes), because that is what the server counts in, and at most one decimal place, so a
 * cap reads back as the round number it was set as rather than as "5.0 MB" or "4.9999 MB". A figure that is not a
 * whole, finite, non-negative count of bytes reads as a dash rather than as a wrong size.
 *
 * @param {number | null | undefined} bytes
 */
export function formatBytes(bytes) {
  // `typeof` rather than Number.isFinite alone: it is what narrows the type for the arithmetic below.
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "–";
  if (bytes < 1024) return `${Math.round(bytes)} bytes`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // A whole number stays whole; anything else keeps one decimal, which is as precise as a size needs to be read.
  const shown = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${shown.toLocaleString("en-US")} ${units[unit]}`;
}
