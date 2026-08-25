"use client";

import { useEffect, useMemo, useState } from "react";
import IncomingCallOverlay from "@/components/IncomingCall";
import Report from "@/components/Report";
import Sparkline from "@/components/Sparkline";
import { SCENARIOS } from "@/lib/engine/decision";
import type { SimulationResult, TimelineBeat } from "@/lib/engine/types";
import { inr, pct } from "@/lib/format";

type Phase = "idle" | "booting" | "theater" | "call" | "report";

const SPAWN_NAMES = [
  "Aisha Menon · Harbor & Co",
  "Marcus Berg · Volt Freight",
  "Priya Iyer · Cedar Clinics",
  "Helena Moreau · Orchid Hotels",
  "Kabir Rao · Banyan Pay",
  "Sofia Alvarez · Iris Retail",
  "Rohan Das · Gridline Energy",
  "Naomi Park · Helix Robotics",
];

export default function AftermathApp() {
  const [decision, setDecision] = useState<string>(SCENARIOS[0].decision);
  const [phase, setPhase] = useState<Phase>("idle");
  const [bootStep, setBootStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [day, setDay] = useState(1);
  const [shownBeats, setShownBeats] = useState<TimelineBeat[]>([]);

  const callCustomer = useMemo(
    () => result?.featured.find((c) => c.id === result.incomingCall.customerId),
    [result],
  );

  useEffect(() => {
    if (phase !== "booting") return;
    const id = window.setInterval(() => {
      setBootStep((step) => Math.min(step + 1, 5));
    }, 700);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "theater" || !result) return;
    setDay(1);
    setShownBeats(result.timeline.filter((beat) => beat.day === 1));
    const id = window.setInterval(() => {
      setDay((current) => {
        const next = current + 1;
        if (next >= result.incomingCall.day) {
          window.clearInterval(id);
          setShownBeats(result.timeline.filter((beat) => beat.day <= result.incomingCall.day));
          window.setTimeout(() => setPhase("call"), 700);
          return result.incomingCall.day;
        }
        setShownBeats(result.timeline.filter((beat) => beat.day <= next));
        return next;
      });
    }, 380);
    return () => window.clearInterval(id);
  }, [phase, result]);

  async function run() {
    const text = decision.trim();
    if (text.length < 8) return;
    setError(null);
    setResult(null);
    setBootStep(0);
    setPhase("booting");
    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: text, populationSize: 320, horizonDays: 30 }),
      });
      const data = (await response.json()) as SimulationResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Simulation failed");
      setResult(data);
      setPhase("theater");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setPhase("idle");
    }
  }

  return (
    <main className="relative min-h-screen">
      <Topbar />
      {phase === "idle" && (
        <Landing
          decision={decision}
          setDecision={setDecision}
          onRun={run}
          error={error}
        />
      )}
      {phase === "booting" && <Boot step={bootStep} decision={decision} />}
      {phase === "theater" && result && (
        <Theater result={result} day={day} beats={shownBeats} />
      )}
      {phase === "call" && result && (
        <>
          <Theater result={result} day={day} beats={shownBeats} />
          <IncomingCallOverlay
            call={result.incomingCall}
            customer={callCustomer}
            onFinished={() => setPhase("report")}
          />
        </>
      )}
      {phase === "report" && result && (
        <Report
          result={result}
          onReset={() => {
            setPhase("idle");
            setResult(null);
            setDay(1);
          }}
        />
      )}
    </main>
  );
}

function Topbar() {
  return (
    <div className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8">
      <div>
        <p className="font-serif text-2xl tracking-[0.18em]">AFTERMATH</p>
        <div className="ember-rule mt-2" />
      </div>
      <p className="hidden max-w-xs text-right font-mono text-[10px] leading-relaxed tracking-widest text-paper/40 sm:block">
        STAGING ENVIRONMENT
        <br />
        FOR BUSINESS DECISIONS
      </p>
    </div>
  );
}

