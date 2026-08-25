import { describe, expect, it } from "vitest";
import { parseDecisionHeuristic } from "@/lib/engine/decision";
import { runSimulation } from "@/lib/engine/run";

describe("decision agent", () => {
  it("parses a Pro price increase", () => {
    const parsed = parseDecisionHeuristic("Increase the Pro plan price by 18%.");
    expect(parsed.type).toBe("pricing");
    expect(parsed.priceChangePercent).toBe(18);
    expect(parsed.affectedPlans).toEqual(["pro"]);
  });

  it("parses an SLA stretch to 24 hours", () => {
    const parsed = parseDecisionHeuristic(
      "Change the non-enterprise SLA from 4 hours to 24 hours.",
    );
    expect(parsed.type).toBe("sla");
    expect(parsed.slaHours).toBe(24);
    expect(parsed.affectedPlans).toEqual(["basic", "pro"]);
  });
});

describe("world engine", () => {
  it("is deterministic for a given seed", () => {
    const a = runSimulation({
      decisionText: "Increase the Pro plan price by 18%.",
      populationSize: 80,
      seed: 42,
    });
    const b = runSimulation({
      decisionText: "Increase the Pro plan price by 18%.",
      populationSize: 80,
      seed: 42,
    });
    expect(a.treatment.metrics.churned).toBe(b.treatment.metrics.churned);
    expect(a.treatment.metrics.tickets).toBe(b.treatment.metrics.tickets);
    expect(a.incomingCall.customerId).toBe(b.incomingCall.customerId);
  });

  it("makes a price increase cost more churn than the control universe", () => {
    const sim = runSimulation({
      decisionText: "Increase the Pro plan price by 18%.",
      populationSize: 160,
      seed: 7,
    });
    expect(sim.treatment.metrics.churnRate).toBeGreaterThanOrEqual(sim.control.metrics.churnRate);
    expect(sim.stories.length).toBeGreaterThan(0);
    expect(sim.incomingCall.script.length).toBeGreaterThan(40);
    expect(sim.counterfactuals).toHaveLength(2);
  });

  it("lets a milder universe survive more often than the proposed shock", () => {
    const sim = runSimulation({
      decisionText: "Increase the Pro plan price by 18%.",
      populationSize: 160,
      seed: 11,
    });
    const milder = sim.counterfactuals.find((universe) => universe.id === "universe_b");
    expect(milder).toBeTruthy();
    expect(milder!.metrics.churnRate).toBeLessThanOrEqual(sim.treatment.metrics.churnRate + 0.02);
  });
});
