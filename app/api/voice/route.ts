import { synthesizeSpeech } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return Response.json({ error: "Missing text" }, { status: 400 });

  const audio = await synthesizeSpeech(text);
  if (!audio) {
    return Response.json({ fallback: true }, { status: 200 });
  }

  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
