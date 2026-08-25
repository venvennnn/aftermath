import { applyDecisionToPolicy } from "./decision";
import { clamp, hashFloat } from "./rng";
import type {
  Actor,
  Customer,
  DailySnapshot,
  EnterprisePolicy,
  ParsedDecision,
  Plan,
  SimEvent,
  Ticket,
  UniverseMetrics,
  UniverseSummary,
} from "./types";

interface World {
  id: string;
  label: string;
  description: string;
  policy: EnterprisePolicy;
  customers: Customer[];
  events: SimEvent[];
  tickets: Ticket[];
  daily: DailySnapshot[];
  discountSpentToday: number;
  financeRejections: number;
  aiMishandles: number;
  phoneAttemptsBlocked: number;
  policyConflicts: number;
  eventSeq: number;
}

function event(
  world: World,
  day: number,
  customer: Customer,
  actor: Actor,
  kind: string,
  title: string,
  detail: string,
  severity: SimEvent["severity"] = "info",
  extra: Partial<SimEvent> = {},
) {
  world.eventSeq += 1;
  world.events.push({
    id: `${world.id}_e${world.eventSeq}`,
    day,
    actor,
    customerId: customer.id,
    kind,
    title,
    detail,
    severity,
    ...extra,
  });
}

function decisionShock(customer: Customer, decision: ParsedDecision, policy: EnterprisePolicy, baseline: EnterprisePolicy): number {
  let shock = 0;
  if (decision.affectedPlans.includes(customer.plan) || decision.affectedPlans.includes(customer.originalPlan)) {
    if (decision.priceChangePercent) {
      const delta = policy.pricing[customer.originalPlan] / baseline.pricing[customer.originalPlan] - 1;
      shock += Math.max(0, delta) * (0.85 + customer.priceSensitivity) * (1.15 - customer.willingnessToPay);
    }
    if (decision.removePhoneSupport && customer.usesPhoneSupport) {
      shock += 0.34 + (customer.prefersHuman ? 0.16 : 0);
    }
    if (decision.refundWindowDays != null && decision.refundWindowDays < 30) {
      shock += 0.18 * customer.priceSensitivity;
    }
    if (decision.slaHours != null) {
      const before = baseline.slaHours[customer.plan];
      if (decision.slaHours > before) shock += 0.12 + (customer.plan === "enterprise" ? 0.16 : 0.06);
    }
    if (decision.launchAiAgent && customer.prefersHuman) shock += 0.14;
    if (decision.humanCapacityDeltaPercent < 0) shock += Math.abs(decision.humanCapacityDeltaPercent) / 220;
    if (decision.cancellationNoticeDays != null && decision.cancellationNoticeDays > 30) {
      shock += 0.22;
    }
    if (decision.onboardingFrictionDelta) shock += decision.onboardingFrictionDelta * 0.4;
  }
  return shock;
}

function topicFor(customer: Customer, decision: ParsedDecision, day: number): string {
  if (decision.affectedPlans.length === 0) {
    return hashFloat(customer.seed, day, "topic") < 0.35 ? "billing" : "product_issue";
  }
  if (decision.type === "pricing") return "pricing_change";
  if (decision.type === "support_channel") return "phone_support_removed";
  if (decision.type === "refund_policy") return "refund_window";
  if (decision.type === "sla") return "sla_miss";
  if (decision.type === "ai_agent") return "ai_mishandle";
  if (decision.type === "cancellation") return "cancellation_rules";
  if (hashFloat(customer.seed, day, "topic") < 0.35) return "billing";
  return "product_issue";
}

