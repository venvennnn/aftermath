import type {
  CausalStory,
  IncomingCall,
  ObserverReport,
  SimEvent,
  TimelineBeat,
  UniverseSummary,
} from "./types";

function customerMap(universe: UniverseSummary) {
  return new Map(universe.customers.map((c) => [c.id, c]));
}

function chainsFor(universe: UniverseSummary, customerId: string): SimEvent[] {
  return universe.events
    .filter((event) => event.customerId === customerId)
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
}

export function buildStories(treatment: UniverseSummary, limit = 6): CausalStory[] {
  const byCustomer = new Map<string, SimEvent[]>();
  for (const event of treatment.events) {
    const list = byCustomer.get(event.customerId) ?? [];
    list.push(event);
    byCustomer.set(event.customerId, list);
  }

  const scored = [...byCustomer.entries()]
    .map(([customerId, events]) => {
      const customer = treatment.customers.find((c) => c.id === customerId);
      const material = events.filter((event) => event.severity !== "info");
      const critical = material.filter((e) => e.severity === "critical").length;
      const kinds = new Set(material.map((e) => e.kind));
      const score =
        (customer?.clv ?? 0) / 1_20_000 +
        Math.min(material.length, 8) * 4 +
        critical * 18 +
        (kinds.has("finance_reject") ? 28 : 0) +
        (kinds.has("ai_reply") && kinds.has("churn") ? 16 : 0) +
        (kinds.has("phone_blocked") ? 10 : 0) +
        (customer?.status === "churned" ? 48 : 0) +
        (customer?.status === "downgraded" ? 14 : 0);
      return { customerId, events: material, customer, score };
    })
    .filter((row) => row.events.length >= 2 && row.customer)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((row) => {
    const customer = row.customer!;
    const chain = row.events.slice(0, 8).map((event) => ({
      day: event.day,
      actor: event.actor,
      action: event.title,
      outcome: event.detail,
    }));
    const last = row.events[row.events.length - 1]!;
    const peak =
      row.events.find((event) => event.kind === "churn") ??
      row.events.find((event) => event.kind === "finance_reject") ??
      row.events.find((event) => event.kind === "downgrade") ??
      row.events.find((event) => event.severity === "critical") ??
      last;
    const insight = insightFor(row.events, customer.status);
    return {
      id: `story_${customer.id}`,
      headline: `${customer.company} · ${peak.title}`,
      customerId: customer.id,
      outcome: customer.status,
      chain,
      insight,
    };
  });
}

function insightFor(events: SimEvent[], status: string): string {
  const kinds = new Set(events.map((e) => e.kind));
  if (kinds.has("finance_reject") && kinds.has("churn")) {
    return "The price change was survivable. The failed save after a support miss was not.";
  }
  if (kinds.has("phone_blocked") && kinds.has("churn")) {
    return "Removing the phone queue turned an operational shortcut into a loyalty event.";
  }
  if (kinds.has("ai_reply") && kinds.has("escalate")) {
    return "The AI agent resolved volume and created a high-value miss at the same time.";
  }
  if (status === "downgraded") {
    return "They did not leave. They stopped paying for the plan the decision was meant to harvest.";
  }
  if (status === "churned") {
    return "Churn here is a chain reaction, not a single survey score.";
  }
  return "The customer absorbed the decision, but the workflow around it still spent political capital.";
}

