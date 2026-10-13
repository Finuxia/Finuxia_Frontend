import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { ClientsProvider } from "../context/ClientsContext";
import { GoogleCalendarProvider } from "../context/GoogleCalendarContext";
import { ToastProvider } from "../context/ToastContext";

/**
 * Renders `ui` inside the application's provider tree (the same order as main.jsx), so an individual test
 * never has to assemble it: router, toasts, auth, Google Calendar, clients. Network calls go to the mock server (src/test/server.js).
 *
 *   renderWithProviders(<Dashboard />, { route: "/dashboard" })
 *
 * Pass `providers: ["router", "toast"]` to leave out the heavier ones (auth, calendar, clients) for a lightweight test.
 */
export function renderWithProviders(ui, { route = "/", providers = ["router", "toast", "auth", "calendar", "clients"], ...options } = {}) {
  const has = (name) => providers.includes(name);
  function Wrapper({ children }) {
    let tree = children;
    if (has("clients")) tree = <ClientsProvider>{tree}</ClientsProvider>;
    if (has("calendar")) tree = <GoogleCalendarProvider>{tree}</GoogleCalendarProvider>;
    if (has("auth")) tree = <AuthProvider>{tree}</AuthProvider>;
    if (has("toast")) tree = <ToastProvider>{tree}</ToastProvider>;
    if (has("router")) tree = <MemoryRouter initialEntries={[route]}>{tree}</MemoryRouter>;
    return tree;
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