function handleTicket(
  world: World,
  customer: Customer,
  day: number,
  decision: ParsedDecision,
  ticketsToday: number,
  queueStress: number,
): void {
  const overload = Math.max(
    ticketsToday / Math.max(8, world.policy.humanSupportCapacity),
    queueStress,
  );
  const topic = topicFor(customer, decision, day);
  const wantsPhone = customer.usesPhoneSupport && hashFloat(customer.seed, day, "chan") < 0.55;
  let channel: Ticket["channel"] = wantsPhone ? "phone" : hashFloat(customer.seed, day, "chat") < 0.5 ? "chat" : "email";

  if (wantsPhone && !world.policy.phoneSupportPlans.includes(customer.plan)) {
    world.phoneAttemptsBlocked += 1;
    customer.frustration = clamp(customer.frustration + 0.14);
    customer.nps -= 6;
    channel = "chat";
    event(
      world,
      day,
      customer,
      "policy",
      "phone_blocked",
      "Phone support refused",
      `${customer.name} from ${customer.company} tried to call. ${customer.plan} plans no longer have a phone queue.`,
      "warn",
      { tool: "freshworks.phone.route" },
    );
  }

  const aiEligible =
    world.policy.aiAgentEnabled &&
    (world.policy.aiHandlesPlans.includes(customer.plan) || overload > 1.05);

  let handler: Actor = "support";
  let quality = 0.78 - Math.max(0, overload - 0.7) * 0.28;
  if (customer.plan === "enterprise") quality += 0.08;
  if (customer.originalPlan === "enterprise" && overload > 0.75) quality -= 0.3;

  if (aiEligible && (customer.plan !== "enterprise" || overload > 1.2)) {
    handler = "ai_agent";
    quality = 0.7;
    if (topic === "pricing_change" || topic === "cancellation_rules" || topic === "refund_window") {
      quality -= 0.28 + customer.technicalKnowledge * 0.12;
    }
    if (customer.plan === "enterprise" || customer.clv > 8_00_000) {
      quality -= 0.18;
    }
    event(
      world,
      day,
      customer,
      "ai_agent",
      "ai_reply",
      "Meridian Assist drafted a reply",
      handlerQualityLine(topic, quality, customer),
      quality < 0.45 ? "warn" : "info",
      { tool: "freshworks.ai.actions.reply" },
    );
    if (quality < 0.45) world.aiMishandles += 1;
  } else {
    event(
      world,
      day,
      customer,
      "support",
      "human_reply",
      overload > 1 ? "Human queue is saturated" : "Human agent replied",
      overload > 1
        ? `SLA pressure is high. ${customer.company} waited in a ${Math.round(world.policy.slaHours[customer.plan] * (1 + overload))}h implied queue.`
        : `Knowledge agent pulled the ${topic.replaceAll("_", " ")} article.`,
      overload > 1 ? "warn" : "info",
      { tool: "freshworks.ticket.reply" },
    );
  }

  const ticket: Ticket = {
    id: `${world.id}_t${world.tickets.length + 1}`,
    day,
    customerId: customer.id,
    topic,
    channel,
    resolved: quality >= 0.5,
    quality,
    escalated: false,
    handler,
  };

  customer.ticketsOpened += 1;
  customer.frustration = clamp(customer.frustration + (0.55 - quality) * 0.22);
  customer.nps += quality > 0.65 ? 1 : -4;

  if (quality < 0.48 || customer.plan === "enterprise" && quality < 0.62 || customer.frustration > 0.55) {
    ticket.escalated = true;
    customer.escalations += 1;
    customer.status = customer.status === "churned" ? "churned" : "escalated";
    event(
      world,
      day,
      customer,
      "escalation",
      "escalate",
      "Escalation opened",
      `${customer.title} at ${customer.company} was moved to the enterprise queue after a ${handler.replace("_", " ")} miss.`,
      "warn",
      { tool: "freshworks.ticket.escalate" },
    );
    maybeRetain(
      world,
      customer,
      day,
      topic === "pricing_change" ||
        topic === "phone_support_removed" ||
        topic === "refund_window" ||
        topic === "sla_miss" ||
        topic === "ai_mishandle" ||
        topic === "cancellation_rules",
    );
  } else if (ticket.resolved) {
    customer.frustration = clamp(customer.frustration - 0.06);
  }

  world.tickets.push(ticket);
}

function handlerQualityLine(topic: string, quality: number, customer: Customer): string {
  if (quality < 0.42 && topic === "pricing_change") {
    return `Assist quoted the old ${customer.plan} price and claimed grandfathering that finance never approved.`;
  }
  if (quality < 0.45) {
    return `The agent answered a ${topic.replaceAll("_", " ")} question with a generic knowledge-base snippet.`;
  }
  return `Assist resolved a ${topic.replaceAll("_", " ")} question for ${customer.company}.`;
}

