"use client";

export default function Sparkline({
  values,
  color = "#e8a54b",
  height = 42,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (!values.length) return null;
  const width = 160;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1e-6, max - min);
  const d = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
