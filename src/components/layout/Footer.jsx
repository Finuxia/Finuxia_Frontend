import { Link } from "react-router-dom";

/** minimal drops the in-app links (About/Support both require login) — used
 * on pages rendered outside Layout, like the public booking page or the
 * login/register screens, where following one would just bounce to /login.
 * Privacy/Terms are public either way, so they show in both variants. */
export default function Footer({ minimal = false }) {
  return (
    <footer className="mx-auto mt-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-400 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} Finuxia. All rights reserved.</p>
        <div className="flex items-center gap-4">
          {!minimal && (
            <>
              <Link to="/about" className="transition hover:text-navy">
                About
              </Link>
              <Link to="/tickets" className="transition hover:text-navy">
                Support
              </Link>
            </>
          )}
          <Link to="/privacy" className="transition hover:text-navy">
            Privacy
          </Link>
          <Link to="/terms" className="transition hover:text-navy">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