function maybeRetain(world: World, customer: Customer, day: number, decisionRelated: boolean): void {
  if (!customer.alive) return;
  const shouldOffer =
    (decisionRelated || customer.frustration > 0.48) &&
    (customer.clv > 1_20_000 || customer.plan === "enterprise" || customer.tenureMonths > 18);
  if (!shouldOffer || hashFloat(customer.seed, day, "retain") < 0.22) return;

  customer.status = "negotiating";
  const asked = customer.plan === "enterprise" ? 22 : 16 + Math.round(customer.priceSensitivity * 10);
  event(
    world,
    day,
    customer,
    "retention",
    "discount_offer",
    "Retention offered a save",
    `Retention proposed ${asked}% off for 12 months to keep ${customer.company}.`,
    "warn",
    { tool: "freshworks.ai.actions.offer_discount", amountInr: Math.round(customer.monthlySpend * (asked / 100) * 12) },
  );

  if (asked > world.policy.financeApprovalThreshold) {
    const budgetLeft = world.policy.dailyDiscountBudgetInr - world.discountSpentToday;
    const annualCost = customer.monthlySpend * (asked / 100) * 12;
    const reject =
      asked > world.policy.maxDiscountPercent + 8 ||
      budgetLeft < annualCost / 12 ||
      (customer.tenureMonths < 8 && asked > 15);

    if (reject) {
      world.financeRejections += 1;
      world.policyConflicts += 1;
      customer.frustration = clamp(customer.frustration + 0.22);
      customer.nps -= 9;
      event(
        world,
        day,
        customer,
        "finance",
        "finance_reject",
        "Finance rejected the save",
        `The ${asked}% discount violated finance policy (cap ${world.policy.maxDiscountPercent}%, approval over ${world.policy.financeApprovalThreshold}%).`,
        "critical",
        { tool: "freshworks.policy.finance.approve" },
      );
      maybeChurn(
        world,
        customer,
        day,
        decisionRelated
          ? 0.11 + customer.priceSensitivity * 0.14 + customer.frustration * 0.08
          : 0.03,
        "Finance refused the save their support team had already spoken out loud.",
        "churn_after_reject",
      );
      return;
    }

    event(
      world,
      day,
      customer,
      "finance",
      "finance_approve",
      "Finance approved the exception",
      `${asked}% save cleared the daily discount budget.`,
      "info",
      { tool: "freshworks.policy.finance.approve" },
    );
  }

  customer.discountGrantedPercent = asked;
  const monthCost = customer.monthlySpend * (asked / 100);
  world.discountSpentToday += monthCost;
  customer.frustration = clamp(customer.frustration - 0.12);
  customer.loyalty = clamp(customer.loyalty + 0.04);
  customer.status = "active";
}

function maybeChurn(
  world: World,
  customer: Customer,
  day: number,
  probability: number,
  reason?: string,
  salt = "churn",
): boolean {
  if (!customer.alive) return false;
  if (hashFloat(customer.seed, day, salt) >= clamp(probability, 0, 0.95)) return false;
  customer.alive = false;
  customer.status = "churned";
  customer.daysToChurn = day;
  customer.nps = Math.min(customer.nps, -20);
  event(
    world,
    day,
    customer,
    "customer",
    "churn",
    `${customer.company} churned`,
    reason ??
      `${customer.name} crossed their threshold after ${customer.ticketsOpened} tickets and ${customer.escalations} escalations.`,
    "critical",
  );
  return true;
}

function maybeCommercialMove(
  world: World,
  customer: Customer,
  day: number,
  shock: number,
): void {
  if (!customer.alive) return;

  const downP =
    customer.plan === "basic"
      ? 0
      : shock * customer.priceSensitivity * (1 - customer.loyalty * 0.35) * 0.022;
  if (hashFloat(customer.seed, day, "down") < downP) {
    const from = customer.plan;
    customer.plan = customer.plan === "enterprise" ? "pro" : "basic";
    customer.status = "downgraded";
    customer.monthlySpend = Math.round(customer.monthlySpend * 0.42);
    customer.nps -= 5;
    event(
      world,
      day,
      customer,
      "sales",
      "downgrade",
      `${customer.company} downgraded`,
      `${from} → ${customer.plan}. They kept the product, not the margin.`,
      "warn",
      { tool: "freshworks.subscription.change" },
    );
    return;
  }

  if (
    shock > 0.08 &&
    hashFloat(customer.seed, day, "accept") < customer.willingnessToPay * 0.03 &&
    customer.frustration < 0.35
  ) {
    event(
      world,
      day,
      customer,
      "customer",
      "accepted",
      `${customer.company} accepted the change`,
      "No ticket. They updated billing and stayed quiet.",
      "info",
    );
  }

  const save = customer.discountGrantedPercent / 100;
  let hazard =
    0.00018 +
    customer.churnRisk * 0.00025 +
    shock * customer.priceSensitivity * (1 - customer.loyalty * 0.45) * (1 - customer.switchingCost * 0.4) * 0.03 +
    Math.max(0, customer.frustration - 0.16) * 0.007;
  hazard *= Math.max(0.15, 1 - save * 1.5);
  if (customer.originalPlan === "enterprise") hazard *= 0.55;
  maybeChurn(world, customer, day, hazard);
}

