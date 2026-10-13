function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildNotifications(clients, reminders = [], bookingRequests = []) {
  const notifications = [];

  clients.forEach((c) => {
    if (c.nextFollowUp === "Overdue") {
      notifications.push({
        id: `overdue-${c.id}`,
        type: "overdue",
        dot: "bg-av-red",
        text: `Follow-up overdue for ${c.first} ${c.last}`,
        href: `/clients/${c.id}`,
      });
    }
    if (c.meeting?.date === new Date().toISOString().slice(0, 10)) {
      notifications.push({
        id: `meeting-${c.id}`,
        type: "meeting",
        dot: "bg-av-amber",
        text: `Meeting today with ${c.first} ${c.last}${c.meeting.time ? ` at ${formatTime(c.meeting.time)}` : ""}`,
        href: `/clients/${c.id}`,
      });
    }
    if (daysSince(c.joined) <= 2) {
      notifications.push({
        id: `lead-${c.id}`,
        type: "lead",
        dot: "bg-av-green",
        text: `New lead added: ${c.first} ${c.last}`,
        href: `/clients/${c.id}`,
      });
    }
  });

  // Reminders due today or overdue and still pending — same "computed while
  // the app is open" model as the notifications above (there's no background
  // scheduler in this app to push these at the exact due time).
  const today = new Date().toISOString().slice(0, 10);
  reminders.forEach((r) => {
    if (r.status !== "pending") return;
    if (r.dueDate > today) return;
    const overdue = r.dueDate < today;
    notifications.push({
      id: `reminder-${r.id}`,
      type: overdue ? "reminder-overdue" : "reminder-due",
      dot: overdue ? "bg-av-red" : "bg-av-blue",
      text: overdue ? `Reminder overdue: ${r.title}` : `Reminder due today: ${r.title}${r.dueTime ? ` at ${formatTime(r.dueTime)}` : ""}`,
      href: "/my-day",
    });
  });

  // Booking requests waiting on the advisor — same "computed while the app
  // is open" model, no separate push mechanism.
  bookingRequests.forEach((r) => {
    if (r.status !== "pending") return;
    notifications.push({
      id: `booking-${r.id}`,
      type: "booking-pending",
      dot: "bg-av-purple",
      text: `${r.clientName} requested a meeting on ${r.date} at ${formatTime(r.time)}`,
      href: "/booking-requests",
    });
  });

  return notifications;
}

function formatTime(time) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export { formatTime };
