export function inr(n: number, signed = false): string {
  const sign = signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

export function pct(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${(Math.abs(n) * 100).toFixed(digits)}%`;
}

export function compactPct(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${(Math.abs(n) * 100).toFixed(1)}%`;
}
