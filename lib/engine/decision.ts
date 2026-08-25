import type { DecisionType, EnterprisePolicy, ParsedDecision, Plan } from "./types";

const PLANS: Plan[] = ["basic", "pro", "enterprise"];

function extractPercent(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function extractPlans(text: string): Plan[] {
  if (/\bnon[- ]?enterprise\b/.test(text)) return ["basic", "pro"];
  const found = PLANS.filter((plan) => new RegExp(`\\b${plan}\\b`).test(text));
  if (found.length) return found;
  return ["pro"];
}

function extractDays(text: string): number | null {
  const match = text.match(/(\d+)\s*-?\s*day/);
  return match ? Number(match[1]) : null;
}

function extractHours(text: string): number | null {
  const toMatch = text.match(/to\s+(\d+)\s*-?\s*hour/);
  if (toMatch) return Number(toMatch[1]);
  const match = text.match(/(\d+)\s*-?\s*hour/g);
  if (!match) return null;
  const last = match[match.length - 1]?.match(/(\d+)/);
  return last ? Number(last[1]) : null;
}

export function parseDecisionHeuristic(
  raw: string,
  horizonDays = 30,
): ParsedDecision {
  const text = raw.toLowerCase();
  const affectedPlans = extractPlans(text);
  const percent = extractPercent(text) ?? 0;

  const isPrice =
    /price|pricing|plan cost|subscription|increase the pro|raise .*plan/.test(text) &&
    /increase|raise|hike|decrease|cut|drop|reduce|discount|%\b/.test(text);
  const isPhone = /phone support|voice support|call support|remove phone|no phone/.test(text);
  const isRefund = /refund/.test(text);
  const isSla = /\bsla\b|response time|resolution time/.test(text);
  const isAi = /ai (support )?agent|automation|bot|freddy|assist agent/.test(text);
  const isCapacity = /capacity|headcount|reduce .*support|cut .*support|fewer agents/.test(text);
  const isCancel = /cancel|cancellation|notice period|lock-in|lock in/.test(text);
  const isOnboarding = /onboarding|signup flow|sign-up|activation/.test(text);

  let type: DecisionType = "other";
  if (isPrice) type = "pricing";
  else if (isPhone) type = "support_channel";
  else if (isRefund) type = "refund_policy";
  else if (isSla) type = "sla";
  else if (isAi) type = "ai_agent";
  else if (isCapacity) type = "capacity";
  else if (isCancel) type = "cancellation";
  else if (isOnboarding) type = "onboarding";

  const decrease = /decrease|cut|drop|reduce|lower/.test(text);
  const priceChangePercent =
    type === "pricing" ? (decrease ? -Math.abs(percent || 10) : Math.abs(percent || 18)) : 0;

  const humanCapacityDeltaPercent = isCapacity || (isAi && /40|cut|reduc/.test(text))
    ? -(extractPercent(text) || 40)
    : isAi
      ? -15
      : 0;

  const notes: string[] = [];
  if (type === "pricing") {
    notes.push(
      `${priceChangePercent >= 0 ? "Increase" : "Decrease"} ${affectedPlans.join("/")} price by ${Math.abs(priceChangePercent)}%.`,
    );
  }
  if (isPhone) notes.push("Remove phone support for affected plans.");
  if (isAi) notes.push("Route more tickets through the AI support agent.");
  if (humanCapacityDeltaPercent) {
    notes.push(`Human support capacity ${humanCapacityDeltaPercent}%.`);
  }

  const summary = notes.length ? notes.join(" ") : raw.trim();

  return {
    raw,
    type,
    summary,
    startDay: 1,
    horizonDays,
    affectedPlans: isPhone && !text.includes("pro") && !text.includes("enterprise") && !text.includes("basic")
      ? ["basic"]
      : type === "pricing" && !text.includes("basic") && !text.includes("enterprise")
        ? ["pro"]
        : affectedPlans,
    priceChangePercent,
    removePhoneSupport: isPhone,
    refundWindowDays: isRefund ? extractDays(text) ?? 7 : null,
    slaHours: isSla ? extractHours(text) ?? 24 : null,
    launchAiAgent: isAi,
    humanCapacityDeltaPercent,
    cancellationNoticeDays: isCancel ? extractDays(text) ?? 90 : null,
    onboardingFrictionDelta: isOnboarding ? 0.35 : 0,
    notes,
  };
}

export function applyDecisionToPolicy(
  baseline: EnterprisePolicy,
  decision: ParsedDecision,
): EnterprisePolicy {
  const policy = structuredClone(baseline);
  for (const plan of decision.affectedPlans) {
    if (decision.priceChangePercent) {
      policy.pricing[plan] = Math.round(
        policy.pricing[plan] * (1 + decision.priceChangePercent / 100),
      );
    }
    if (decision.slaHours != null) {
      policy.slaHours[plan] = decision.slaHours;
    }
  }
  if (decision.removePhoneSupport) {
    policy.phoneSupportPlans = policy.phoneSupportPlans.filter(
      (plan) => !decision.affectedPlans.includes(plan),
    );
  }
  if (decision.refundWindowDays != null) {
    policy.refundWindowDays = decision.refundWindowDays;
  }
  if (decision.launchAiAgent) {
    policy.aiAgentEnabled = true;
    policy.aiHandlesPlans = Array.from(
      new Set([...policy.aiHandlesPlans, ...decision.affectedPlans, "basic", "pro"]),
    ) as Plan[];
  }
  if (decision.humanCapacityDeltaPercent) {
    policy.humanSupportCapacity = Math.max(
      8,
      Math.round(policy.humanSupportCapacity * (1 + decision.humanCapacityDeltaPercent / 100)),
    );
  }
  if (decision.cancellationNoticeDays != null) {
    policy.cancellationNoticeDays = decision.cancellationNoticeDays;
  }
  if (decision.onboardingFrictionDelta) {
    policy.onboardingFriction = Math.min(1, policy.onboardingFriction + decision.onboardingFrictionDelta);
  }
  return policy;
}

export const SCENARIOS = [
  {
    id: "pro-18",
    label: "Price the future",
    decision: "Increase the Pro plan price by 18%.",
  },
  {
    id: "phone-basic",
    label: "Silence the line",
    decision: "Remove phone support for Basic customers starting next month.",
  },
  {
    id: "ai-cut",
    label: "Replace the floor",
    decision: "Launch a new AI support agent and reduce human support capacity by 40%.",
  },
  {
    id: "refund-7",
    label: "Close the window",
    decision: "Change the refund policy from 30 days to 7 days.",
  },
  {
    id: "sla-24",
    label: "Stretch the SLA",
    decision: "Change the non-enterprise SLA from 4 hours to 24 hours.",
  },
] as const;
