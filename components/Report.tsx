"use client";

import { useMemo, useState } from "react";
import Chain from "@/components/Chain";
import Sparkline from "@/components/Sparkline";
import { inr, pct } from "@/lib/format";
import type { CausalStory, Customer, SimulationResult } from "@/lib/engine/types";

export default function Report({
  result,
  onReset,
}: {
  result: SimulationResult;
  onReset: () => void;
}) {
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const tickets = result.treatment.daily.map((d) => d.tickets);
  const churn = result.treatment.daily.map((d) => d.churned);

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Simulation results — {result.decision.horizonDays} days</p>
          <h2 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">
            {result.observer.headline}
          </h2>
          <p className="mt-4 max-w-2xl text-paper/65">{result.observer.thesis}</p>
        </div>
        <button
          onClick={onReset}
          className="rounded-full border border-white/15 px-4 py-2 text-xs tracking-widest text-paper/70"
        >
          NEW DECISION
        </button>
      </header>

      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Predicted churn" value={pct(result.deltas.churnRate)} hint={`${result.treatment.metrics.churned} accounts`} danger={result.deltas.churnRate > 0.03} />
        <Kpi label="Support volume" value={pct(result.deltas.supportVolume)} hint={`${result.treatment.metrics.tickets} tickets`} danger={result.deltas.supportVolume > 0.1} />
        <Kpi label="Enterprise escalations" value={pct(result.deltas.enterpriseEscalations)} hint={`${result.treatment.metrics.enterpriseEscalations} high-value`} danger={result.deltas.enterpriseEscalations > 0.05} />
        <Kpi label="Discount expenditure" value={inr(result.deltas.discountSpendInr, true)} hint="retention spend vs control" />
        <Kpi label="Projected revenue impact" value={inr(result.deltas.revenueImpactInr, true)} hint="price take minus lost CLV" danger={result.deltas.revenueImpactInr < 0} />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="panel rounded-2xl p-5 lg:col-span-2">
          <p className="kicker">Observer agent</p>
          <ul className="mt-4 space-y-4">
            {result.observer.findings.map((finding) => (
              <li key={finding.pattern}>
                <p className="text-sm text-paper">{finding.pattern}</p>
                <p className="mt-1 text-sm text-paper/55">{finding.evidence}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl border border-ember-400/20 bg-ember-400/5 p-4">
            <p className="font-mono text-[10px] tracking-widest text-ember-400">RECOMMENDATION</p>
            <p className="mt-2 text-sm leading-relaxed text-paper/80">{result.observer.recommendation}</p>
          </div>
        </div>
        <div className="panel rounded-2xl p-5">
          <p className="kicker">Volume in this future</p>
          <div className="mt-4">
            <p className="text-xs text-paper/45">Tickets / day</p>
            <Sparkline values={tickets} />
          </div>
          <div className="mt-4">
            <p className="text-xs text-paper/45">Churn events / day</p>
            <Sparkline values={churn} color="#ff4d3a" />
          </div>
          <p className="mt-5 font-mono text-[11px] leading-relaxed text-paper/40">
            {result.usedGemini ? "Decision Agent used Gemini." : "Heuristic Decision Agent. Add GEMINI_API_KEY for richer parsing and conversations."}
          </p>
        </div>
      </section>

      <section className="mt-12">
        <p className="kicker">Every number has a causal story</p>
        <h3 className="mt-2 font-serif text-3xl">Chain reactions</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {result.stories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              customer={result.featured.find((c) => c.id === story.customerId)}
              onOpen={setActiveCustomer}
            />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <p className="kicker">Counterfactual agent</p>
        <h3 className="mt-2 font-serif text-3xl">Other universes</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <UniverseCard
            title={result.treatment.label}
            description={result.treatment.description}
            churn={result.treatment.metrics.churnRate}
            tickets={result.treatment.metrics.tickets}
            revenue={result.treatment.metrics.revenueInr}
            active
          />
          {result.counterfactuals.map((universe) => (
            <UniverseCard
              key={universe.id}
              title={universe.label}
              description={universe.description}
              churn={universe.metrics.churnRate}
              tickets={universe.metrics.tickets}
              revenue={universe.metrics.revenueInr}
            />
          ))}
        </div>
      </section>

      {result.observer.unexpected.length > 0 && (
        <section className="mt-12 panel rounded-2xl p-6">
          <p className="kicker">Unexpected agent behavior</p>
          <ul className="mt-4 space-y-2 text-sm text-paper/70">
            {result.observer.unexpected.map((item) => (
              <li key={item}>— {item}</li>
            ))}
          </ul>
        </section>
      )}

      {activeCustomer && (
        <Dossier
          customer={activeCustomer}
          result={result}
          onClose={() => setActiveCustomer(null)}
        />
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div className="panel rounded-2xl p-4">
      <p className="font-mono text-[10px] tracking-widest text-paper/45">{label.toUpperCase()}</p>
      <p className={`mt-3 font-serif text-3xl ${danger ? "text-signal" : "text-paper"}`}>{value}</p>
      <p className="mt-2 text-xs text-paper/40">{hint}</p>
    </div>
  );
}

function StoryCard({
  story,
  customer,
  onOpen,
}: {
  story: CausalStory;
  customer?: Customer;
  onOpen: (customer: Customer) => void;
}) {
  return (
    <article className="panel rounded-2xl p-5">
      <p className="font-mono text-[10px] tracking-widest text-ember-400">{story.outcome.toUpperCase()}</p>
      <h4 className="mt-2 font-serif text-2xl">{story.headline}</h4>
      <div className="mt-4">
        <Chain chain={story.chain} />
      </div>
      <p className="mt-4 text-sm italic text-paper/60">{story.insight}</p>
      {customer && (
        <button
          onClick={() => onOpen(customer)}
          className="mt-4 text-xs tracking-widest text-mint"
        >
          SPEAK WITH {customer.name.split(" ")[0].toUpperCase()}
        </button>
      )}
    </article>
  );
}

function UniverseCard({
  title,
  description,
  churn,
  tickets,
  revenue,
  active,
}: {
  title: string;
  description: string;
  churn: number;
  tickets: number;
  revenue: number;
  active?: boolean;
}) {
  return (
    <article className={`rounded-2xl border p-5 ${active ? "border-ember-400/40 bg-ember-400/5" : "panel"}`}>
      <p className="font-mono text-[10px] tracking-widest text-ember-400">{title.toUpperCase()}</p>
      <p className="mt-3 text-sm text-paper/70">{description}</p>
      <dl className="mt-5 space-y-1 font-mono text-xs text-paper/55">
        <div className="flex justify-between"><dt>Churn</dt><dd>{(churn * 100).toFixed(1)}%</dd></div>
        <div className="flex justify-between"><dt>Tickets</dt><dd>{tickets}</dd></div>
        <div className="flex justify-between"><dt>Daily revenue</dt><dd>{inr(revenue)}</dd></div>
      </dl>
    </article>
  );
}

function Dossier({
  customer,
  result,
  onClose,
}: {
  customer: Customer;
  result: SimulationResult;
  onClose: () => void;
}) {
  const story = result.stories.find((s) => s.customerId === customer.id);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [log, setLog] = useState<{ role: "user" | "customer"; content: string }[]>([
    {
      role: "customer",
      content: `You reached ${customer.name}. ${customer.company} is ${customer.status} after what you did.`,
    },
  ]);

  const canSend = useMemo(() => input.trim().length > 1 && !pending, [input, pending]);

  async function send() {
    if (!canSend) return;
    const next = [...log, { role: "user" as const, content: input.trim() }];
    setLog(next);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          decision: result.decision.raw,
          chain: story?.chain ?? [],
          messages: next,
        }),
      });
      const data = (await response.json()) as { reply?: string };
      setLog([...next, { role: "customer", content: data.reply ?? "…" }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="panel max-h-[90vh] w-full max-w-3xl overflow-y-auto scroll-thin rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="kicker">Synthetic dossier</p>
            <h3 className="mt-2 font-serif text-3xl">{customer.name}</h3>
            <p className="text-paper/55">
              {customer.title}, {customer.company} · {customer.plan} · {customer.region}
            </p>
          </div>
          <button onClick={onClose} className="text-xs tracking-widest text-paper/50">
            CLOSE
          </button>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Meta k="CLV" v={inr(customer.clv)} />
          <Meta k="Tenure" v={`${customer.tenureMonths} mo`} />
          <Meta k="Loyalty" v={customer.loyalty.toFixed(2)} />
          <Meta k="Frustration" v={customer.frustration.toFixed(2)} />
        </dl>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-ember-400">WHAT THEY LIVED</p>
            <div className="mt-3">{story ? <Chain chain={story.chain} /> : <p className="text-sm text-paper/50">No long chain. They still felt it.</p>}</div>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest text-ember-400">SPEAK WITH THEM</p>
            <div className="mt-3 space-y-3">
              {log.map((message, index) => (
                <p
                  key={index}
                  className={`text-sm leading-relaxed ${message.role === "user" ? "text-mint" : "text-paper/80"}`}
                >
                  {message.role === "user" ? "You: " : `${customer.name.split(" ")[0]}: `}
                  {message.content}
                </p>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Talk to this future…"
                className="flex-1 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm"
              />
              <button
                onClick={send}
                disabled={!canSend}
                className="rounded-full bg-paper px-4 py-2 text-xs tracking-widest text-ink-950 disabled:opacity-40"
              >
                SEND
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <dt className="font-mono text-[10px] tracking-widest text-paper/40">{k}</dt>
      <dd className="mt-1">{v}</dd>
    </div>
  );
}
