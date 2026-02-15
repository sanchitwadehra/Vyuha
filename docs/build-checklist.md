# Vyuha — Build Checklist

**Start**: 10:25 AM | **Submission**: 5:00 PM | **Builder**: Solo

---

## Chunk 1: Scaffold + UI + State System

- [x] Next.js project setup (App Router + Tailwind CSS) ✅ tested
- [x] Project folder structure ✅ tested
- [x] TypeScript types (WorldState, Entity, Action, Rule, etc.) ✅ tested
- [x] World state store (Redis via Upstash) ✅ tested
- [ ] Rule executor (hard rules block, soft rules penalize)
- [x] LLM provider abstraction (OpenAI / Anthropic swap via env) ✅ tested
- [x] API route stubs (god-mode, agent-action, simulation) ✅ tested
- [x] Grid component (renders entities from state, dark theme) ✅ tested
- [x] Chat panel component (input + message history) ✅ tested
- [x] Layout (grid ~70% left, chat ~30% right) ✅ tested
- [x] Controls (Start / Stop / Reset agents) ✅ tested
- [x] Verify: grid renders entities, chat UI works ✅ tested

**Goal**: Visual app with grid + chat. Nothing "thinks" yet.

---

## Chunk 2: Brains Come Alive

- [x] God Mode API: chat → GPT-4o → structured state mutations ✅ tested
- [x] God Mode system prompt (open-ended, diverse defaults, explain actions) ✅ tested
- [x] Wire chat panel → God Mode API → state updates → grid re-render ✅ tested
- [x] Agent brain API: state + memory + rules → GPT-4o-mini → action ✅ tested
- [x] Agent async loop (independent, self-paced, thinking state) ✅ tested
- [x] Agent memory (per-agent, accumulates observations) ✅ tested
- [ ] Action queue processing (FIFO, first-come-first-served)
- [ ] Wire agent loops → action queue → rule executor → state → render
- [x] Verify: God Mode commands change world, agents act independently ✅ tested

**Goal**: Full working MVP. Type commands, world changes, agents act.

---

## Chunk 3: Polish + Demo Prep

- [x] Visual polish (thinking glow/pulse) ✅ tested
- [x] Dark theme refinement (clean, intentional look) ✅ tested
- [x] Agent status indicators on grid (thinking/idle) ✅ tested
- [x] Chat UX (auto-scroll, loading state for God Mode) ✅ tested
- [x] Sample prompts on empty canvas for first-time users ✅ tested
- [ ] Pre-seed demo scenario (scripted sequence for judges)
- [ ] Rehearse demo flow (time it, aim for ~4 minutes)
- [ ] Bug fixes + edge case handling
- [ ] Final test: full demo run start to finish

**Goal**: Polished, demo-ready, rehearsed.

---

## Demo Script (Rehearse This)

1. Open app — clean canvas with sample prompts
2. "Add a population of 5" → diverse agents appear
3. Let them run — watch async behavior, thinking states
4. "Add resource scarcity — only 2 food sources"
5. Watch agents compete
6. "Divide them into two armies" → teams form
7. "A storm arrives" → environment changes, agents react
8. "Betray anyone who wears red, unless it's a Tuesday"
9. Watch agents get confused → **Panini thesis moment**
10. Stop simulation, pitch the vision

---

## Time Checkpoints

| Time | Checkpoint |
|---|---|
| ~11:30 AM | Chunk 1 done — visual app running |
| ~1:00 PM | Chunk 2 God Mode working |
| ~2:30 PM | Chunk 2 done — full MVP working |
| ~4:30 PM | Chunk 3 done — polished + rehearsed |
| 5:00 PM | **SUBMIT** |
