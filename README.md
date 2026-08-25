# AFTERMATH

**Meet the customers your decisions haven't created yet.**

AFTERMATH is a staging environment for business decisions. It builds a synthetic version of a company's customer ecosystem, lets those agents live through a proposed change, and reports the chain reaction — including a call from a customer who does not exist yet.

Software has development, staging, and production.

Business leaders still have **idea → production**.

AFTERMATH inserts the missing layer:

**Idea → AFTERMATH → Production**

## Run locally

```bash
npm install
cp .env.example .env.local
# add GEMINI_API_KEY (required for Decision Agent prose and live conversations)
# add ELEVENLABS_API_KEY (optional — cinematic voices for calls from the future)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run build
```

## What it simulates

A fictional Bengaluru support cloud, **Meridian**, with Freshworks-like infrastructure:

- ticket workflows and knowledge search
- Meridian Assist (AI support agent)
- escalation, retention, and finance policy
- phone routing that can be turned off

Synthetic customers carry plan, tenure, CLV, price sensitivity, loyalty, frustration, memory, and a churn threshold. They are not surveyed. They **experience** the change.

The World Engine steps thirty days. One event can trigger another:

**Price increase → complaint → Assist mishandles billing → escalation → discount → finance rejection → churn**

The Observer Agent reads thousands of those threads and names the failure pattern. The Counterfactual Agent opens milder and mitigated universes beside the proposed one.

## Killer feature

When the simulated month reaches the breaking day, an incoming call interrupts the room. The voice is a synthetic customer generated from that future.

Then the screen says:

**THIS CUSTOMER DOESN'T EXIST. YET.**

## API

| Route | Purpose |
| --- | --- |
| `POST /api/simulate` | Run Decision → Population → World → Observer |
| `POST /api/converse` | Speak with a featured synthetic customer |
| `POST /api/voice` | ElevenLabs (or JSON fallback) for the future call |
| `GET /api/health` | Liveness |

## Stack

Next.js 15, TypeScript, a seeded multi-agent world engine, Gemini, optional ElevenLabs.
