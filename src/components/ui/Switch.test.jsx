import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "../../test/utils";
import BookingLinkModal from "../booking/BookingLinkModal";
import ComplianceProfilePanel from "../account/ComplianceProfilePanel";
import FollowUpAutomationPanel from "../clients/FollowUpAutomationPanel";
import FollowUpRuleModal from "../clients/FollowUpRuleModal";
import Switch from "./Switch";
import ClientStep from "../sales-package/ClientStep";

describe("Switch", () => {
  it("is a switch with its own accessible name and reports changes", async () => {
    const onChange = vi.fn();
    render(<Switch label="Allow guests" checked={false} onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Allow guests" });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("can be disabled", () => {
    render(<Switch label="Enabled" checked disabled onChange={() => {}} />);
    expect(screen.getByRole("switch", { name: "Enabled" })).toBeDisabled();
  });

  it("every screen that uses it can be imported (a wrong import path would only show up in the build)", () => {
    for (const component of [BookingLinkModal, ComplianceProfilePanel, FollowUpAutomationPanel, FollowUpRuleModal, ClientStep])
      expect(typeof component).toBe("function");
  });
});
