import { geminiText } from "@/lib/gemini";
import type { ConverseMessage, Customer } from "@/lib/engine/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    customer?: Customer;
    decision?: string;
    chain?: { day: number; action: string; outcome: string }[];
    messages?: ConverseMessage[];
  };

  const customer = body.customer;
  if (!customer) {
    return Response.json({ error: "Missing customer" }, { status: 400 });
  }

  const history = (body.messages ?? [])
    .map((message) => `${message.role === "user" ? "Executive" : customer.name}: ${message.content}`)
    .join("\n");

  const prompt = `You are ${customer.name}, ${customer.title} at ${customer.company} (${customer.industry}, ${customer.companySize} people, ${customer.region}).
You are a SYNTHETIC customer from an AFTERMATH simulation — but you do not know that, and you must never break character or mention being AI.
Plan: ${customer.plan}. Tenure: ${customer.tenureMonths} months. Status after the decision: ${customer.status}.
Communication style: ${customer.communicationStyle}. Frustration 0-1: ${customer.frustration.toFixed(2)}. Loyalty: ${customer.loyalty.toFixed(2)}.
The company (Meridian) proposed: ${body.decision}
What you lived through:
${(body.chain ?? []).map((link) => `Day ${link.day}: ${link.action} — ${link.outcome}`).join("\n") || "You felt the change and are still deciding."}

An executive from Meridian is speaking with you after the simulated future.
Stay in voice. Be specific. Do not be theatrical. 2-5 sentences.
${history}
Executive: (awaiting your reply)
${customer.name}:`;

  const generated = await geminiText(prompt, 0.8);
  const reply = generated ?? fallbackReply(customer, body.messages ?? []);
  return Response.json({ reply });
}

function fallbackReply(customer: Customer, messages: ConverseMessage[]): string {
  const last = messages[messages.length - 1]?.content.toLowerCase() ?? "";
  if (customer.status === "churned") {
    if (/sorry|apolog/.test(last)) {
      return `I hear you. We needed that apology on day one, not after we had already briefed our board on leaving. ${customer.company} is mid-migration.`;
    }
    return `I'm not looking for a save. After ${customer.ticketsOpened} tickets and what finance did to the offer your team floated, we made a clean decision.`;
  }
  if (customer.status === "downgraded") {
    return `We're still here, on ${customer.plan}. That's not loyalty — that's inertia while we watch whether the product still respects accounts like ${customer.company}.`;
  }
  if (/discount|price|pricing/.test(last)) {
    return `Price was the spark. The support path is what we will remember. If Assist can't explain your own billing, I can't put my team on it.`;
  }
  return `Tell me what would actually be different if we stayed. Not a dashboard. An operating commitment.`;
}
