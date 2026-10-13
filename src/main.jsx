import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ClientsProvider } from "./context/ClientsContext";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { GoogleCalendarProvider } from "./context/GoogleCalendarContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { initErrorTracking } from "./lib/errorTracking";
import "./index.css";

// Error tracking (OPS-01). Does nothing without VITE_SENTRY_DSN, and loads the SDK as a separate
// chunk when there is one, so a build with no DSN carries none of its weight.
//
// Not awaited: rendering must not wait on it. Errors thrown in the window before the reporter is
// installed are buffered by src/lib/errorReporting.js and flushed once it arrives, so an error in
// the first render is still reported. The promise is handled rather than left dangling, but
// initErrorTracking already swallows its own failures.
initErrorTracking().catch(() => {});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary variant="app">
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <GoogleCalendarProvider>
              <ClientsProvider>
                <App />
              </ClientsProvider>
            </GoogleCalendarProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
