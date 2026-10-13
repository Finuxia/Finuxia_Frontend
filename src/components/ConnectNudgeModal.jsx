import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { HardDrive, CalendarClock, X } from "lucide-react";
import { api } from "../lib/api";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";

/**
 * A one-time nudge right after signup: a brand-new account has neither
 * Google connection yet, and most of the app (client folders, My Day,
 * booking) is a lot less useful without them. Only ever triggered by
 * Register.jsx navigating here with `state: { justRegistered: true }` — a
 * normal login never shows this, so it doesn't nag on every visit.
 */
export default function ConnectNudgeModal() {
  const location = useLocation();
  const justRegistered = Boolean(location.state?.justRegistered);
  const { isConfigured: calConfigured, status: calStatus, connect: connectCalendar } = useGoogleCalendar();

  const [driveStatus, setDriveStatus] = useState(null);
  const [driveConfigured, setDriveConfigured] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [connecting, setConnecting] = useState(null); // 'drive' | 'calendar' | null

  useEffect(() => {
    if (!justRegistered) return;
    api
      .getDriveStatus()
      .then((data) => {
        setDriveStatus(data.status);
        setDriveConfigured(data.isConfigured !== false);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justRegistered]);

  const driveNeeded = driveConfigured && driveStatus !== null && driveStatus !== "connected";
  const calendarNeeded = calConfigured && calStatus !== "connected";

  if (!justRegistered || dismissed || driveStatus === null) return null;
  if (!driveNeeded && !calendarNeeded) return null;

  const handleConnectDrive = async () => {
    setConnecting("drive");
    try {
      const { authUrl } = await api.getDriveConnectUrl();
      window.location.href = authUrl;
    } catch {
      setConnecting(null);
    }
  };

  const handleConnectCalendar = async () => {
    setConnecting("calendar");
    try {
      await connectCalendar();
    } catch {
      setConnecting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">Connect your Google account</h2>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          For the best experience, connect Google Drive and Google Calendar — client folders, meetings, and booking
          links all depend on them.
        </p>

        <div className="flex flex-col gap-2.5">
          {driveNeeded && (
            <button
              onClick={handleConnectDrive}
              disabled={connecting !== null}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                <HardDrive size={15} className="text-gold-dark" />
                Google Drive
              </span>
              <span className="text-xs font-medium text-gold-dark">
                {connecting === "drive" ? "Connecting..." : "Connect"}
              </span>
            </button>
          )}
          {calendarNeeded && (
            <button
              onClick={handleConnectCalendar}
              disabled={connecting !== null}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                <CalendarClock size={15} className="text-gold-dark" />
                Google Calendar
              </span>
              <span className="text-xs font-medium text-gold-dark">
                {connecting === "calendar" ? "Connecting..." : "Connect"}
              </span>
            </button>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
