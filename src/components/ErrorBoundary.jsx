import { Component } from "react";
import { newErrorId, reportError } from "../lib/errorReporting";

/**
 * Catches an error thrown while rendering anything below it and shows a recovery screen instead of a blank page.
 *
 *   - `variant="app"`   the whole screen (used once, around everything in main.jsx)
 *   - `variant="route"` inside the layout's main area, so one broken page leaves the navigation working
 *
 * `resetKey`: when it changes (the route's path), a caught error is cleared, so navigating to another page works.
 * `showDetail`: the error text and stack; on in development, off in production (defaults to `import.meta.env.DEV`).
 *
 * This component must not throw, so it uses no hooks, no context and no router components: plain markup, plain
 * `<a href>` links and a reload button. A recovery screen that depends on the very state that just failed is no recovery.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, errorId: null };

  static getDerivedStateFromError(error) {
    return { error, errorId: newErrorId() };
  }

  componentDidCatch(error, info) {
    reportError(error, {
      errorId: this.state.errorId,
      componentStack: info?.componentStack,
      boundary: this.props.variant || "app",
      route: typeof window !== "undefined" ? window.location?.pathname : undefined,
    });
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, errorId: null });
    }
  }

  reset = () => this.setState({ error: null, errorId: null });

  render() {
    const { error, errorId } = this.state;
    if (!error) return this.props.children;

    const route = this.props.variant === "route";
    const showDetail = this.props.showDetail ?? import.meta.env.DEV;
    return (
      <div role="alert" className={route ? "py-16" : "flex min-h-screen items-center justify-center bg-slate-50 px-4"}>
        <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">
            {route
              ? "This page hit an unexpected problem. The rest of the app is still working."
              : "The app hit an unexpected problem. Reloading usually fixes it, and your data is safe."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy hover:bg-gold-light"
            >
              Reload
            </button>
            {route && (
              <button
                type="button"
                onClick={this.reset}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Try again
              </button>
            )}
            <a href="/dashboard" className="text-sm font-semibold text-slate-700 underline">
              Back to the dashboard
            </a>
          </div>
          {showDetail ? (
            <pre className="mt-6 max-h-64 overflow-auto rounded bg-slate-100 p-3 text-left text-xs text-slate-700">
              {String(error?.stack || error?.message || error)}
            </pre>
          ) : (
            <p className="mt-6 text-xs text-slate-400">Reference: {errorId}</p>
          )}
        </div>
      </div>
    );
  }
}
