import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { calcNextFollowUp, todayISO, addDays } from "../lib/followUp";
import { getNextStageId, FIRST_STAGE_ID } from "../lib/pipeline";
import { api } from "../lib/api";
import { mapImportRows } from "../lib/clientImport";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const AV_COLORS = ["av-blue", "av-green", "av-amber", "av-red", "av-purple", "av-teal"];
const SYNC_DEBOUNCE_MS = 600;
const RETRY_MS = 5000;

const ClientsContext = createContext(null);

// Ids for things that live *inside* a client (notes) or user state (groups):
// unique per call, no timestamps.
const newLocalId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

function normalize(clients) {
  return clients.map((c) => ({
    ...c,
    nextFollowUp: c.followUpDate ? calcNextFollowUp(c.followUpDate) : c.nextFollowUp ?? "TBD",
    telegram: c.telegram ?? "",
    referredBy: c.referredBy ?? "",
    preferredContact: c.preferredContact ?? "phone",
    meeting: c.meeting ?? null,
    files: c.files ?? [],
    notes: c.notes ?? [],
  }));
}

// Per-user offline cache so a reload paints instantly before the API responds.
function cacheKeys(email) {
  const suffix = email || "anon";
  return {
    clients: `advisorpilot.clients.${suffix}`,
    done: `advisorpilot.dailyTasks.${suffix}`,
    groups: `advisorpilot.groups.${suffix}`,
  };
}
// What the server last confirmed for a client, minus its `version` — used to
// tell which clients actually changed locally and need a PATCH.
function contentJson(client) {
  const { version, ...rest } = client; // eslint-disable-line no-unused-vars
  return JSON.stringify(rest);
}

