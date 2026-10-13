/**
 * Opens Gmail's web compose UI, prefilled — the user still has to click Send
 * themselves. Never sends anything on their behalf.
 */
export function openGmailCompose({ to, subject, body }) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: to || "",
    su: subject || "",
    body: body || "",
  });
  window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer");
}

export function feedbackEmailDraft(client, { meetingLabel } = {}) {
  const name = client.first || "there";
  const subject = `Quick feedback on our meeting${meetingLabel ? ` — ${meetingLabel}` : ""}`;
  const body = [
    `Hi ${name},`,
    "",
    "Thanks again for taking the time to meet today. I'd love to hear your feedback — how did the meeting go for you, and is there anything I can improve for next time?",
    "",
    "Thanks!",
  ].join("\n");
  return { to: client.email, subject, body };
}
