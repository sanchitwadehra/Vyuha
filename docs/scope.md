# Vyuha — MVP Scope

## One-liner

A chat-powered sandbox where LLM agents play game theory tournaments on a 2D grid, and you control everything via natural language God Mode.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│  ┌──────────────────────┐  ┌──────────────────────┐  │
│  │     2D Grid Map      │  │     Chat Panel       │  │
│  │  (Canvas/HTML grid)  │  │  (God Mode input)    │  │
│  │  re-renders on any   │  │                      │  │
│  │  state change        │  │                      │  │
│  └──────────────────────┘  └──────────────────────┘  │
│           ▲                         │                │
│           │ subscribe               │ user msg       │
│           │                         ▼                │
│  ┌─────────────────────────────────────────────────┐ │
│  │           World State (shared JSON)             │ │
│  │         + Action Queue (FIFO, locked)           │ │
│  └─────────────────────────────────────────────────┘ │
└──────────┬──────────────┬──────────────┬─────────────┘
           │              │              │
           ▼              ▼              ▼
   ┌──────────────┐ ┌──────────┐ ┌──────────┐
   │  God Mode    │ │ Agent 1  │ │ Agent 2  │  ... (N independent loops)
   │  (Opus 4.6)  │ │ (Haiku)  │ │ (Haiku)  │
   │  chat →      │ │ async    │ │ async    │
   │  mutations   │ │ loop     │ │ loop     │
   └──────┬───────┘ └────┬─────┘ └────┬─────┘
          │              │             │
          ▼              ▼             ▼
   ┌─────────────────────────────────────────┐
   │           Action Queue                  │
   │  actions applied in arrival order       │
   │  → Rule Executor validates each         │
   │  → hard rules: block + penalize         │
   │  → soft rules: allow + penalize         │
   │  → state updated → frontend re-renders  │
   └─────────────────────────────────────────┘
```

## World State Schema

```json
{
  "grid": { "width": 20, "height": 20 },
  "entities": [
    {
      "id": "agent-1",
      "type": "agent",
      "name": "Alpha",
      "position": { "x": 5, "y": 3 },
      "emoji": "🤖",
      "color": "#3b82f6",
      "status": "idle",
      "rules": "Always cooperate unless betrayed twice",
      "memory": [],
      "properties": { "health": 100, "score": 0 }
    },
    {
      "id": "resource-1",
      "type": "resource",
      "position": { "x": 10, "y": 10 },
      "emoji": "💎",
      "color": "#22c55e",
      "properties": { "value": 50 }
    }
  ],
  "globalRules": [
    "Agents can move one cell in any direction per action",
    "Agents that occupy the same cell must choose: cooperate or defect"
  ],
  "environment": {},
  "log": []
}
```

## Model Roles

| Role | Model (Anthropic) | Model (OpenAI fallback) | Purpose |
|---|---|---|---|
| God Mode | **Opus 4.6** | GPT-4o | Parse user chat → return world state mutations + new rules |
| Agent Brain | Haiku 4.5 | GPT-4o-mini | Each agent's per-tick decision (move, interact, etc.) |

- **Model-agnostic design**: LLM calls abstracted behind a provider interface, swappable via env variable
- **Dev/testing**: OpenAI (cheaper, key available now)
- **Demo**: Anthropic (it's their hackathon, use their models)

## God Mode Behavior

- User types anything → Opus receives full world state + message
- Opus returns structured mutations (add/remove/modify entities, rules, environment)
- God Mode actions also go through the Action Queue — same as agent actions
- **Vague commands**: Implement best interpretation immediately, explain in chat, user iterates
- **Open-ended**: No hardcoded command list. Claude translates ANY intent into state mutations + rules
- Complex concepts (black holes, weather, economy) are faked via 2D primitives + text rules

## Rule System

### Hard Rules (physics — enforced by code)
- Cannot move outside grid bounds
- Cannot occupy a cell blocked by a hard obstacle
- Violation → action blocked + optional penalty

### Soft Rules (behavioral — enforced by consequences)
- Social/strategic rules agents SHOULD follow but CAN break
- Violation → action allowed but penalty applied (health, score, etc.)
- This is where agents fail inconsistently — the core thesis

### Rule Executor Flow
```
Agent proposes action → Validator checks hard rules → if blocked, reject
                      → Validator checks soft rules → if violated, apply penalty
                      → Update state → Render
```

## Agent Loop (Async, Independent)

Each agent runs its own independent async loop — no global ticks, no synchronization.

```
Agent N (independent loop):
  1. Read current world state + own memory + nearby entities
  2. Set status → "thinking" (visible on grid, agent is VULNERABLE)
  3. Call Haiku API (this takes ~1-2s — agent is frozen during this)
  4. Receive decision (move, interact, wait, etc.)
  5. Submit action to the central Action Queue
  6. Set status → "idle"
  7. Agent may choose to loop again immediately, wait, or stop
```

### Key Properties

- **Thinking = vulnerable**: While an agent's API call is in-flight, other agents can act on it (attack, steal, etc.). The thinking agent can't react until its call returns.
- **Self-paced**: Agents control their own tempo. An agent can rush (short prompts, fast loops) or deliberate (longer context, slower loops). An agent can also decide to sit idle.
- **Independent memory**: Each agent maintains its own memory — past actions, observations, interactions. This is their "experience" that makes them unique despite sharing the same model.
- **No global clock**: The world is continuous. Things happen whenever agents act. The frontend re-renders on every state change.

### Action Queue

- Central FIFO queue where all agent actions (and God Mode mutations) land
- Actions are processed in arrival order — first come, first served
- Each action goes through the Rule Executor before being applied
- Resolves race conditions (two agents grabbing the same resource → first one wins)

### Controls

- **Start / Stop**: Launch or halt all agent loops
- **Spawn / Remove agents**: Via God Mode chat
- **Speed indicator**: Shows how fast each agent is cycling (actions/second)

## Frontend Requirements

- **Layout**: Grid on the left (~70%), Chat panel on the right (~30%)
- **Grid**: 2D cells rendered via HTML/CSS grid or Canvas
  - Entities shown as emoji + colored background
  - Visual indicators for environment effects (overlays, cell colors)
- **Chat**: Message input + scrollable history showing user commands and Claude responses
- **Controls**: Start / Stop all agents, agent status indicators (thinking/idle/acting)
- **Style**: Dark theme, clean, intentional — not prototype-y

## Tech Stack

- **Frontend**: Next.js (App Router) + Tailwind CSS
- **Backend**: Next.js API routes (no separate server needed)
- **Agent Brain**: Anthropic SDK (Haiku 4.5)
- **LLM**: Model-agnostic provider layer (Anthropic SDK / OpenAI SDK), swappable via env
- **State**: In-memory (no database)

## Out of Scope (MVP)

- 3D graphics / Three.js
- WebMCP integration (talk about it, don't build it)
- Persistent storage / database
- User authentication
- Mobile responsiveness
- Multiple simultaneous users
- Complex animations / particle effects

## Demo Flow (Rehearsed)

1. Show grid with 3-4 agents cooperating (Prisoner's Dilemma style)
2. God Mode: "Add resource scarcity — only 2 food sources on the map"
3. Watch agents compete for resources
4. God Mode: "Add a danger zone in the top-right that drains health"
5. Watch agents avoid it (or fail to)
6. God Mode: "Betray anyone who wears red, unless it's a Tuesday"
7. Watch agents get confused by the ambiguous English rule
8. Close with the Panini thesis
