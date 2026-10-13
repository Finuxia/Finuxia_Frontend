import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../context/ToastContext";
import { api } from "../lib/api";
import useSalesPackageDraft from "./useSalesPackageDraft";

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;
const catalog = { loadProductsFor: () => {}, loadFundsFor: () => {} };

describe("saving a draft with no package yet", () => {
  it("asks the server for nothing and reports that nothing was saved", async () => {
    const save = vi
      .spyOn(api, "saveSalesPackageDraft")
      .mockResolvedValue({ version: 2 });
    const { result } = renderHook(
      () => useSalesPackageDraft({ packageId: null, catalog }),
      { wrapper },
    );
    let outcome;
    await act(async () => {
      outcome = await result.current.saveDraft();
    });
    expect(outcome).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
    save.mockRestore();
  });
});
