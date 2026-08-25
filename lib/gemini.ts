import type { ParsedDecision, Plan } from "./engine/types";

const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

export function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export async function geminiJson<T>(prompt: string, schemaHint: string): Promise<T | null> {
  const key = geminiKey();
  if (!key) return null;

  const body = {
    contents: [{ role: "user", parts: [{ text: `${prompt}\n\nReturn ONLY valid JSON. Schema:\n${schemaHint}` }] }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  };

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(18_000),
        },
      );
      if (!response.ok) continue;
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      if (!cleaned) continue;
      return JSON.parse(cleaned) as T;
    } catch {
      continue;
    }
  }
  return null;
}

export async function geminiText(prompt: string, temperature = 0.7): Promise<string | null> {
  const key = geminiKey();
  if (!key) return null;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature },
  };

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(18_000),
        },
      );
      if (!response.ok) continue;
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
      if (text.trim()) return text.trim();
    } catch {
      continue;
    }
  }
  return null;
}

interface GeminiDecision {
  type?: ParsedDecision["type"];
  summary?: string;
  affectedPlans?: Plan[];
  priceChangePercent?: number;
  removePhoneSupport?: boolean;
  refundWindowDays?: number | null;
  slaHours?: number | null;
  launchAiAgent?: boolean;
  humanCapacityDeltaPercent?: number;
  cancellationNoticeDays?: number | null;
  onboardingFrictionDelta?: number;
  notes?: string[];
}

export async function parseDecisionWithGemini(
  raw: string,
  fallback: ParsedDecision,
): Promise<{ decision: ParsedDecision; usedGemini: boolean }> {
  const parsed = await geminiJson<GeminiDecision>(
    `You are the Decision Agent for AFTERMATH, a business-decision simulator for Meridian, a Freshworks-like support platform.
Convert this proposed business decision into simulation parameters.
Decision: ${JSON.stringify(raw)}`,
    `{
  "type": "pricing|support_channel|refund_policy|sla|onboarding|cancellation|ai_agent|capacity|other",
  "summary": "one sentence",
  "affectedPlans": ["basic"|"pro"|"enterprise"],
  "priceChangePercent": number,
  "removePhoneSupport": boolean,
  "refundWindowDays": number|null,
  "slaHours": number|null,
  "launchAiAgent": boolean,
  "humanCapacityDeltaPercent": number,
  "cancellationNoticeDays": number|null,
  "onboardingFrictionDelta": number,
  "notes": string[]
}`,
  );

  if (!parsed) return { decision: fallback, usedGemini: false };

  return {
    usedGemini: true,
    decision: {
      ...fallback,
      type: parsed.type ?? fallback.type,
      summary: parsed.summary ?? fallback.summary,
      affectedPlans: parsed.affectedPlans?.length ? parsed.affectedPlans : fallback.affectedPlans,
      priceChangePercent: parsed.priceChangePercent ?? fallback.priceChangePercent,
      removePhoneSupport: parsed.removePhoneSupport ?? fallback.removePhoneSupport,
      refundWindowDays: parsed.refundWindowDays ?? fallback.refundWindowDays,
      slaHours: parsed.slaHours ?? fallback.slaHours,
      launchAiAgent: parsed.launchAiAgent ?? fallback.launchAiAgent,
      humanCapacityDeltaPercent:
        parsed.humanCapacityDeltaPercent ?? fallback.humanCapacityDeltaPercent,
      cancellationNoticeDays: parsed.cancellationNoticeDays ?? fallback.cancellationNoticeDays,
      onboardingFrictionDelta: parsed.onboardingFrictionDelta ?? fallback.onboardingFrictionDelta,
      notes: parsed.notes?.length ? parsed.notes : fallback.notes,
    },
  };
}
