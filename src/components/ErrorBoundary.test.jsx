import { useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setErrorReporter } from "../lib/errorReporting";
import Layout from "./Layout";
import ProtectedRoute from "./ProtectedRoute";
import { render, renderWithProviders, screen, userEvent, waitFor, within } from "../test/utils";
import ErrorBoundary from "./ErrorBoundary";
import RouteErrorBoundary from "./RouteErrorBoundary";

function Boom({ message = "kaboom" }) {
  throw new Error(message);
}

const reporter = vi.fn();

beforeEach(() => {
  reporter.mockReset();
  setErrorReporter(reporter);
  vi.spyOn(console, "error").mockImplementation(() => {}); // React logs every caught render error
});

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all fine</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("all fine")).toBeInTheDocument();
    expect(reporter).not.toHaveBeenCalled();
  });

  it("shows the recovery screen: a message, Reload, and a link back to the dashboard", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("Reload reloads the page", async () => {
    const reload = vi.fn();
    vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload, pathname: "/x" });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reports the caught error once, with the component stack, the boundary and the route", () => {
    render(
      <ErrorBoundary variant="route">
        <Boom message="bad null" />
      </ErrorBoundary>
    );
    expect(reporter).toHaveBeenCalledTimes(1);
    const [error, context] = reporter.mock.calls[0];
    expect(error.message).toBe("bad null");
    expect(context.boundary).toBe("route");
    expect(context.componentStack).toContain("Boom");
    expect(context.errorId).toEqual(expect.any(String));
  });

  it("shows the error detail in development and hides it in production, where only a reference is shown", () => {
    const { unmount } = render(
      <ErrorBoundary showDetail>
        <Boom message="secret internals" />
      </ErrorBoundary>
    );
    expect(screen.getByText(/secret internals/)).toBeInTheDocument();
    unmount();
    render(
      <ErrorBoundary showDetail={false}>
        <Boom message="secret internals" />
      </ErrorBoundary>
    );
    expect(screen.queryByText(/secret internals/)).not.toBeInTheDocument();
    expect(screen.getByText(/Reference: /)).toBeInTheDocument();
  });

  it("detail follows the build mode by default: shown in development, hidden in a production build", () => {
    const { unmount } = render(
      <ErrorBoundary>
        <Boom message="visible in dev" />
      </ErrorBoundary>
    );
    expect(screen.getByText(/visible in dev/)).toBeInTheDocument();
    unmount();
    vi.stubEnv("DEV", false);
    render(
      <ErrorBoundary>
        <Boom message="hidden in prod" />
      </ErrorBoundary>
    );
    expect(screen.queryByText(/hidden in prod/)).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it("the shown reference is the id the reporter received, so support can find the error", () => {
    render(
      <ErrorBoundary showDetail={false}>
        <Boom />
      </ErrorBoundary>
    );
    const id = reporter.mock.calls[0][1].errorId;
    expect(screen.getByText(`Reference: ${id}`)).toBeInTheDocument();
  });

  it("cannot itself throw: a failing reporter is swallowed and the recovery screen still shows", () => {
    setErrorReporter(() => {
      throw new Error("tracker is down");
    });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("needs no providers at all: it renders with no router and no context", () => {
    // render() here is plain Testing Library: no router, no auth, no toasts around it.
    expect(() =>
      render(
        <ErrorBoundary variant="app">
          <Boom />
        </ErrorBoundary>
      )
    ).not.toThrow();
  });

  it("an error inside the fallback's own surroundings does not loop: sibling boundaries are independent", () => {
    render(
      <>
        <ErrorBoundary variant="route">
          <Boom message="first" />
        </ErrorBoundary>
        <ErrorBoundary variant="route">
          <p>second is fine</p>
        </ErrorBoundary>
      </>
    );
    expect(screen.getByText("second is fine")).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("Try again clears the error and renders the page again", async () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error("once");
      return <p>recovered</p>;
    }
    render(
      <ErrorBoundary variant="route">
        <Flaky />
      </ErrorBoundary>
    );
    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("recovered")).toBeInTheDocument();
  });
});

describe("in the application's layout", () => {
  function Routes_() {
    return (
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/boom" element={<Boom />} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
          <Route path="/my-day" element={<p>my day page</p>} />
        </Route>
      </Routes>
    );
  }

  it("a page that throws shows the fallback inside the layout and navigation still works", async () => {
    renderWithProviders(<Routes_ />, { route: "/boom" });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // The navigation bar is still there, and still works:
    const nav = within(screen.getByRole("navigation")).getByRole("link", { name: /my day/i });
    expect(nav).toBeInTheDocument();
    await userEvent.click(nav);
    expect(await screen.findByText("my day page")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("leaving a broken page and coming back tries it afresh", async () => {
    let broken = true;
    function Page() {
      if (broken) throw new Error("page failed");
      return <p>page works now</p>;
    }
    renderWithProviders(
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/flaky" element={<Page />} />
          <Route path="/dashboard" element={<p>dashboard page</p>} />
        </Route>
      </Routes>,
      { route: "/flaky" }
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    broken = false;
    await userEvent.click(within(screen.getByRole("navigation")).getByRole("link", { name: /^dashboard$/i }));
    expect(await screen.findByText("dashboard page")).toBeInTheDocument();
  });
});

describe("the application root", () => {
  it("wraps the whole provider tree in the top-level boundary", async () => {
    const { readFileSync } = await import("node:fs");
    const main = readFileSync("src/main.jsx", "utf8"); // vitest runs from the project root
    const boundary = main.indexOf("<ErrorBoundary");
    expect(boundary).toBeGreaterThan(-1);
    expect(boundary).toBeLessThan(main.indexOf("<BrowserRouter"));
    expect(main.lastIndexOf("</ErrorBoundary>")).toBeGreaterThan(main.indexOf("</BrowserRouter>"));
  });
});

describe("RouteErrorBoundary", () => {
  it("clears a caught error when the path changes", async () => {
    function Page({ ok }) {
      if (!ok) throw new Error("nope");
      return <p>fine</p>;
    }
    function Harness() {
      const [ok, setOk] = useState(false);
      return (
        <>
          <Link to="/b" onClick={() => setOk(true)}>go to b</Link>
          <Routes>
            <Route path="/a" element={<RouteErrorBoundary><Page ok={ok} /></RouteErrorBoundary>} />
            <Route path="/b" element={<RouteErrorBoundary><Page ok={ok} /></RouteErrorBoundary>} />
          </Routes>
        </>
      );
    }
    renderWithProviders(<Harness />, { route: "/a", providers: ["router"] });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByText("go to b"));
    await waitFor(() => expect(screen.getByText("fine")).toBeInTheDocument());
  });
});
