import { applyDecisionToPolicy } from "./decision";
import type { EnterprisePolicy, ParsedDecision } from "./types";

export interface CounterfactualSpec {
  id: string;
  label: string;
  description: string;
  decision: ParsedDecision;
}

export function counterfactualsFor(decision: ParsedDecision): CounterfactualSpec[] {
  const milder: ParsedDecision = {
    ...decision,
    summary: "A softer version of the same decision",
    priceChangePercent: decision.priceChangePercent ? Math.round(decision.priceChangePercent * 0.55) : 0,
    humanCapacityDeltaPercent: decision.humanCapacityDeltaPercent
      ? Math.round(decision.humanCapacityDeltaPercent * 0.5)
      : 0,
    refundWindowDays:
      decision.refundWindowDays != null ? Math.max(decision.refundWindowDays, 14) : null,
    slaHours: decision.slaHours != null ? Math.min(decision.slaHours, 12) : null,
    removePhoneSupport: false,
    cancellationNoticeDays:
      decision.cancellationNoticeDays != null
        ? Math.min(decision.cancellationNoticeDays, 45)
        : null,
  };

  const mitigated: ParsedDecision = {
    ...decision,
    summary: "The original decision plus a loyalty save band",
    notes: [...decision.notes, "Pre-approve 10% loyalty holds for tenure > 18 months."],
  };

  return [
    {
      id: "universe_b",
      label: "Universe B — milder",
      description: milderDescription(decision),
      decision: milder,
    },
    {
      id: "universe_c",
      label: "Universe C — original + loyalty band",
      description: "Same shock, but retention may grant 10% without finance review for loyal accounts.",
      decision: mitigated,
    },
  ].map((spec) => spec);
}

export function mitigatedPolicy(
  baseline: EnterprisePolicy,
  decision: ParsedDecision,
): EnterprisePolicy {
  const policy = applyDecisionToPolicy(baseline, decision);
  policy.maxDiscountPercent = Math.max(policy.maxDiscountPercent, 16);
  policy.financeApprovalThreshold = Math.max(policy.financeApprovalThreshold, 16);
  policy.dailyDiscountBudgetInr = Math.round(policy.dailyDiscountBudgetInr * 1.6);
  return policy;
}

function milderDescription(decision: ParsedDecision): string {
  if (decision.type === "pricing") {
    return `+${Math.round(Math.abs(decision.priceChangePercent) * 0.55)}% instead of +${Math.abs(decision.priceChangePercent)}%.`;
  }
  if (decision.type === "support_channel") {
    return "Keep phone support; add a callback SLA instead of removing the line.";
  }
  if (decision.type === "ai_agent") {
    return "Launch Assist, but cut human capacity by half as much.";
  }
  if (decision.type === "refund_policy") {
    return "Move to a 14-day window rather than 7.";
  }
  return "A reduced-intensity version of the same change.";
}
