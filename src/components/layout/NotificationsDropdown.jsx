import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useClients } from "../../context/ClientsContext";
import { buildNotifications } from "../../lib/notifications";
import { api, isIncompleteList } from "../../lib/api";
import { writeLocal } from "../../lib/localData";
import IncompleteListNotice from "../IncompleteListNotice";

const SEEN_KEY = "advisorpilot.seenNotifications";

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveSeen(set) {
  writeLocal(SEEN_KEY, [...set]);
}

export default function NotificationsDropdown() {
  const { clients } = useClients();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(loadSeen);
  const [reminders, setReminders] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [incomplete, setIncomplete] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getReminders()
      .then((list) => {
        if (isIncompleteList(list)) setIncomplete(true);
        setReminders(list);
      })
      .catch(() => {});
    api
      .getBookingRequests()
      .then((list) => {
        if (isIncompleteList(list)) setIncomplete(true);
        setBookingRequests(list);
      })
      .catch(() => {});
  }, []);

  const notifications = useMemo(() => buildNotifications(clients, reminders, bookingRequests), [clients, reminders, bookingRequests]);
  // The badge counts only notifications the user hasn't seen yet, so opening
  // the panel (or acting on one) makes the number go down.
  const unseenCount = useMemo(() => notifications.filter((n) => !seen.has(n.id)).length, [notifications, seen]);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markSeen = (ids) => {
    setSeen((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveSeen(next);
      return next;
    });
  };
  const markAllSeen = () => markSeen(notifications.map((n) => n.id));

  // Opening the panel no longer marks anything as read: the badge stays until the person reads a notification or chooses "Mark all as read".
  const toggleOpen = () => setOpen((o) => !o);

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
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notifications</p>
            <button
              type="button"
              onClick={markAllSeen}
              disabled={unseenCount === 0}
              className="text-xs font-medium text-av-blue transition hover:underline disabled:cursor-default disabled:text-slate-300 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          {incomplete && <IncompleteListNotice what="reminders or booking requests" className="mb-1" />}
          {notifications.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-400">You're all caught up.</p>
          ) : (
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              {notifications.map((n) => {
                const read = seen.has(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markSeen([n.id]);
                      setOpen(false);
                      navigate(n.href);
                    }}
                    className={`flex items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      read ? "text-slate-400" : "font-medium text-slate-700"
                    }`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.dot} ${read ? "opacity-30" : ""}`} />
                    {n.text}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
