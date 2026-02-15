# Vyuha — MVP Scope

## One-liner

A chat-powered sandbox where LLM agents play game theory tournaments on a 2D grid, and you control everything via natural language God Mode.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (Next.js)             │
│  ┌──────────────────────┐  ┌──────────────────┐  │
│  │     2D Grid Map      │  │    Chat Panel     │  │
│  │  (Canvas/HTML grid)  │  │  (God Mode input) │  │
│  └──────────────────────┘  └──────────────────┘  │
│           ▲                        │             │
│           │ render state           │ user msg    │
│           │                        ▼             │
│  ┌─────────────────────────────────────────────┐ │
│  │              World State (JSON)              │ │
│  └─────────────────────────────────────────────┘ │
└────────────────┬──────────────────┬──────────────┘
                 │                  │
                 ▼                  ▼
         ┌──────────────┐  ┌───────────────┐
         │  God Mode     │  │  Agent Brains  │
         │  (Sonnet)     │  │  (Haiku)       │
         │  chat → state │  │  per-tick      │
         │  mutations    │  │  decisions     │
         └──────────────┘  └───────────────┘
                 │                  │
                 ▼                  ▼
         ┌─────────────────────────────────┐
         │        Rule Executor            │
         │  hard rules → block + penalize  │
         │  soft rules → allow + penalize  │
         └─────────────────────────────────┘
```

## World State Schema

```json
{
  "grid": { "width": 20, "height": 20 },
  "tick": 0,
  "entities": [
    {
      "id": "agent-1",
      "type": "agent",
      "name": "Alpha",
      "position": { "x": 5, "y": 3 },
      "emoji": "🤖",
      "color": "#3b82f6",
      "rules": "Always cooperate unless betrayed twice",
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
    "Agents can move one cell per tick in any direction",
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

- User types anything → Sonnet receives full world state + message
- Sonnet returns structured mutations (add/remove/modify entities, rules, environment)
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

## Game Loop

- **Tick-based** with Play / Pause / Step controls
- Each tick:
  1. Collect all agent states + surroundings + rules
  2. Single batched Haiku call: all agents decide simultaneously
  3. Rule executor validates each action
  4. State updates
  5. Re-render
- Tick speed bound by API response time (~1-2s per tick with batching)

## Frontend Requirements

- **Layout**: Grid on the left (~70%), Chat panel on the right (~30%)
- **Grid**: 2D cells rendered via HTML/CSS grid or Canvas
  - Entities shown as emoji + colored background
  - Visual indicators for environment effects (overlays, cell colors)
- **Chat**: Message input + scrollable history showing user commands and Claude responses
- **Controls**: Play / Pause / Step buttons, tick counter, speed indicator
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
