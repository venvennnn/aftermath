import type { CompanyProfile, EnterprisePolicy, Plan } from "./types";

export const MERIDIAN: CompanyProfile = {
  name: "Meridian",
  product: "Meridian Support Cloud — tickets, knowledge, voice, and AI agents",
  hq: "Bengaluru",
  arrInr: 48_00_00_000,
  customerCount: 12400,
  csHeadcount: 38,
  plans: {
    basic: { label: "Basic", priceInr: 2499, seats: "3 agents" },
    pro: { label: "Pro", priceInr: 9999, seats: "15 agents" },
    enterprise: { label: "Enterprise", priceInr: 54999, seats: "unlimited" },
  },
};

export function baselinePolicy(
  company: CompanyProfile = MERIDIAN,
  populationSize = 320,
): EnterprisePolicy {
  return {
    pricing: {
      basic: company.plans.basic.priceInr,
      pro: company.plans.pro.priceInr,
      enterprise: company.plans.enterprise.priceInr,
    },
    phoneSupportPlans: ["basic", "pro", "enterprise"],
    refundWindowDays: 30,
    slaHours: { basic: 24, pro: 8, enterprise: 4 },
    maxDiscountPercent: 12,
    financeApprovalThreshold: 12,
    dailyDiscountBudgetInr: 1_80_000,
    aiAgentEnabled: true,
    aiHandlesPlans: ["basic"],
    humanSupportCapacity: Math.max(8, Math.round(populationSize * 0.04)),
    cancellationNoticeDays: 30,
    onboardingFriction: 0.25,
  };
}

export const PLAN_WEIGHTS: Record<Plan, number> = {
  basic: 0.46,
  pro: 0.39,
  enterprise: 0.15,
};
