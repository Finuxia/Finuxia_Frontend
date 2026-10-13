import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import ProtectedRoute from "./ProtectedRoute";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../../test/utils";

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
        <Route path="/clients" element={<p>clients page</p>} />
        <Route path="/groups" element={<p>groups page</p>} />
      </Route>
    </Routes>
  );
}

const render = (route = "/dashboard") => renderWithProviders(<Shell />, { route });
const nav = async () => within(await screen.findByRole("navigation", { name: "Main" }));

describe("navigation dropdowns", () => {
  it("is a menu button: expanded state, popup, and a labelled menu of items", async () => {
    render();
    const trigger = (await nav()).getByRole("button", { name: /^clients$/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = await screen.findByRole("menu", { name: "Clients" });
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent)
    ).toEqual(["All Clients", "Groups", "Follow-ups", "Import"]);
  });

  it("opens with the first item focused, and the arrow keys move through the items, wrapping", async () => {
    render();
    const trigger = (await nav()).getByRole("button", { name: /^clients$/i });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    const items = await screen.findAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(items[items.length - 1]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus(); // wrapped
    await userEvent.keyboard("{ArrowUp}");
    expect(items[items.length - 1]).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(items[0]).toHaveFocus();
  });

  it("ArrowUp on the button opens the menu on its last item", async () => {
    render();
    const trigger = (await nav()).getByRole("button", { name: /^clients$/i });
    trigger.focus();
    await userEvent.keyboard("{ArrowUp}");
    const items = await screen.findAllByRole("menuitem");
    await waitFor(() => expect(items[items.length - 1]).toHaveFocus());
  });

  it("Enter and Space on the button open it", async () => {
    render();
    const trigger = (await nav()).getByRole("button", { name: /^clients$/i });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    trigger.focus();
    await userEvent.keyboard(" ");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  it("Escape closes it and returns focus to the button", async () => {
    render();
    const trigger = (await nav()).getByRole("button", { name: /^clients$/i });
    await userEvent.click(trigger);
    await screen.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Tab closes it; an outside click closes it", async () => {
    render();
    const trigger = (await nav()).getByRole("button", { name: /^clients$/i });
    await userEvent.click(trigger);
    await screen.findByRole("menu");
    await userEvent.keyboard("{Tab}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await userEvent.click(trigger);
    await screen.findByRole("menu");
    await userEvent.click(screen.getByText("dashboard page"));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("choosing an item with the keyboard navigates and closes the menu", async () => {
    render();
    const trigger = (await nav()).getByRole("button", { name: /^clients$/i });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    await screen.findAllByRole("menuitem");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("clients page")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("the account menu", () => {
  it("has an accessible name even though it is only an avatar, and follows the menu pattern", async () => {
    render();
    const trigger = await screen.findByRole("button", { name: "Account menu for Test Advisor" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await userEvent.click(trigger);
    const menu = await screen.findByRole("menu", { name: "Account" });
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Profile", "Plans & Billing", "Log Out"]);
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.keyboard("{ArrowUp}");
    expect(items[2]).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("skip link and landmarks", () => {
  it("is the first thing Tab reaches, and moves focus to the main content", async () => {
    render();
    const skip = await screen.findByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", "#main-content");
    await userEvent.tab();
    expect(skip).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    const main = screen.getByRole("main");
    expect(main).toHaveFocus();
    expect(main).toHaveAttribute("id", "main-content");
  });

  it("the main navigation is a labelled landmark", async () => {
    render();
    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});