function readCache(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return fallback;
}
function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function ClientsProvider({ children }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [clients, setClients] = useState([]);
  const [doneTasks, setDoneTasks] = useState({});
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  // True while the rest of the clients are still arriving behind the first page.
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncError, setSyncError] = useState(null);

  const hydratedRef = useRef(false); // becomes true after the initial load settles
  // id -> { version, json }: the last state the server confirmed for each client.
  // Edits are sent per client (PATCH with that version), never as a whole list.
  const snapshotRef = useRef(new Map());
  const clientsRef = useRef([]);
  const syncingRef = useRef(false);
  const dirtyRef = useRef(false);
  const retryTimer = useRef(null);
  const clientTimer = useRef(null);
  const stateTimer = useRef(null);
  const groupsTimer = useRef(null);
  const keys = cacheKeys(user?.email);
  clientsRef.current = clients;

  // Fetches the server's clients and state and makes them the confirmed copy (what edits are diffed against).
  // `isCancelled` lets the login effect drop the result if the user changed while it was in flight.
  const loadFromServer = async (isCancelled = () => false, showEarly = clientsRef.current.length === 0) => {
    // The server hands clients over a page at a time. With nothing on screen yet (`showEarly`: no cache), the first page is shown at once and the
    // rest are added behind it, so a long list does not keep the advisor waiting; edits made meanwhile are kept (pages are merged by id, never
    // replacing what is there). With the cache already on screen the complete list is swapped in at the end, as before: no flicker of a shrinking
    // list.
    let shownFirstPage = false;
    const onPage = (items) => {
      if (!showEarly || isCancelled()) return;
      const page = normalize(items);
      if (!shownFirstPage) {
        shownFirstPage = true;
        snapshotRef.current = new Map(page.map((c) => [String(c.id), { version: c.version, json: contentJson(c) }]));
        setClients(page);
        setLoading(false);
        setLoadingMore(true);
        return;
      }
      for (const c of page)
        if (!snapshotRef.current.has(String(c.id))) snapshotRef.current.set(String(c.id), { version: c.version, json: contentJson(c) });
      setClients((prev) => {
        const have = new Set(prev.map((c) => String(c.id)));
        return [...prev, ...page.filter((c) => !have.has(String(c.id)))];
      });
    };
    try {
      const [serverClients, serverState] = await Promise.all([
        api.getAllPages("/api/clients", {}, { onPage, isCancelled }),
        api.getState(),
      ]);
      if (isCancelled()) return;
      const normalized = normalize(serverClients);
      if (!shownFirstPage) {
        snapshotRef.current = new Map(normalized.map((c) => [String(c.id), { version: c.version, json: contentJson(c) }]));
        setClients(normalized);
      }
      setDoneTasks(serverState?.doneTasks || {});
      setGroups(serverState?.groups || []);
      writeCache(keys.clients, normalized);
      writeCache(keys.done, serverState?.doneTasks || {});
      writeCache(keys.groups, serverState?.groups || []);
      setSyncError(null);
    } catch (err) {
      if (!isCancelled()) setSyncError(err);
    } finally {
      if (!isCancelled()) {
        setLoading(false);
        setLoadingMore(false);
        // Flip AFTER effects from the setState above have run, so the sync
        // effects below don't echo the just-loaded data back to the server.
        setTimeout(() => {
          hydratedRef.current = true;
          // Edits made while the later pages were still arriving are unsent (sync was off). Touch the list so the sync effect runs once, from the
          // rendered state, now that everything is loaded and confirmed.
          if (shownFirstPage) setClients((prev) => [...prev]);
        }, 0);
      }
    }
  };

  // "Refresh" on a conflict message: drop what this tab holds and take the server's copy.
  const refreshFromServer = () => {
    hydratedRef.current = false;
    setLoading(true);
    return loadFromServer();
  };

  // ---- load on login / clear on logout -------------------------------
  useEffect(() => {
    hydratedRef.current = false;
    snapshotRef.current = new Map();
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (clientTimer.current) clearTimeout(clientTimer.current);
    if (stateTimer.current) clearTimeout(stateTimer.current);
    if (groupsTimer.current) clearTimeout(groupsTimer.current);

    if (!user) {
      setClients([]);
      setDoneTasks({});
      setGroups([]);
      setLoading(false);
      return;
    }

    // Instant paint from cache, then reconcile with the server.
    const cached = normalize(readCache(keys.clients, []));
    setClients(cached);
    setDoneTasks(readCache(keys.done, {}));
    setGroups(readCache(keys.groups, []));
    setLoading(true);
    let cancelled = false;
    loadFromServer(() => cancelled, cached.length === 0);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // ---- sync: clients (per-client PATCH / DELETE, optimistic concurrency) ----
  // Each local edit is diffed against what the server last confirmed and sent as
  // a PATCH carrying that client's version. A 409 means another tab/device saved
  // first: we adopt the server's copy instead of overwriting it.
  const adoptServerCopy = (id, serverClient) => {
    const [fresh] = normalize([serverClient]);
    snapshotRef.current.set(id, { version: fresh.version, json: contentJson(fresh) });
    setClients((prev) => prev.map((c) => (String(c.id) === id ? fresh : c)));
    addToast(`${fresh.first} ${fresh.last}`.trim() + " was changed elsewhere — showing the latest version", {
      action: { label: "Refresh", onClick: refreshFromServer },
    });
  };

  const syncOnce = async () => {
    const snap = snapshotRef.current;
    const current = clientsRef.current;
    const currentIds = new Set(current.map((c) => String(c.id)));
    let failed = false;

    for (const id of [...snap.keys()]) {
      if (currentIds.has(id)) continue;
      try {
        await api.deleteClient(id);
        snap.delete(id);
      } catch (err) {
        if (err.status === 404) snap.delete(id);
        else {
          failed = true;
          setSyncError(err);
        }
      }
    }

    for (const c of current) {
      const id = String(c.id);
      const entry = snap.get(id);
      if (!entry) continue; // not confirmed by the server (e.g. the first load failed) — never PATCH blindly
      const json = contentJson(c);
      if (json === entry.json) continue;
      const { id: _id, version: _version, ...body } = c; // eslint-disable-line no-unused-vars
      try {
        const saved = await api.patchClient(id, { ...body, version: entry.version });
        snap.set(id, { version: saved.version, json });
        setClients((prev) => prev.map((x) => (String(x.id) === id ? { ...x, version: saved.version } : x)));
      } catch (err) {
        if (err.status === 409 && err.data?.client) {
          adoptServerCopy(id, err.data.client);
        } else if (err.status === 404) {
          snap.delete(id);
          setClients((prev) => prev.filter((x) => String(x.id) !== id));
          addToast("A client you edited no longer exists — it was removed elsewhere");
        } else {
          failed = true;
          setSyncError(err);
          addToast(err.message || "Couldn't save changes to the server");
        }
      }
    }

    if (failed) {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(runSync, RETRY_MS);
    } else {
      setSyncError(null);
    }
  };

  const runSync = async () => {
    if (syncingRef.current) {
      dirtyRef.current = true; // edits arrived mid-sync — go around again afterwards
      return;
    }
    syncingRef.current = true;
    try {
      do {
        dirtyRef.current = false;
        await syncOnce();
      } while (dirtyRef.current);
    } finally {
      syncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    writeCache(keys.clients, clients);
    if (clientTimer.current) clearTimeout(clientTimer.current);
    clientTimer.current = setTimeout(runSync, SYNC_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  // ---- debounced sync: daily tasks -----------------------------------
  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    writeCache(keys.done, doneTasks);
    if (stateTimer.current) clearTimeout(stateTimer.current);
    stateTimer.current = setTimeout(() => {
      api.putState(doneTasks).catch((err) => setSyncError(err));
    }, SYNC_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneTasks]);

  // ---- debounced sync: client groups ----------------------------------
  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    writeCache(keys.groups, groups);
    if (groupsTimer.current) clearTimeout(groupsTimer.current);
    groupsTimer.current = setTimeout(() => {
      api
        .putGroups(groups)
        .then(() => setSyncError(null))
        .catch((err) => {
          setSyncError(err);
          addToast(err.message || "Couldn't save group changes to the server");
        });
    }, SYNC_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const nextColor = () => AV_COLORS[clients.length % AV_COLORS.length];

  // Creation waits for the server, which assigns the client's id — so there's no
  // browser-made id to collide, and callers (the "go to client" navigation,
  // groups, daily tasks) only ever see the real one. `clientToken` makes a retry
  // of the same submit return the same client instead of a duplicate.
  const addClient = async (form, { clientToken } = {}) => {
    const nextFollowUp = form.nextFollowUpDate ? calcNextFollowUp(form.nextFollowUpDate) : "TBD";

    const draft = {
      first: form.first.trim(),
      last: form.last.trim(),
      phone: form.phone?.trim() ?? "",
      email: form.email?.trim() ?? "",
      telegram: form.telegram?.trim() ?? "",
      referredBy: form.referredBy?.trim() ?? "",
      preferredContact: form.preferredContact || "phone",
      job: form.job?.trim() ?? "",
      dateOfBirth: form.dateOfBirth || "",
      province: form.province || "",
      instagram: form.instagram?.trim() ?? "",
      priority: form.priority || "Medium",
      color: nextColor(),
      joined: todayISO(),
      followUpDate: form.nextFollowUpDate || "",
      nextFollowUp,
      lastContactDate: form.lastContactDate || "",
      lastContact: form.lastContactDate ? `Last contact — ${form.lastContactDate}` : "Not yet contacted",
      interests: [],
      currentStage: form.currentStage || FIRST_STAGE_ID,
      stages: { [form.currentStage || FIRST_STAGE_ID]: { status: "pending", data: {}, files: [] } },
      meeting: null,
      files: [],
      notes: form.notes?.trim() ? [{ id: newLocalId(), text: form.notes.trim(), date: todayISO() }] : [],
      clientToken,
    };

    const [created] = normalize([await api.createClient(draft)]);
    snapshotRef.current.set(String(created.id), { version: created.version, json: contentJson(created) });
    setClients((prev) => (prev.some((c) => String(c.id) === String(created.id)) ? prev : [created, ...prev]));
    return created;
  };

  const updateClient = (clientId, patch) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...patch } : c)));
  };

  /**
   * Full edit from the client form — recomputes the derived follow-up/contact
   * fields the same way addClient does, so an edited client (whether created
   * manually or imported) stays internally consistent.
   */
  const editClient = (clientId, form) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const followUpDate = form.nextFollowUpDate || "";
        const lastContactDate = form.lastContactDate || "";
        return {
          ...c,
          first: form.first.trim(),
          last: form.last.trim(),
          phone: form.phone?.trim() ?? "",
          email: form.email?.trim() ?? "",
          telegram: form.telegram?.trim() ?? "",
          referredBy: form.referredBy?.trim() ?? "",
          preferredContact: form.preferredContact || "phone",
          job: form.job?.trim() ?? "",
          dateOfBirth: form.dateOfBirth || "",
          province: form.province || "",
          instagram: form.instagram?.trim() ?? "",
          priority: form.priority || "Medium",
          followUpDate,
          nextFollowUp: followUpDate ? calcNextFollowUp(followUpDate) : "TBD",
          lastContactDate,
          lastContact: lastContactDate
            ? c.lastContactDate === lastContactDate
              ? c.lastContact
              : `Last contact — ${lastContactDate}`
            : "Not yet contacted",
        };
      })
    );
  };

  const deleteClient = (clientId) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  const addNote = (clientId, text) => {
    if (!text?.trim()) return;
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? { ...c, notes: [{ id: newLocalId(), text: text.trim(), date: todayISO() }, ...c.notes] }
          : c
      )
    );
  };

  const editNote = (clientId, noteId, text) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? { ...c, notes: c.notes.map((n) => (n.id === noteId ? { ...n, text } : n)) }
          : c
      )
    );
  };

  const deleteNote = (clientId, noteId) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c))
    );
  };

  /**
   * Edits a stage's meeting date/outcome and optionally logs a note.
   * Marking the client's *current* stage as completed/skipped auto-advances
   * currentStage to the next stage in the pipeline.
   */
  const updateStage = (clientId, stageId, { date, status, note }) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;

        const stages = { ...c.stages };
        const existing = stages[stageId] ?? { data: {}, files: [] };
        stages[stageId] = { ...existing, status, date: date || existing.date };

        let currentStage = c.currentStage;
        if (stageId === c.currentStage && (status === "completed" || status === "skipped")) {
          const next = getNextStageId(stageId);
          if (next) {
            currentStage = next;
            const nextExisting = stages[next] ?? { data: {}, files: [] };
            if (nextExisting.status === "upcoming" || !nextExisting.status) {
              stages[next] = { ...nextExisting, status: "pending" };
            }
          }
        }

        const notes = note?.trim()
          ? [{ id: newLocalId(), text: note.trim(), date: todayISO(), stage: stageId }, ...c.notes]
          : c.notes;

        const lastContact = date
          ? `${status === "completed" ? "Met" : status === "skipped" ? "Skipped meeting" : "Scheduled"} — ${date}`
          : c.lastContact;

        return { ...c, stages, currentStage, notes, lastContact };
      })
    );
  };

  /**
   * Remembers which Google Calendar event (if any) represents this stage's
   * meeting, so it can be found again later and cancelled — pass `null` to
   * clear it once the event has been deleted.
   */
  const setStageGoogleEventId = (clientId, stageId, googleEventId) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const stages = { ...c.stages };
        const existing = stages[stageId] ?? { data: {}, files: [] };
        stages[stageId] = { ...existing, googleEventId: googleEventId || undefined };
        return { ...c, stages };
      })
    );
  };

  const markContacted = (clientId) => {
    const today = todayISO();
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              lastContactDate: today,
              lastContact: `Logged contact, today`,
              followUpDate: addDays(today, 7),
              nextFollowUp: calcNextFollowUp(addDays(today, 7)),
            }
          : c
      )
    );
  };

  const snooze = (clientId, days = 3) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const newDate = addDays(c.followUpDate || todayISO(), days);
        return { ...c, followUpDate: newDate, nextFollowUp: calcNextFollowUp(newDate) };
      })
    );
  };

  const rescheduleFollowUp = (clientId, newDate) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, followUpDate: newDate, nextFollowUp: calcNextFollowUp(newDate) } : c
      )
    );
  };

  const rescheduleMeeting = (clientId, newDate, time) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, meeting: { ...(c.meeting || {}), date: newDate, time: time || c.meeting?.time } } : c
      )
    );
  };

  const toggleFileStatus = (clientId, fileId) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              files: c.files.map((f) =>
                f.id === fileId ? { ...f, status: f.status === "pending" ? "done" : "pending" } : f
              ),
            }
          : c
      )
    );
  };

  // Done-state is per (client, taskType, day) so My Day can track completion
  // for any selected date, not just today. `dateKey` defaults to today.
  const isTaskDoneToday = (clientId, taskType, dateKey = todayISO()) =>
    Boolean(doneTasks[`${clientId}:${taskType}:${dateKey}`]);

  const toggleDailyTask = (clientId, taskType, dateKey = todayISO()) => {
    const key = `${clientId}:${taskType}:${dateKey}`;
    setDoneTasks((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const importClients = async (rows) => {
    const { created, failedRows, successCount } = mapImportRows(rows, {
      colors: AV_COLORS,
      colorOffset: clients.length,
    });
    const results = { successCount, failedRows };

    if (created.length) {
      const saved = normalize(await api.importClients(created));
      saved.forEach((c) => snapshotRef.current.set(String(c.id), { version: c.version, json: contentJson(c) }));
      setClients((prev) => [...saved, ...prev]);
    }
    return results;
  };

  const getClient = (id) => clients.find((c) => String(c.id) === String(id));

  // ---- client groups (free-form: families, companies, referral circles, whatever) ----
  const GROUP_COLORS = ["av-blue", "av-green", "av-amber", "av-red", "av-purple", "av-teal"];

  const addGroup = (name, color) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const group = {
      id: `g-${newLocalId()}`,
      name: trimmed,
      color: color || GROUP_COLORS[groups.length % GROUP_COLORS.length],
      memberIds: [],
    };
    setGroups((prev) => [...prev, group]);
    return group;
  };

  const updateGroup = (groupId, patch) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  };

  const deleteGroup = (groupId) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const setGroupMembers = (groupId, memberIds) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, memberIds } : g)));
  };

  const toggleClientInGroup = (groupId, clientId) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const has = g.memberIds.some((id) => String(id) === String(clientId));
        return {
          ...g,
          memberIds: has
            ? g.memberIds.filter((id) => String(id) !== String(clientId))
            : [...g.memberIds, clientId],
        };
      })
    );
  };

  const getGroupsForClient = (clientId) =>
    groups.filter((g) => g.memberIds.some((id) => String(id) === String(clientId)));

  const value = useMemo(
    () => ({
      clients,
      loading,
      loadingMore,
      syncError,
      refreshFromServer,
      addClient,
      updateClient,
      editClient,
      deleteClient,
      addNote,
      editNote,
      deleteNote,
      updateStage,
      setStageGoogleEventId,
      markContacted,
      snooze,
      rescheduleFollowUp,
      rescheduleMeeting,
      toggleFileStatus,
      isTaskDoneToday,
      toggleDailyTask,
      importClients,
      getClient,
      groups,
      addGroup,
      updateGroup,
      deleteGroup,
      setGroupMembers,
      toggleClientInGroup,
      getGroupsForClient,
    }),
    [clients, doneTasks, groups, loading, loadingMore, syncError]
  );

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error("useClients must be used within ClientsProvider");
  return ctx;
}
