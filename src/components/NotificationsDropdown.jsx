import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { buildNotifications } from "../lib/notifications";
import { api } from "../lib/api";

const SEEN_KEY = "advisorpilot.seenNotifications";

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSeen(set) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export default function NotificationsDropdown() {
  const { clients } = useClients();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(loadSeen);
  const [reminders, setReminders] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getReminders().then(setReminders).catch(() => {});
    api.getBookingRequests().then(setBookingRequests).catch(() => {});
  }, []);

  const notifications = useMemo(
    () => buildNotifications(clients, reminders, bookingRequests),
    [clients, reminders, bookingRequests]
  );
  // The badge counts only notifications the user hasn't seen yet, so opening
  // the panel (or acting on one) makes the number go down.
  const unseenCount = useMemo(
    () => notifications.filter((n) => !seen.has(n.id)).length,
    [notifications, seen]
  );

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAllSeen = () => {
    setSeen((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveSeen(next);
      return next;
    });
  };

  const toggleOpen = () => {
    setOpen((o) => {
      // Opening the panel clears the badge (marks everything as seen).
      if (!o) markAllSeen();
      return !o;
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        <Bell size={18} />
        {unseenCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-av-red px-1 text-[10px] font-bold text-white">
            {unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 animate-fade-in rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Notifications</p>
          {notifications.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-400">You're all caught up.</p>
          ) : (
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(n.href);
                  }}
                  className="flex items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.dot}`} />
                  {n.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
