export function hash32(...parts: Array<number | string>): number {
  let h = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashFloat(...parts: Array<number | string>): number {
  return hash32(...parts) / 4294967296;
}

export function pick<T>(items: T[], ...parts: Array<number | string>): T {
  return items[Math.floor(hashFloat(...parts, "pick") * items.length)]!;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(n: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, n));
}

export function gaussianLike(...parts: Array<number | string>): number {
  const u = Math.max(1e-6, hashFloat(...parts, "u"));
  const v = Math.max(1e-6, hashFloat(...parts, "v"));
  const mag = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mag;
}

export function boundedNormal(
  mean: number,
  spread: number,
  min: number,
  max: number,
  ...parts: Array<number | string>
): number {
  return clamp(mean + gaussianLike(...parts) * spread, min, max);
}
