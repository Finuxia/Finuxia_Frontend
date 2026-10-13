/**
 * The loading spinner: full screen while the session is restored or a page outside the layout loads; `inline` inside
 * the layout's content area, so the navigation stays put while a page's code is fetched.
 */
export default function PageSpinner({ inline = false }) {
  return (
    <div role="status" aria-label="Loading" className={`flex items-center justify-center ${inline ? "py-24" : "min-h-screen bg-slate-50"}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
    </div>
  );
}
