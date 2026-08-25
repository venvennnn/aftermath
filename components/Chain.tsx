"use client";

import type { CausalLink } from "@/lib/engine/types";

const ACTOR_COLOR: Record<string, string> = {
  customer: "#f4efe6",
  support: "#7ee0c6",
  ai_agent: "#e8a54b",
  escalation: "#ffb088",
  retention: "#c4b5fd",
  finance: "#ff4d3a",
  sales: "#93c5fd",
  policy: "#f3d19a",
  knowledge: "#7ee0c6",
  world: "#9ca3af",
};

export default function Chain({ chain }: { chain: CausalLink[] }) {
  return (
    <ol className="space-y-3">
      {chain.map((link, index) => (
        <li key={`${link.day}-${index}`} className="flex gap-3">
          <div className="flex w-12 shrink-0 flex-col items-end pt-0.5">
            <span className="font-mono text-[10px] tracking-widest text-ember-400">D{link.day}</span>
          </div>
          <div className="relative flex-1 pb-2">
            {index < chain.length - 1 && (
              <span className="absolute left-[-17px] top-5 h-[calc(100%-8px)] w-px bg-white/10" />
            )}
            <span
              className="absolute left-[-20px] top-1.5 h-1.5 w-1.5 rounded-full"
              style={{ background: ACTOR_COLOR[link.actor] ?? "#f4efe6" }}
            />
            <p className="text-sm text-paper">{link.action}</p>
            <p className="mt-1 text-xs leading-relaxed text-paper/55">{link.outcome}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
