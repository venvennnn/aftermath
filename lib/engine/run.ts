import { baselinePolicy, MERIDIAN } from "./company";
import { counterfactualsFor, mitigatedPolicy } from "./counterfactual";
import { parseDecisionHeuristic } from "./decision";
import { buildIncomingCall, buildObserver, buildStories, buildTimeline } from "./observer";
import { cloneCustomers, createPopulation } from "./population";
import { hash32 } from "./rng";
import type { ParsedDecision, SimulationResult, UniverseSummary } from "./types";
import { policyFromDecision, runUniverse } from "./world";

export interface RunOptions {
  decisionText: string;
  populationSize?: number;
  horizonDays?: number;
  seed?: number;
  parsed?: ParsedDecision;
  usedGemini?: boolean;
}

export function runSimulation(options: RunOptions): SimulationResult {
  const populationSize = Math.min(1200, Math.max(40, options.populationSize ?? 320));
  const horizonDays = options.horizonDays ?? 30;
  const parsed =
    options.parsed ??
    parseDecisionHeuristic(options.decisionText, horizonDays);
  parsed.horizonDays = horizonDays;
  parsed.raw = options.decisionText;

  const seed = options.seed ?? hash32(options.decisionText, populationSize, horizonDays);
  const company = MERIDIAN;
  const baseline = baselinePolicy(company);
  const population = createPopulation(populationSize, seed);

  const control = runUniverse({
    id: "control",
    label: "Universe 0 — status quo",
    description: "The same thirty days with no decision applied.",
    customers: cloneCustomers(population),
    baselinePolicy: baseline,
    policy: baseline,
    decision: { ...parsed, priceChangePercent: 0, removePhoneSupport: false, launchAiAgent: false, humanCapacityDeltaPercent: 0, refundWindowDays: null, slaHours: null, cancellationNoticeDays: null, onboardingFrictionDelta: 0, affectedPlans: [] },
  });

  const treatment = runUniverse({
    id: "treatment",
    label: "Universe A — proposed decision",
    description: parsed.summary,
    customers: cloneCustomers(population),
    baselinePolicy: baseline,
    policy: policyFromDecision(baseline, parsed),
    decision: parsed,
  });

  const cfSpecs = counterfactualsFor(parsed);
  const counterfactuals: UniverseSummary[] = cfSpecs.map((spec) =>
    runUniverse({
      id: spec.id,
      label: spec.label,
      description: spec.description,
      customers: cloneCustomers(population),
      baselinePolicy: baseline,
      policy:
        spec.id === "universe_c"
          ? mitigatedPolicy(baseline, spec.decision)
          : policyFromDecision(baseline, spec.decision),
      decision: spec.decision,
    }),
  );

  const stories = buildStories(treatment);
  const incomingCall = buildIncomingCall(treatment, stories);
  const observer = buildObserver(control, treatment, parsed.summary);
  const timeline = buildTimeline(treatment);

  const featuredIds = new Set([
    incomingCall.customerId,
    ...stories.map((s) => s.customerId),
  ]);
  const featured = treatment.customers
    .filter((c) => featuredIds.has(c.id))
    .sort((a, b) => b.clv - a.clv)
    .slice(0, 8);

  const ticketsDelta =
    (treatment.metrics.tickets - control.metrics.tickets) /
    Math.max(1, control.metrics.tickets);
  const escDelta =
    (treatment.metrics.enterpriseEscalations - control.metrics.enterpriseEscalations) /
    Math.max(1, control.metrics.enterpriseEscalations);

  return {
    id: `sim_${seed.toString(16)}`,
    seed,
    usedGemini: Boolean(options.usedGemini),
    company,
    decision: parsed,
    control,
    treatment,
    counterfactuals,
    deltas: {
      churnRate: treatment.metrics.churnRate - control.metrics.churnRate,
      supportVolume: ticketsDelta,
      enterpriseEscalations: escDelta,
      discountSpendInr:
        treatment.metrics.discountSpendInr - control.metrics.discountSpendInr,
      revenueImpactInr:
        (treatment.metrics.revenueInr - control.metrics.revenueInr) * horizonDays -
        (treatment.metrics.lostClvInr - control.metrics.lostClvInr) * 0.15,
      nps: treatment.metrics.npsAvg - control.metrics.npsAvg,
      tickets: treatment.metrics.tickets - control.metrics.tickets,
    },
    featured,
    stories,
    observer,
    incomingCall,
    timeline,
    generatedAt: new Date().toISOString(),
  };
}

function publicCustomer(customer: SimulationResult["featured"][number]) {
  return {
    ...customer,
    history: customer.history.slice(0, 4),
    goals: customer.goals.slice(0, 2),
  };
}

export function compactResult(result: SimulationResult): SimulationResult {
  const featuredIds = new Set(result.featured.map((c) => c.id));
  const slimTreatment: UniverseSummary = {
    ...result.treatment,
    events: result.treatment.events.filter((event) => event.severity !== "info").slice(0, 220),
    customers: result.treatment.customers
      .filter((customer) => featuredIds.has(customer.id) || customer.status !== "active")
      .slice(0, 80)
      .map(publicCustomer),
  };
  const metricsOnly = (universe: UniverseSummary): UniverseSummary => ({
    ...universe,
    events: [],
    customers: [],
  });

  return {
    ...result,
    featured: result.featured.map(publicCustomer),
    control: metricsOnly(result.control),
    treatment: slimTreatment,
    counterfactuals: result.counterfactuals.map(metricsOnly),
  };
}
