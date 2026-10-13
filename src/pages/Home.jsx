import { CalendarClock, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import Footer from "../components/Footer";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

// What the product is, in the plain words a visitor, a search engine and a reviewer (Google's OAuth branding check reads this page) need.
// The same sentence is in index.html for anything that does not run scripts, so keep the two in step (a test does).
export const PURPOSE =
  "Finuxia is a client-relationship management (CRM) web application for financial advisors. An advisor uses it to keep client records and notes, move each client through their advisory pipeline, schedule meetings and follow-ups, store client documents, and prepare sales packages.";

const POINTS = [
  { icon: Users, title: "Clients and pipeline", body: "Every client, pipeline stage and follow-up in one place, so nothing falls through the cracks between meetings." },
  { icon: CalendarClock, title: "Meetings and follow-ups", body: "Booking links clients can use to pick a time, and reminders and follow-ups that keep the next step visible." },
  { icon: Sparkles, title: "Help with the busywork", body: "AI-assisted follow-up message drafts, presentation preparation and sales-package preparation, so the advisor spends less time on paperwork." },
  { icon: ShieldCheck, title: "Your data stays yours", body: "Client information belongs to the advisor who entered it. We do not sell it and do not use it for advertising." },
];

/**
 * The public home page (`/`). A signed-out visitor, and any crawler, sees what Finuxia is and where the privacy policy and terms are, with
 * a way to log in or register. A signed-in advisor goes straight to the dashboard, as before.
 */
export default function Home() {
  const { user, initializing } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  // While the session is being restored the page still renders (a crawler must not wait for it); a signed-in advisor is redirected once it is known.
  return (
    <div className="flex min-h-screen flex-col bg-slate-50" data-testid="home" aria-busy={initializing}>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Logo size={24} plain />
          <span className="text-lg font-bold tracking-tight text-navy">
            Fin<span className="text-gold-dark">uxia</span>
          </span>
        </div>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-navy hover:bg-slate-100">
            Log in
          </Link>
          <Link to="/register" className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
            Register
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-14">
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-navy sm:text-4xl">The client-relationship app for financial advisors</h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">{PURPOSE}</p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Icon size={20} className="text-gold-dark" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-navy">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
            </li>
          ))}
        </ul>

        <section aria-labelledby="connected" className="mt-10 max-w-3xl">
          <h2 id="connected" className="text-lg font-semibold text-navy">
            Connected services (optional)
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            An advisor can choose to connect Google Calendar, Google Drive or Zoom. Finuxia uses a connection only for the feature it powers: creating
            the advisor's calendar events, keeping a folder of client files, and creating meeting links. The connection can be removed at any time
            from the advisor's profile, which stops our access. Read how we handle data in our{" "}
            <Link to="/privacy" className="font-semibold text-navy underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link to="/terms" className="font-semibold text-navy underline">
              Terms of Service
            </Link>
            .
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Questions? Email{" "}
            <a href="mailto:info@finuxia.com" className="font-semibold text-navy underline">
              info@finuxia.com
            </a>
            .
          </p>
        </section>
      </main>

      <Footer minimal />
    </div>
  );
}
