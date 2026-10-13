import {
  ClipboardList,
  MessageCircle,
  MessagesSquare,
  Target,
  RefreshCcw,
  CheckCircle2,
  ShieldCheck,
  Star,
} from "lucide-react";

export const PIPELINE_STAGES = [
  { id: "cp", short: "CP", label: "CP", icon: ClipboardList },
  { id: "fc1", short: "FC1", label: "FC1", icon: MessageCircle },
  { id: "fc2", short: "FC2", label: "FC2", icon: MessageCircle },
  { id: "fc3", short: "FC3", label: "FC3", icon: MessagesSquare },
  { id: "strategy_meeting", short: "Strategy", label: "Strategy Meeting", icon: Target },
  { id: "strategy_followup", short: "Strategy FU", label: "Strategy Follow-up", icon: RefreshCcw },
  { id: "closing", short: "Closing", label: "Closing", icon: CheckCircle2 },
  { id: "policy_delivery", short: "Policy Delivery", label: "Policy Delivery", icon: ShieldCheck },
  { id: "client", short: "Client", label: "Client", icon: Star },
];

export const STAGE_INDEX = Object.fromEntries(
  PIPELINE_STAGES.map((s, i) => [s.id, i])
);

export function getStage(stageId) {
  return PIPELINE_STAGES.find((s) => s.id === stageId);
}

export function buildStagesForCurrent(currentStageId) {
  const currentIdx = STAGE_INDEX[currentStageId] ?? 0;
  const stages = {};
  PIPELINE_STAGES.forEach((stage, idx) => {
    let status = "upcoming";
    if (idx < currentIdx) status = "completed";
    else if (idx === currentIdx) status = "pending";
    stages[stage.id] = { status, data: {}, files: [] };
  });
  return stages;
}

export function getNextStageId(stageId) {
  const idx = STAGE_INDEX[stageId];
  if (idx === undefined || idx >= PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[idx + 1].id;
}

export function pipelineProgress(currentStageId) {
  const idx = STAGE_INDEX[currentStageId] ?? 0;
  return Math.round(((idx + 1) / PIPELINE_STAGES.length) * 100);
}

const FIRST_STAGE_ID = PIPELINE_STAGES[0].id;
const LAST_STAGE_ID = PIPELINE_STAGES[PIPELINE_STAGES.length - 1].id;

export function isLead(stageId) {
  return stageId !== LAST_STAGE_ID;
}

/**
 * A stage counts as "missed" when its meeting date has passed and nothing
 * happened — status is still "pending" and the advisor hasn't logged
 * contact since. Resolves itself the moment either becomes true (stage
 * marked completed/skipped, or a fresh markContacted), so this is always
 * live-computed rather than stored.
 */
export function getMissedStage(client, today) {
  if (!client?.stages) return null;
  for (const stage of PIPELINE_STAGES) {
    const s = client.stages[stage.id];
    if (!s || s.status !== "pending" || !s.date) continue;
    if (s.date >= today) continue;
    if (client.lastContactDate && client.lastContactDate >= s.date) continue;
    return { stageId: stage.id, label: stage.label, date: s.date };
  }
  return null;
}

export { FIRST_STAGE_ID, LAST_STAGE_ID };
