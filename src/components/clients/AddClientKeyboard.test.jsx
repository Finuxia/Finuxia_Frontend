import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { API } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../../test/utils";
import Layout from "../layout/Layout";
import ProtectedRoute from "../layout/ProtectedRoute";

function Shell() {
  return (
    <Routes>
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<p>dashboard page</p>} />
      </Route>
    </Routes>
  );
}

// TEST-13. These walkthroughs press Tab about sixty times. With user-event's default, every key press waits for a turn of the event loop first, and
// under a full parallel run, where every core is busy, sixty such waits took the first test past its 5-second limit. `delay: null` presses the keys
// without those waits; each press is still a real keydown, focus move and keyup. Nothing is slower or faster to a user: this is the test's own pacing.
let user;
// A walkthrough that has timed out keeps running in the background, and used to go on pressing Tab inside the NEXT test's page, which is why the two
// tests after it failed as well. Each test gets its own generation; a key press from an earlier one stops it instead of reaching this one.
let generation = 0;

beforeEach(() => {
  generation += 1;
  user = userEvent.setup({ delay: null });
});

afterEach(() => {
  generation += 1;
});

function forThisTest() {
  const mine = generation;
  return () => {
    if (mine !== generation) throw new Error("a walkthrough from an earlier test is still running; stopped");
  };
}

// Reaches an element the way a keyboard user does: Tab, Tab, Tab... (or Shift+Tab going back).
async function tabTo(predicate, { limit = 80, shift = false } = {}) {
  const stillMine = forThisTest();
  for (let i = 0; i < limit; i += 1) {
    stillMine();
    if (document.activeElement && predicate(document.activeElement)) return document.activeElement;
    await user.tab({ shift });
  }
  throw new Error("never reached it with the Tab key");
}

describe("keyboard-only walkthrough: creating a client", () => {
  it("open with the keyboard, fill in with the keyboard, save with the keyboard, and land back where you were", async () => {
    let posted = null;
    server.use(
      http.post(`${API}/api/clients`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          {
            ...posted,
            id: "c_new",
            version: 1,
            stages: posted.stages || {},
            notes: posted.notes || [],
            files: [],
            interests: [],
            meeting: null,
          },
          { status: 201 }
        );
      })
    );
    renderWithProviders(<Shell />, { route: "/dashboard" });
    await screen.findByText("dashboard page");

    // 1. Reach the "Add Client" button with Tab alone, and press Enter.
    const addButton = await tabTo((el) => el.tagName === "BUTTON" && /^add client$/i.test(el.textContent.trim()));
    await user.keyboard("{Enter}");

    // 2. A dialog, named, with focus inside it on the first field.
    const dialog = await screen.findByRole("dialog", { name: /add client/i });
    expect(dialog).toContainElement(document.activeElement);
    expect(document.activeElement).toHaveAccessibleName(/first name/i);

    // 3. Type the first name, Tab to the last name, type it.
    await user.keyboard("Grace");
    await user.tab();
    expect(document.activeElement).toHaveAccessibleName(/last name/i);
    await user.keyboard("Hopper");

    // 4. Tab never leaves the dialog: one full lap round its controls and two more, so the press that wraps from the last control back to the first is
    // tested too. (It was 40 presses; each costs a re-render of the whole page, and under a loaded run that was the bulk of the test's time.)
    const stillMine = forThisTest();
    const controls = dialog.querySelectorAll('input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])').length;
    expect(controls).toBeGreaterThan(2);
    for (let i = 0; i < controls + 2; i += 1) {
      stillMine();
      await user.tab();
      expect(dialog).toContainElement(document.activeElement);
    }

    // 5. Submit from a field with Enter (a form submit, no mouse).
    const lastNameField = within(dialog).getByLabelText(/last name/i);
    await tabTo((el) => el === lastNameField, { shift: true });
    await user.keyboard("{Enter}");

    await waitFor(() => expect(posted).not.toBeNull());
    expect(posted).toMatchObject({ first: "Grace", last: "Hopper" });
    expect(posted.clientToken).toEqual(expect.any(String));

    // 6. The dialog is gone and focus is back on the button that opened it; the result is announced.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(addButton).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Grace Hopper added to pipeline");
  });

  it("Escape closes it without saving, and focus goes back to the button", async () => {
    let posts = 0;
    server.use(http.post(`${API}/api/clients`, () => ++posts && HttpResponse.json({}, { status: 201 })));
    renderWithProviders(<Shell />, { route: "/dashboard" });
    await screen.findByText("dashboard page");
    const addButton = await tabTo((el) => el.tagName === "BUTTON" && /^add client$/i.test(el.textContent.trim()));
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog");
    await user.keyboard("Half done");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(addButton).toHaveFocus();
    expect(posts).toBe(0);
  });

  it("a missing first name is announced and nothing is sent", async () => {
    let posts = 0;
    server.use(http.post(`${API}/api/clients`, () => ++posts && HttpResponse.json({}, { status: 201 })));
    renderWithProviders(<Shell />, { route: "/dashboard" });
    await screen.findByText("dashboard page");
    await tabTo((el) => el.tagName === "BUTTON" && /^add client$/i.test(el.textContent.trim()));
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog");
    await user.keyboard("{Enter}"); // submit the empty form
    expect(await screen.findByRole("alert")).toHaveTextContent("First name is required");
    expect(posts).toBe(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
