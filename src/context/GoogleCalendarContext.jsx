import { createContext, useContext, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { useCalendarConnection } from "../hooks/useCalendarConnection";
import { useGoogleCalendarEvents } from "../hooks/useGoogleCalendarEvents";

const GoogleCalendarContext = createContext(null);

/**
 * Composition of the connection state machine + event data layer — both now
 * proxied through the server-side Calendar connection (src.calendar_connect)
 * rather than a browser-held Google token. The advisor connects once and
 * it just keeps working, with no repeated Google login prompts.
 *
 * Deliberately has NO auto-fetch/polling/visibility effects. Fetching is
 * driven explicitly by the screens that need data:
 *   - My Day calls `fetchDay(selectedDate)` (cached + de-duped per day).
 *   - Profile calls `refreshEvents()` on mount / manual refresh.
 *   - Reports calls `fetchEventsInRange(...)`.
 */
export function GoogleCalendarProvider({ children }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const cacheKey = user?.email;
  const auth = useCalendarConnection();
  const cal = useGoogleCalendarEvents(cacheKey);

  // Lands here after the OAuth redirect comes back from Google, no matter
  // which page `connect()` was called from (it always returns to the page
  // that started it).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const result = searchParams.get("gcalConnect");
    if (!result) return;
    if (result === "connected") {
      addToast("Google Calendar connected");
      auth.refreshStatus();
    } else if (result === "denied") {
      addToast("Google Calendar connection was cancelled");
    } else {
      addToast("Could not connect Google Calendar — please try again");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("gcalConnect");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const value = useMemo(
    () => ({
      // connection state
      status: auth.status, // 'disconnected' | 'connected' | 'expired' | 'revoked'
      googleEmail: auth.googleEmail,
      isConfigured: auth.isConfigured,
      connect: auth.connect,
      disconnect: auth.disconnect,

      // upcoming list (Profile) + offline cache metadata
      events: cal.events,
      cachedAt: cal.cachedAt,
      eventsLoading: cal.loading,
      eventsError: cal.error,
      refreshEvents: cal.refresh,

      // per-day access (My Day)
      fetchDay: cal.fetchDay,
      getDayState: cal.getDayState,

      // range (Reports) + CRUD
      fetchEventsInRange: cal.fetchRange,
      // meeting-time dropdown availability (one call per window, not per slot)
      checkAvailability: cal.fetchFreeBusy,
      createEvent: cal.create,
      updateEvent: cal.update,
      deleteEvent: cal.remove,
      isAppEvent: cal.isAppEvent,
    }),
    [auth, cal]
  );

  return <GoogleCalendarContext.Provider value={value}>{children}</GoogleCalendarContext.Provider>;
}

export function useGoogleCalendar() {
  const ctx = useContext(GoogleCalendarContext);
  if (!ctx) throw new Error("useGoogleCalendar must be used within GoogleCalendarProvider");
  return ctx;
}
