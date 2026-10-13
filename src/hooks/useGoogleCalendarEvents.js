import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { isAppEvent } from "../services/googleCalendarApi";
import { readCachedEvents, writeCachedEvents } from "../services/eventCache";
import { localDayRange } from "../lib/followUp";

// A fetched day stays "fresh" for this long, so navigating away and back to a
// recently-viewed date reuses the cache instead of re-hitting the backend.
const DAY_STALE_MS = 60_000;

function tagReconnect(err) {
  if (err instanceof ApiError && err.status === 409) err.needsReconnect = true;
  return err;
}

/**
 * Event access for the connected advisor's primary calendar — proxied
 * through the server-side Calendar connection (src.calendar_connect), not a
 * browser-held token. The advisor never needs to be logged into Google in
 * this tab for any of this to work.
 *
 * Two data surfaces:
 *  - `events`/`refresh`: the "upcoming" list (Profile panel), offline-cached.
 *  - `fetchDay`/`getDayState`: a per-day cache with in-flight de-duplication
 *    and a stale window, used by My Day for a single selected date.
 */
export function useGoogleCalendarEvents(cacheKey) {
  const [events, setEvents] = useState(() => readCachedEvents(cacheKey)?.events ?? []);
  const [cachedAt, setCachedAt] = useState(() => readCachedEvents(cacheKey)?.cachedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Per-day cache (in-memory). dateKey -> { events, status, error, fetchedAt }
  const dayCacheRef = useRef({});
  const inFlightRef = useRef(new Map());
  const [, setDayVersion] = useState(0);
  const bumpDays = useCallback(() => setDayVersion((v) => v + 1), []);

  // Re-hydrate / reset when the app user changes (never leak one user's cache).
  useEffect(() => {
    const cached = readCachedEvents(cacheKey);
    setEvents(cached?.events ?? []);
    setCachedAt(cached?.cachedAt ?? null);
    dayCacheRef.current = {};
    inFlightRef.current.clear();
    bumpDays();
  }, [cacheKey, bumpDays]);

  // ---- upcoming list (Profile) --------------------------------------
  const refresh = useCallback(
    async (options = {}, { silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const items = await api.getCalendarEvents(options);
        setEvents(items);
        setCachedAt(Date.now());
        writeCachedEvents(cacheKey, items);
        return items;
      } catch (err) {
        tagReconnect(err);
        setError(err);
        throw err;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [cacheKey]
  );

  // ---- per-day cache (My Day) ----------------------------------------
  const getDayState = useCallback(
    (dateKey) => dayCacheRef.current[dateKey] || { events: [], status: "idle", error: null },
    []
  );

  const fetchDay = useCallback(
    async (dateKey, { force = false } = {}) => {
      if (!dateKey) return [];
      const entry = dayCacheRef.current[dateKey];
      const fresh = entry && entry.status === "ready" && Date.now() - entry.fetchedAt < DAY_STALE_MS;
      if (!force && fresh) return entry.events;
      // De-dupe simultaneous requests for the same day.
      if (inFlightRef.current.has(dateKey)) return inFlightRef.current.get(dateKey);

      dayCacheRef.current[dateKey] = {
        events: entry?.events || [],
        status: "loading",
        error: null,
        fetchedAt: entry?.fetchedAt || 0,
      };
      bumpDays();

      const { timeMin, timeMax } = localDayRange(dateKey);
      const promise = api
        .getCalendarEvents({ timeMin, timeMax, maxResults: 50 })
        .then((items) => {
          dayCacheRef.current[dateKey] = { events: items, status: "ready", error: null, fetchedAt: Date.now() };
          return items;
        })
        .catch((err) => {
          tagReconnect(err);
          dayCacheRef.current[dateKey] = {
            events: entry?.events || [],
            status: "error",
            error: err,
            fetchedAt: Date.now(),
          };
          throw err;
        })
        .finally(() => {
          inFlightRef.current.delete(dateKey);
          bumpDays();
        });

      inFlightRef.current.set(dateKey, promise);
      return promise;
    },
    [bumpDays]
  );

  const invalidateDays = useCallback(() => {
    dayCacheRef.current = {};
    inFlightRef.current.clear();
    bumpDays();
  }, [bumpDays]);

  // ---- mutations (optimistic on the upcoming list; invalidate day cache) --
  const create = useCallback(
    async (payload) => {
      let created;
      try {
        created = await api.createCalendarEvent(payload);
      } catch (err) {
        throw tagReconnect(err);
      }
      setEvents((prev) => {
        const next = [...prev, created].sort(byStart);
        writeCachedEvents(cacheKey, next);
        return next;
      });
      invalidateDays();
      return created;
    },
    [cacheKey, invalidateDays]
  );

  const update = useCallback(
    async (eventId, patch) => {
      let updated;
      try {
        updated = await api.updateCalendarEvent(eventId, patch);
      } catch (err) {
        throw tagReconnect(err);
      }
      setEvents((prev) => {
        const next = prev.map((e) => (e.id === eventId ? updated : e)).sort(byStart);
        writeCachedEvents(cacheKey, next);
        return next;
      });
      invalidateDays();
      return updated;
    },
    [cacheKey, invalidateDays]
  );

  const remove = useCallback(
    async (eventId) => {
      try {
        await api.deleteCalendarEvent(eventId);
      } catch (err) {
        throw tagReconnect(err);
      }
      setEvents((prev) => {
        const next = prev.filter((e) => e.id !== eventId);
        writeCachedEvents(cacheKey, next);
        return next;
      });
      invalidateDays();
    },
    [cacheKey, invalidateDays]
  );

  // Historical range fetch (Reports) — does not touch shared lists/caches.
  const fetchRange = useCallback((startISO, endISO, maxResults = 250) => {
    return api.getCalendarEvents({ timeMin: startISO, timeMax: endISO, maxResults }).catch((err) => {
      throw tagReconnect(err);
    });
  }, []);

  // FreeBusy for the meeting-time dropdown's availability check — one call
  // per window (a whole day, or a single slot for the pre-submit re-check),
  // never one call per candidate slot.
  const fetchFreeBusy = useCallback((timeMin, timeMax) => {
    return api.queryCalendarFreeBusy(timeMin, timeMax).catch((err) => {
      throw tagReconnect(err);
    });
  }, []);

  return {
    events,
    cachedAt,
    loading,
    error,
    refresh,
    getDayState,
    fetchDay,
    fetchRange,
    fetchFreeBusy,
    create,
    update,
    remove,
    isAppEvent,
  };
}

function byStart(a, b) {
  const av = a.start?.dateTime || a.start?.date || "";
  const bv = b.start?.dateTime || b.start?.date || "";
  return av.localeCompare(bv);
}
