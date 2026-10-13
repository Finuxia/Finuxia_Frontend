import { describe, expect, it } from "vitest";
import { useAuth } from "../context/AuthContext";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import { renderWithProviders, screen } from "./utils";

describe("renderWithProviders", () => {
  it("provides the whole tree: router, toasts, auth and clients, loading from the mock API", async () => {
    function Probe() {
      const { user } = useAuth();
      const { clients, loading } = useClients();
      const { addToast } = useToast();
      return (
        <p>
          {user ? user.name : "no user"} / {loading ? "loading" : `${clients.length} clients`} / {typeof addToast}
        </p>
      );
    }
    renderWithProviders(<Probe />);
    expect(await screen.findByText("Test Advisor / 0 clients / function")).toBeInTheDocument();
  });
});