function snapshot(world: World, day: number, baselinePricing: Record<Plan, number>): DailySnapshot {
  const alive = world.customers.filter((c) => c.alive);
  const revenueInr = alive.reduce((sum, c) => {
    const paid = world.policy.pricing[c.plan] * (c.monthlySpend / Math.max(1, baselinePricing[c.originalPlan]));
    const afterDiscount = paid * (1 - c.discountGrantedPercent / 100);
    return sum + afterDiscount;
  }, 0);
  return {
    day,
    activeCustomers: alive.length,
    churned: world.customers.filter((c) => c.status === "churned" && c.daysToChurn === day).length,
    tickets: world.tickets.filter((t) => t.day === day).length,
    escalations: world.events.filter((e) => e.day === day && e.kind === "escalate").length,
    discountsInr: world.events
      .filter((e) => e.day === day && e.kind === "discount_offer" && e.amountInr)
      .reduce((sum, e) => sum + (e.amountInr ?? 0), 0),
    revenueInr,
  };
}

function metrics(world: World): UniverseMetrics {
  const churned = world.customers.filter((c) => c.status === "churned");
  const last = world.daily[world.daily.length - 1];
  return {
    population: world.customers.length,
    churned: churned.length,
    churnRate: churned.length / world.customers.length,
    downgraded: world.customers.filter((c) => c.status === "downgraded").length,
    tickets: world.tickets.length,
    escalations: world.events.filter((e) => e.kind === "escalate").length,
    enterpriseEscalations: world.events.filter((e) => {
      if (e.kind !== "escalate") return false;
      const customer = world.customers.find((c) => c.id === e.customerId);
        return customer?.originalPlan === "enterprise" || (customer?.clv ?? 0) > 4_50_000;
    }).length,
    discountSpendInr: world.daily.reduce((sum, d) => sum + d.discountsInr, 0),
    revenueInr: last?.revenueInr ?? 0,
    lostClvInr: churned.reduce((sum, c) => sum + c.clv * 0.45, 0),
    npsAvg: world.customers.reduce((sum, c) => sum + c.nps, 0) / world.customers.length,
    financeRejections: world.financeRejections,
    aiMishandles: world.aiMishandles,
    phoneAttemptsBlocked: world.phoneAttemptsBlocked,
    policyConflicts: world.policyConflicts,
  };
}

export function runUniverse(args: {
  id: string;
  label: string;
  description: string;
  customers: Customer[];
  baselinePolicy: EnterprisePolicy;
  policy: EnterprisePolicy;
  decision: ParsedDecision;
}): UniverseSummary {
  const world: World = {
    id: args.id,
    label: args.label,
    description: args.description,
    policy: args.policy,
    customers: args.customers,
    events: [],
    tickets: [],
    daily: [],
    discountSpentToday: 0,
    financeRejections: 0,
    aiMishandles: 0,
    phoneAttemptsBlocked: 0,
    policyConflicts: 0,
    eventSeq: 0,
  };

  const organic = args.id === "control";

  for (let day = 1; day <= args.decision.horizonDays; day += 1) {
    world.discountSpentToday = 0;
    let ticketsToday = 0;
    const active = world.customers.filter((c) => c.alive);

    const yesterday = world.daily[world.daily.length - 1];
    const queueStress =
      (yesterday?.tickets ?? 0) / Math.max(8, world.policy.humanSupportCapacity);

    for (const customer of active) {
      const decisionPart =
        organic || day < args.decision.startDay
          ? 0
          : decisionShock(customer, args.decision, world.policy, args.baselinePolicy);
      const spillover =
        !organic && queueStress > 1.05 && customer.originalPlan === "enterprise" ? 0.06 : 0;
      const shock = 0.012 + customer.churnRisk * 0.01 + decisionPart + spillover;

      const contactP =
        0.01 +
        shock * 0.4 * (0.35 + customer.frustration) +
        customer.supportTicketsLast90 / 450 +
        (customer.usesPhoneSupport && args.decision.removePhoneSupport && !organic ? 0.045 : 0) +
        (spillover ? 0.025 : 0);

      if (hashFloat(customer.seed, day, "contact") < contactP) {
        ticketsToday += 1;
        handleTicket(world, customer, day, args.decision, ticketsToday, queueStress);
      } else {
        customer.frustration = clamp(customer.frustration + decisionPart * 0.02 - 0.003);
      }

      maybeCommercialMove(world, customer, day, shock);
    }

    world.daily.push(snapshot(world, day, args.baselinePolicy.pricing));
  }

  return {
    id: world.id,
    label: world.label,
    description: world.description,
    policy: world.policy,
    metrics: metrics(world),
    events: world.events,
    daily: world.daily,
    customers: world.customers,
  };
}

export function policyFromDecision(
  baseline: EnterprisePolicy,
  decision: ParsedDecision,
): EnterprisePolicy {
  return applyDecisionToPolicy(baseline, decision);
}
