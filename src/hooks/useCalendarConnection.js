import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

/**
 * The server-side Google Calendar connection (src.calendar_connect) — a
 * refresh token held encrypted on the backend, tied to the advisor's
 * Finuxia account rather than their browser. Replaces the old
 * browser-held GIS token flow, which needed a silent or manual Google
 * reauth on effectively every fresh page load; this one just works once
 * connected, indefinitely, regardless of login sessions.
 *
 * `connect()` is a full-page redirect to Google (not a popup) — there's
 * nothing for a popup blocker to catch, and the token exchange happens
 * server-side after Google redirects back to /api/calendar-connect/callback.
 */
export function useCalendarConnection() {
  const [status, setStatus] = useState("disconnected"); // disconnected | connected | expired | revoked
  const [googleEmail, setGoogleEmail] = useState(null);
  const [isConfigured, setIsConfigured] = useState(true); // assume yes until status says otherwise
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(() => {
    return api
      .getCalendarConnectStatus()
      .then((data) => {
        setStatus(data.status);
        setGoogleEmail(data.googleEmail);
        setIsConfigured(data.isConfigured !== false);
        return data;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const connect = useCallback(async () => {
    const { authUrl } = await api.getCalendarConnectUrl(window.location.pathname);
    window.location.href = authUrl; // navigates away; nothing after this runs
  }, []);

  const disconnect = useCallback(async () => {
    await api.disconnectCalendarConnect();
    setStatus("disconnected");
    setGoogleEmail(null);
  }, []);

  return { status, googleEmail, isConfigured, loading, connect, disconnect, refreshStatus };
}
