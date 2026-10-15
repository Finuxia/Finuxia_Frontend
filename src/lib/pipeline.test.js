import { describe, expect, it } from "vitest";
import {
  FIRST_STAGE_ID,
  LAST_STAGE_ID,
  PIPELINE_STAGES,
  buildStagesForCurrent,
  getMissedStage,
  getNextStageId,
  getStage,
  isLead,
  pipelineProgress,
} from "./pipeline";

describe("pipeline helpers", () => {
  it("looks up stages and advances only when a following stage exists", () => {
    expect(getStage("fc1")).toMatchObject({ id: "fc1", short: "FC1" });
    expect(getStage("unknown")).toBeUndefined();
    expect(getNextStageId(FIRST_STAGE_ID)).toBe("fc1");
    expect(getNextStageId(LAST_STAGE_ID)).toBeNull();
    expect(getNextStageId("unknown")).toBeNull();
  });

  it("builds current, completed, and upcoming states, defaulting an unknown stage to the first", () => {
    expect(buildStagesForCurrent("fc2")).toMatchObject({
      cp: { status: "completed" },
      fc1: { status: "completed" },
      fc2: { status: "pending" },
      fc3: { status: "upcoming" },
    });
    expect(buildStagesForCurrent("missing")[FIRST_STAGE_ID].status).toBe("pending");
    expect(Object.keys(buildStagesForCurrent("missing"))).toHaveLength(PIPELINE_STAGES.length);
  });

  it("calculates progress and distinguishes leads from converted clients", () => {
    expect(pipelineProgress(FIRST_STAGE_ID)).toBe(11);
    expect(pipelineProgress(LAST_STAGE_ID)).toBe(100);
    expect(pipelineProgress("missing")).toBe(11);
    expect(isLead(FIRST_STAGE_ID)).toBe(true);
    expect(isLead(LAST_STAGE_ID)).toBe(false);
  });

  it("reports the first overdue pending meeting unless it has been resolved by contact or status", () => {
    expect(getMissedStage(null, "2026-01-10")).toBeNull();
    expect(getMissedStage({ stages: {} }, "2026-01-10")).toBeNull();
    const client = { stages: { cp: { status: "pending", date: "2026-01-09" }, fc1: { status: "pending", date: "2026-01-08" } } };
    expect(getMissedStage(client, "2026-01-10")).toEqual({ stageId: "cp", label: "CP", date: "2026-01-09" });
    expect(getMissedStage({ stages: { cp: { status: "pending", date: "2026-01-10" } } }, "2026-01-10")).toBeNull();
    expect(getMissedStage({ stages: { cp: { status: "completed", date: "2026-01-09" } } }, "2026-01-10")).toBeNull();
    expect(
      getMissedStage({ stages: { cp: { status: "pending", date: "2026-01-09" } }, lastContactDate: "2026-01-09" }, "2026-01-10")
    ).toBeNull();
  });
});