export function buildTimeline(treatment: UniverseSummary): TimelineBeat[] {
  const customers = customerMap(treatment);
  const beats: TimelineBeat[] = [];

  const byDay = new Map<number, SimEvent[]>();
  for (const event of treatment.events) {
    const list = byDay.get(event.day) ?? [];
    list.push(event);
    byDay.set(event.day, list);
  }

  for (const [day, events] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const tickets = events.filter((e) => e.kind === "human_reply" || e.kind === "ai_reply").length;
    const churns = events.filter((e) => e.kind === "churn");
    const rejects = events.filter((e) => e.kind === "finance_reject");
    const phones = events.filter((e) => e.kind === "phone_blocked");
    const daily = treatment.daily.find((d) => d.day === day);

    if (day === 1) {
      beats.push({
        day,
        kicker: "The decision lands",
        title: "Customers begin to notice",
        body: `${tickets} conversations fire on day one. The world has not broken. It has started to move.`,
        severity: "info",
      });
    } else if (churns.length > 0) {
      const lead = churns.sort((a, b) => (customers.get(b.customerId)?.clv ?? 0) - (customers.get(a.customerId)?.clv ?? 0))[0]!;
      const who = customers.get(lead.customerId);
      beats.push({
        day,
        kicker: "Account lost",
        title: `${who?.company ?? "A customer"} leaves`,
        body: lead.detail,
        severity: "critical",
        customerId: lead.customerId,
      });
    } else if (rejects.length) {
      beats.push({
        day,
        kicker: "Policy collision",
        title: "Retention and finance disagree",
        body: `${rejects.length} save offer${rejects.length > 1 ? "s" : ""} died in finance. Discount budget is already a character in this story.`,
        severity: "critical",
      });
    } else if (phones.length >= 3) {
      beats.push({
        day,
        kicker: "Channel shock",
        title: "Phone attempts bounce",
        body: `${phones.length} customers hit a closed line and spilled into chat.`,
        severity: "warn",
      });
    } else if (tickets >= 8 || (daily && daily.tickets >= 8)) {
      beats.push({
        day,
        kicker: "Queue pressure",
        title: "Support volume steps up",
        body: `${daily?.tickets ?? tickets} tickets today. Human capacity is ${treatment.policy.humanSupportCapacity}/day.`,
        severity: "warn",
      });
    }
  }

  if (beats.length < 6) {
    for (const event of treatment.events.filter((e) => e.severity !== "info").slice(0, 8)) {
      if (beats.some((b) => b.day === event.day && b.customerId === event.customerId)) continue;
      beats.push({
        day: event.day,
        kicker: event.actor.replace("_", " "),
        title: event.title,
        body: event.detail,
        severity: event.severity,
        customerId: event.customerId,
      });
    }
  }

  return beats
    .sort((a, b) => a.day - b.day)
    .filter((beat, index, all) => index === 0 || beat.day !== all[index - 1]?.day || beat.title !== all[index - 1]?.title)
    .slice(0, 16);
}

export function buildIncomingCall(treatment: UniverseSummary, stories: CausalStory[]): IncomingCall {
  const story =
    stories.find((s) => s.outcome === "churned") ??
    stories[0];
  const customer = treatment.customers.find((c) => c.id === story?.customerId) ??
    treatment.customers.filter((c) => c.status === "churned").sort((a, b) => b.clv - a.clv)[0] ??
    treatment.customers[0]!;

  const chain = chainsFor(treatment, customer.id);
  const day = customer.daysToChurn ?? chain[chain.length - 1]?.day ?? 23;
  const years = Math.max(1, Math.round(customer.tenureMonths / 12));
  const supportMiss = chain.find((e) => e.kind === "ai_reply" || e.kind === "phone_blocked" || e.kind === "finance_reject");

  const script = [
    `Hi. This is ${customer.name} from ${customer.company}.`,
    `We've been on Meridian for ${years} year${years > 1 ? "s" : ""}.`,
    supportMiss
      ? `After the change, and then what happened with support — ${supportMiss.title.toLowerCase()} — we lost confidence we could operate on this platform.`
      : `After the change this month, we lost confidence we could keep running on Meridian.`,
    `I'm calling to say we're moving to another provider. I wanted you to hear it from me.`,
  ].join(" ");

  return {
    day,
    customerId: customer.id,
    fromName: customer.name,
    fromCompany: customer.company,
    tenureLabel: `${years} year${years > 1 ? "s" : ""}`,
    script,
    closingLine: "THIS CUSTOMER DOESN'T EXIST. YET.",
  };
}

