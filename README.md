# Vyuha / व्यूह

Natural language-controlled multi-agent sandbox. Describe worlds in English, watch autonomous LLM agents think and act on a live 2D grid.

## What it does

- **God Mode** — type natural language to create agents, terrain, rules, and environments. "Create two rival armies and make them fight" works.
- **Autonomous agents** — each agent runs an independent think-act loop powered by GPT-4o. They see the full world state, reason about goals, and choose actions.
- **Game theory interactions** — cooperate (+3/+3), defect (+5/-2), attack (-10hp), trade (+1/+1), defend (+5hp/+5hp).
- **Structured rules** — system-enforced consequences (elimination at 0 health, penalties for conditions). Agents can't bypass these.
- **Mid-simulation control** — reshape the world while agents are running. Drop mercenaries, trigger storms, change rules — all through chat.
- **Real-time visualization** — 2D grid with entity emojis, weather overlays, hover tooltips, and activity logs.

## Architecture

```
God Mode (GPT-4o) → state mutations → Upstash Redis
                                          ↓
Agent loops (GPT-4o) → read state → think → act → write state to JSON
                                          ↓
Next.js frontend ← poll state → render grid
```

- **State**: single JSON blob in Upstash Redis
- **God Mode**: translates natural language → structured mutations (add/remove/modify entities, rules, environment)
- **Agent brain**: each agent gets a prompt with full world visibility, pre-computed distances, and occupied cells
- **Rule executor**: processes interactions (game theory payoffs), evaluates structured rules post-action

## Tech stack

- Next.js 15 + TypeScript
- Upstash Redis (state persistence)
- OpenAI GPT-4o (God Mode + agent brains)
- Tailwind CSS
- Vercel (deployment)

## Running locally

```bash
cd app
cp .env.example .env.local
# Add your OPENAI_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
npm install
npm run dev
```

## Built at

Build India 2026 hackathon — solo, in under 4 hours.
