import { describe, expect, it } from "vitest";
import { getStageStatusMeta, STAGE_STATUS_META } from "./stageStatus";

describe("stage status metadata", () => {
  it.each(Object.entries(STAGE_STATUS_META))("returns the %s status metadata", (status, meta) => {
    expect(getStageStatusMeta(status)).toBe(meta);
  });
  it("uses the not-scheduled appearance for unknown statuses", () => {
    expect(getStageStatusMeta("unknown")).toBe(STAGE_STATUS_META.upcoming);
  });
});
