/**
 * Fixed-interval candidate time labels for a day, e.g. ["09:00","09:30",...].
 * This is the dropdown's option list — independent of any availability data.
 */
export function generateSlotTimes({ startHour = 0, endHour = 24, stepMinutes = 30 } = {}) {
  const times = [];
  for (let mins = startHour * 60; mins < endHour * 60; mins += stepMinutes) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return times;
}

/**
 * Builds TimeSlot[] for a local date + duration, flagging any slot that
 * overlaps a busy interval from Google's FreeBusy response.
 *
 * Overlap uses the standard interval-intersection test — comparing only
 * start times would miss a slot that starts before a busy block but still
 * runs into it (or a busy block shorter than the slot but inside it):
 *   requestedStart < busyEnd  AND  requestedEnd > busyStart
 *
 * @param {string} date - "YYYY-MM-DD", local
 * @param {string[]} times - candidate "HH:MM" labels, e.g. from generateSlotTimes()
 * @param {number} durationMinutes - the meeting length each slot represents
 * @param {{start:string,end:string}[]} busyIntervals - ISO datetime ranges from FreeBusy
 * @returns {{time:string, startISO:string, endISO:string, available:boolean, reason?:'CALENDAR_BUSY'}[]}
 */
export function buildTimeSlots({ date, times, durationMinutes, busyIntervals = [] }) {
  const busy = busyIntervals
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => !Number.isNaN(b.start.getTime()) && !Number.isNaN(b.end.getTime()));

  return times.map((time) => {
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const isBusy = busy.some((b) => start < b.end && end > b.start);
    return {
      time,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      available: !isBusy,
      reason: isBusy ? "CALENDAR_BUSY" : undefined,
    };
  });
}

/** 12-hour display label for an "HH:MM" slot time, e.g. "09:00" -> "9:00 AM". */
export function formatSlotLabel(time) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
