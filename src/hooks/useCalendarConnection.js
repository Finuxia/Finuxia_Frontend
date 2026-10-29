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
 *
 * `account` is whoever is signed in (null when nobody is). The status is asked for only then, and again when a different person signs in. It used to be
 * asked on every page load, the login page included, where it could only ever be refused (FE-16).
 */
export function useCalendarConnection(account = null) {
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
    if (!account) {
      // Signed out: nothing to ask, and nothing of the previous person's connection may be left showing.
      setStatus("disconnected");
      setGoogleEmail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshStatus();
  }, [account, refreshStatus]);

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
