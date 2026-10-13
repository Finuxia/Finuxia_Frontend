import { useEffect, useState } from "react";
import { Check, Clock } from "lucide-react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import TimeInput from "../ui/TimeInput";

const DAYS = [
  { key: "0", label: "Mon" },
  { key: "1", label: "Tue" },
  { key: "2", label: "Wed" },
  { key: "3", label: "Thu" },
  { key: "4", label: "Fri" },
  { key: "5", label: "Sat" },
  { key: "6", label: "Sun" },
];

/**
 * The advisor's actual calendar availability — weekly hours + timezone.
 * Shared across every one of their booking links (see BookingLinks.jsx),
 * since it's the same one real calendar underneath all of them.
 */
// Full IANA list where supported (modern browsers); a small fallback list
// covers the rest so the picker never comes up empty.
const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [
      "UTC",
      "America/Edmonton",
      "America/Vancouver",
      "America/Toronto",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Istanbul",
      "Asia/Tehran",
      "Asia/Dubai",
      "Asia/Tokyo",
    ];
  }
})();

export default function AvailabilityPanel() {
  const { addToast } = useToast();
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getBookingAvailability()
      .then((data) => {
        // Only fill in a browser-detected guess when nothing's been saved
        // yet — once the advisor has a real value, a stale browser (or one
        // that's just briefly in a different place) should never silently
        // overwrite their actual working timezone on save.
        const timezone = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        setAvailability({ ...data, timezone });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleDay = (key) => {
    setAvailability((s) => {
      const weeklyHours = { ...s.weeklyHours };
      if (weeklyHours[key]) delete weeklyHours[key];
      else weeklyHours[key] = [{ start: "09:00", end: "17:00" }];
      return { ...s, weeklyHours };
    });
  };

  const updateDayTime = (key, field, value) => {
    setAvailability((s) => ({
      ...s,
      weeklyHours: { ...s.weeklyHours, [key]: [{ ...s.weeklyHours[key][0], [field]: value }] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await api.updateBookingAvailability({
        weeklyHours: availability.weeklyHours,
        timezone: availability.timezone,
      });
      setAvailability((s) => ({ ...s, ...saved }));
      addToast("Availability saved");
    } catch (err) {
      addToast(err.message || "Could not save availability");
    } finally {
      setSaving(false);
    }
  };

  const detectTimezone = () => {
    setAvailability((s) => ({ ...s, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
  };

  if (loading) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-navy">
          <Clock size={15} className="text-slate-400" />
          Availability
        </h2>
        <p className="text-sm text-slate-400">Loading...</p>
      </section>
    );
  }

  if (!availability) return null;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-navy">
        <Clock size={15} className="text-slate-400" />
        Availability
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Your open hours — shared across every booking link you create (see Booking Links in the nav).
      </p>

      <div className="mb-4 flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Timezone</span>
        <p className="text-xs text-slate-400">
          Hours below are in this timezone — clients see them converted to their own. Wrong? Pick the right one, or re-detect it from this
          browser.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={availability.timezone}
            onChange={(e) => setAvailability((s) => ({ ...s, timezone: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none focus:border-gold"
          >
            {!TIMEZONES.includes(availability.timezone) && <option value={availability.timezone}>{availability.timezone}</option>}
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={detectTimezone}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy transition hover:bg-slate-50"
          >
            Detect
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {DAYS.map((day) => {
          const window = availability.weeklyHours[day.key]?.[0];
          const enabled = Boolean(window);
          return (
            <div key={day.key} className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => toggleDay(day.key)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                  enabled ? "border-gold bg-gold" : "border-slate-300"
                }`}
              >
                {enabled && <Check size={11} className="text-white" />}
              </button>
              <span className="w-9 text-xs font-medium text-navy">{day.label}</span>
              {enabled ? (
                <>
                  <TimeInput value={window.start} onChange={(time) => updateDayTime(day.key, "start", time)} className="w-32" />
                  <span className="text-xs text-slate-400">to</span>
                  <TimeInput value={window.end} onChange={(time) => updateDayTime(day.key, "end", time)} className="w-32" />
                </>
              ) : (
                <span className="text-xs text-slate-400">Unavailable</span>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save availability"}
      </button>
    </section>
  );
}
