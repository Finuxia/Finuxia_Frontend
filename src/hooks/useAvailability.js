import { useCallback, useEffect, useRef, useState } from "react";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import { generateSlotTimes, buildTimeSlots } from "../lib/timeSlots";
import { localDayRange } from "../lib/followUp";

const SLOT_TIMES = generateSlotTimes(); // same candidate list for every day

/**
 * Drives the meeting-time dropdown's availability data for one local date.
 *
 * One FreeBusy request per date (never one per slot) — the busy intervals
 * come back once and every candidate slot is checked against them locally.
 *
 * Status:
 *  - "idle"      no date selected yet
 *  - "unchecked" Google isn't connected — slots render plain (no busy info,
 *                and this is NOT treated as an error state)
 *  - "loading"   the FreeBusy request is in flight
 *  - "ready"     slots reflect real availability
 *  - "error"     the request failed — slots are NOT assumed available
 */
export function useAvailability(date, durationMinutes = 30) {
  const { isConfigured, status: googleStatus, checkAvailability } = useGoogleCalendar();
  const [state, setState] = useState({ status: "idle", slots: [], error: null });
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    if (!date) {
      requestIdRef.current += 1; // invalidate any in-flight request
      setState({ status: "idle", slots: [], error: null });
      return;
    }

    if (!isConfigured || googleStatus !== "connected") {
      requestIdRef.current += 1;
      setState({
        status: "unchecked",
        slots: buildTimeSlots({ date, times: SLOT_TIMES, durationMinutes, busyIntervals: [] }),
        error: null,
      });
      return;
    }

    const myRequestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, status: "loading" }));

    const { timeMin, timeMax } = localDayRange(date);
    checkAvailability(timeMin, timeMax)
      .then((busyIntervals) => {
        if (myRequestId !== requestIdRef.current) return; // a newer date/request superseded this one
        setState({
          status: "ready",
          slots: buildTimeSlots({ date, times: SLOT_TIMES, durationMinutes, busyIntervals }),
          error: null,
        });
      })
      .catch((err) => {
        if (myRequestId !== requestIdRef.current) return;
        // Never fall back to "everything available" on failure — that risks
        // double-booking. Surface the error and leave slot data empty.
        setState({ status: "error", slots: [], error: err });
      });
  }, [date, durationMinutes, isConfigured, googleStatus, checkAvailability]);

  // Re-fetch whenever the date (or duration) changes — never keep the
  // previous date's busy intervals.
  useEffect(() => {
    load();
  }, [load]);

  return { ...state, retry: load };
}