function Landing({
  decision,
  setDecision,
  onRun,
  error,
}: {
  decision: string;
  setDecision: (value: string) => void;
  onRun: () => void;
  error: string | null;
}) {
  return (
    <section className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pt-10">
      <div>
        <p className="kicker">Day 0 — before the decision</p>
        <h1 className="mt-5 font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
          Experience the consequences
          <span className="italic text-ember-400"> before </span>
          your customers do.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-paper/65 sm:text-lg">
          AFTERMATH builds a synthetic customer ecosystem, lets those agents live through a proposed change, and shows you the chain reaction — including the call you have not received yet.
        </p>
        <div className="mt-10 panel rounded-3xl p-4 sm:p-5">
          <label className="kicker" htmlFor="decision">
            Propose a decision
          </label>
          <textarea
            id="decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onRun();
            }}
            rows={3}
            className="mt-3 w-full resize-none bg-transparent font-serif text-2xl leading-snug text-paper"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[10px] tracking-widest text-paper/35">
              ⌘ / CTRL + ENTER
            </p>
            <button
              onClick={onRun}
              className="rounded-full bg-ember-400 px-6 py-3 text-sm font-medium tracking-wide text-ink-950 shadow-ember"
            >
              Open a future
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-signal">{error}</p>}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => setDecision(scenario.decision)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                decision === scenario.decision
                  ? "border-ember-400 text-ember-300"
                  : "border-white/10 text-paper/55 hover:border-white/30"
              }`}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>
      <aside className="space-y-4">
        <article className="panel rounded-3xl p-6">
          <p className="kicker">Idea → AFTERMATH → Production</p>
          <p className="mt-4 font-serif text-2xl leading-snug">
            Software has staging. Business decisions still go straight to living people.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-paper/60">
            <li>Decision Agent turns a sentence into simulation law.</li>
            <li>Customer agents carry memory, loyalty, and a churn threshold.</li>
            <li>Enterprise agents follow Freshworks-like tickets, Assist, retention, and finance policy.</li>
            <li>The Observer reads the emergent aftermath — not a forecast slide.</li>
          </ul>
        </article>
        <article className="panel rounded-3xl p-6">
          <p className="kicker">Meridian · simulated company</p>
          <p className="mt-3 text-sm text-paper/60">
            A Bengaluru support cloud. Basic / Pro / Enterprise. 38 humans, Assist on the floor, finance cap at 12%. You are about to change their world.
          </p>
        </article>
      </aside>
    </section>
  );
}

function Boot({ step, decision }: { step: number; decision: string }) {
  const labels = [
    "Decision Agent reading the change",
    "Population Agent growing a customer nation",
    "World Engine stepping hours into days",
    "Enterprise agents answering as they would",
    "Observer watching for second-order damage",
    "A future is ready",
  ];
  return (
    <section className="relative z-10 mx-auto max-w-3xl px-6 py-16 text-center">
      <p className="kicker">Opening a future</p>
      <h2 className="mt-4 font-serif text-4xl italic sm:text-5xl">{decision}</h2>
      <div className="mt-12 space-y-3">
        {labels.map((label, index) => (
          <p
            key={label}
            className={`font-mono text-xs tracking-widest ${index <= step ? "text-ember-300" : "text-paper/20"}`}
          >
            {index <= step ? "●" : "○"} {label.toUpperCase()}
          </p>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap justify-center gap-2 text-xs text-paper/40">
        {SPAWN_NAMES.slice(0, 4 + (step % 4)).map((name) => (
          <span key={name} className="rounded-full border border-white/10 px-3 py-1">
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

function Theater({
  result,
  day,
  beats,
}: {
  result: SimulationResult;
  day: number;
  beats: TimelineBeat[];
}) {
  const daily = result.treatment.daily.filter((d) => d.day <= day);
  const latest = daily[daily.length - 1];
  const churnSoFar = daily.reduce((sum, d) => sum + d.churned, 0);

  return (
    <section className="relative z-10 mx-auto grid max-w-6xl gap-6 px-5 pb-16 sm:px-8 lg:grid-cols-[0.9fr_1.2fr_0.9fr]">
      <div className="panel rounded-3xl p-6">
        <p className="kicker">World clock</p>
        <p className="day-glow mt-4 font-serif text-8xl leading-none">{String(day).padStart(2, "0")}</p>
        <p className="mt-2 text-paper/45">Day of a possible month</p>
        <dl className="mt-8 space-y-3 font-mono text-xs tracking-widest text-paper/55">
          <div className="flex justify-between"><dt>ALIVE</dt><dd>{latest?.activeCustomers ?? result.decision.horizonDays}</dd></div>
          <div className="flex justify-between"><dt>CHURNED</dt><dd className="text-signal">{churnSoFar}</dd></div>
          <div className="flex justify-between"><dt>TICKETS</dt><dd>{daily.reduce((s, d) => s + d.tickets, 0)}</dd></div>
          <div className="flex justify-between"><dt>DELTA CHURN</dt><dd>{pct(result.deltas.churnRate)}</dd></div>
        </dl>
      </div>
      <div className="space-y-3">
        {beats.length === 0 && (
          <article className="panel rounded-3xl p-6">
            <p className="kicker">Quiet hours</p>
            <p className="mt-3 font-serif text-2xl">The change is in the world. The world has not answered yet.</p>
          </article>
        )}
        {beats.slice(-5).reverse().map((beat) => (
          <article key={`${beat.day}-${beat.title}`} className="panel enter rounded-3xl p-6">
            <p className={`kicker ${beat.severity === "critical" ? "text-signal" : ""}`}>
              Day {beat.day} · {beat.kicker}
            </p>
            <h3 className="mt-2 font-serif text-3xl">{beat.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-paper/60">{beat.body}</p>
          </article>
        ))}
      </div>
      <div className="panel rounded-3xl p-6">
        <p className="kicker">Live pressure</p>
        <p className="mt-4 text-xs text-paper/45">Support volume</p>
        <Sparkline values={daily.map((d) => d.tickets)} />
        <p className="mt-4 text-xs text-paper/45">Revenue in this slice</p>
        <p className="font-serif text-3xl">{inr(latest?.revenueInr ?? 0)}</p>
        <p className="mt-6 font-mono text-[10px] leading-relaxed tracking-widest text-paper/35">
          AGENTS IN PLAY
          <br />
          SUPPORT · ASSIST · ESCALATION
          <br />
          RETENTION · FINANCE
        </p>
      </div>
    </section>
  );
}