export function buildObserver(
  control: UniverseSummary,
  treatment: UniverseSummary,
  decisionLabel: string,
): ObserverReport {
  const dChurn = treatment.metrics.churnRate - control.metrics.churnRate;
  const dTickets = treatment.metrics.tickets - control.metrics.tickets;
  const findings = [];

  if (treatment.metrics.aiMishandles > 4) {
    findings.push({
      pattern: "AI mishandles concentrate on expensive customers",
      evidence: `${treatment.metrics.aiMishandles} Assist replies were scored as mishandles, several on pricing or policy questions.`,
      severity: "critical" as const,
    });
  }
  if (treatment.metrics.financeRejections > 0) {
    findings.push({
      pattern: "Retention and finance are in conflict",
      evidence: `${treatment.metrics.financeRejections} save offers were rejected after being promised in the escalation path.`,
      severity: "critical" as const,
    });
  }
  if (treatment.metrics.phoneAttemptsBlocked > 0) {
    findings.push({
      pattern: "A removed channel still receives intent",
      evidence: `${treatment.metrics.phoneAttemptsBlocked} phone attempts were blocked, then reappeared as chat volume.`,
      severity: "warn" as const,
    });
  }
  if (dTickets / Math.max(1, control.metrics.tickets) > 0.12) {
    findings.push({
      pattern: "Support is the transmission belt",
      evidence: `Ticket volume moved ${Math.round((dTickets / Math.max(1, control.metrics.tickets)) * 100)}% versus the untouched universe.`,
      severity: "warn" as const,
    });
  }
  if (treatment.metrics.downgraded > treatment.metrics.churned * 0.6) {
    findings.push({
      pattern: "Silent downgrades hide inside 'retained' logos",
      evidence: `${treatment.metrics.downgraded} accounts stayed and paid less — a revenue event that a churn dashboard under-reports.`,
      severity: "warn" as const,
    });
  }
  if (!findings.length) {
    findings.push({
      pattern: "The decision mostly holds",
      evidence: "Second-order effects appeared, but they did not dominate the P&L in this horizon.",
      severity: "info" as const,
    });
  }

  const unexpected = [];
  if (treatment.metrics.enterpriseEscalations > control.metrics.enterpriseEscalations) {
    unexpected.push("Enterprise escalations rose even when the decision targeted a lower plan.");
  }
  if (treatment.metrics.policyConflicts > 0) {
    unexpected.push("Internal policy, not the customer, closed several save attempts.");
  }
  if (treatment.metrics.aiMishandles > 0 && decisionLabel.toLowerCase().includes("price")) {
    unexpected.push("The knowledge base still describes the old price, so Assist argues with billing.");
  }

  const thesis =
    dChurn > 0.04
      ? "The headline risk is not the decision. It is the chain reaction produced by existing agents and workflows."
      : "Demand absorbs most of the shock, but operations still spend goodwill and discount budget to keep the chart green.";

  const recommendation =
    treatment.metrics.financeRejections > 2
      ? "If you ship this, rewrite the save policy before the price lands — or the support floor will promise what finance will refuse."
      : treatment.metrics.aiMishandles > 5
        ? "Freeze Assist on billing and policy intents until the knowledge base matches the new world."
        : "Ship with a watched cohort and a pre-approved retention band for high-CLV accounts.";

  return {
    headline: dChurn > 0.05 ? "The aftermath is a workflow problem" : "The aftermath is smaller than the fear — and still not free",
    thesis,
    findings,
    recommendation,
    unexpected: unexpected.slice(0, 4),
    policyConflicts: treatment.metrics.policyConflicts
      ? [`${treatment.metrics.policyConflicts} finance/retention collisions in ${treatment.daily.length} days.`]
      : [],
  };
}
