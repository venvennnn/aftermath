import { parseDecisionHeuristic } from "@/lib/engine/decision";
import { compactResult, runSimulation } from "@/lib/engine/run";
import { parseDecisionWithGemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    decision?: string;
    populationSize?: number;
    horizonDays?: number;
  };
  const decision = (body.decision ?? "").trim();
  if (decision.length < 8) {
    return Response.json({ error: "Describe a business decision to simulate." }, { status: 400 });
  }

  const fallback = parseDecisionHeuristic(decision, body.horizonDays ?? 30);
  const parsed = await parseDecisionWithGemini(decision, fallback);

  const result = compactResult(
    runSimulation({
      decisionText: decision,
      populationSize: body.populationSize ?? 320,
      horizonDays: body.horizonDays ?? 30,
      parsed: parsed.decision,
      usedGemini: parsed.usedGemini,
    }),
  );

  return Response.json(result);
}
