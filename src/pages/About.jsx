import { Link } from "react-router-dom";
import { CalendarClock, Users, Sparkles, ShieldCheck } from "lucide-react";
import Logo from "../components/Logo";

const POINTS = [
  {
    icon: Users,
    title: "Built for financial advisors",
    body: "Finuxia keeps every client, pipeline stage, and follow-up in one place, so nothing falls through the cracks between meetings.",
  },
  {
    icon: CalendarClock,
    title: "Meetings that book themselves",
    body: "Share a booking link, connect your calendar, and let clients pick a time that actually works — confirmations and reminders happen automatically.",
  },
  {
    icon: Sparkles,
    title: "An assistant, not just a tracker",
    body: "AI-drafted follow-up messages, presentation prep, and automated reminders handle the busywork so you can focus on the conversation.",
  },
  {
    icon: ShieldCheck,
    title: "Your data, your relationships",
    body: "Client information stays yours — Finuxia connects to the tools you already use (Google Calendar, Drive, email) instead of locking you into a silo.",
  },
];

export default function About() {
  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-2xl bg-navy px-6 py-10 text-center text-white shadow-lg sm:px-10">
        <div className="mx-auto flex w-fit items-center gap-2">
          <Logo size={28} />
          <span className="text-xl font-bold tracking-tight">
            Fin<span className="text-gold">uxia</span>
          </span>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
          The day-to-day operating system for financial advisors — clients, meetings, and follow-ups, all in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 text-gold-dark">
              <Icon size={18} />
            </div>
            <h2 className="text-sm font-semibold text-navy">{title}</h2>
            <p className="mt-1.5 text-sm text-slate-500">{body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-6 text-center text-sm text-slate-500">
        Questions or feedback? Reach out any time from{" "}
        <Link to="/tickets" className="font-semibold text-gold-dark hover:underline">
          Support
        </Link>
        .
      </div>
    </div>
  );
}
