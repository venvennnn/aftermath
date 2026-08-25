const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";

export function elevenLabsEnabled(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.35,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}
