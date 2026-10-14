// Small pure helpers for the second-factor screens (SEC-12).

/** "JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP": a secret typed by hand is read in groups. */
export function formatSecret(secret) {
  return String(secret || "")
    .replace(/\s+/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** What was typed, reduced to the digits of an authenticator code ("123 456" -> "123456"), at most 6. */
export function digitsOnly(text) {
  return String(text || "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

/** True when `text` is a complete authenticator code. */
export function isCompleteCode(text) {
  return digitsOnly(text).length === 6;
}

/** The recovery codes as one block of text, for copying or downloading. */
export function recoveryCodesText(codes, account) {
  return [
    `Finuxia recovery codes${account ? ` for ${account}` : ""}`,
    "Each code works once. Keep them somewhere safe and private.",
    "",
    ...codes,
    "",
  ].join("\n");
}
