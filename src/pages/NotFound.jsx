import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Shown for any address the app does not have a page for, signed in or not (it is never bounced to login). */
export default function NotFound() {
  const { user, initializing } = useAuth();
  const home = user ? "/dashboard" : "/login";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <p className="text-5xl font-bold text-gold-dark">404</p>
      <h1 className="text-xl font-semibold text-navy">We can't find that page</h1>
      <p className="max-w-sm text-sm text-slate-500">The address may be mistyped, or the page may have moved.</p>
      {!initializing && (
        <Link to={home} className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-light">
          {user ? "Back to the dashboard" : "Go to the login page"}
        </Link>
      )}
    </div>
  );
}
