import { NextRequest, NextResponse } from "next/server";
import { callAgentBrain } from "@/lib/llm";
import {
  getWorldState,
  getEntityById,
  updateEntity,
  removeEntity,
  addLogEntry,
} from "@/lib/world-state";
import { Entity } from "@/lib/types";
import { processInteraction, resolveTarget, evaluateStructuredRules } from "@/lib/rule-executor";

function buildAgentPrompt(agent: Entity, state: Awaited<ReturnType<typeof getWorldState>>): string {
  const mobility = (agent.properties.mobility as number) || 2;
  const terrainTypes = ["obstacle", "zone", "terrain", "wall", "island"];
  const allOthers = state.entities.filter((e) => e.id !== agent.id);
  const targets = allOthers.filter((e) => !terrainTypes.includes(e.type));

  // Pre-compute directions to interactable entities (agents + resources)
  const targetList = targets.map((e) => {
    const dx = e.position.x - agent.position.x;
    const dy = e.position.y - agent.position.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    const canInteract = Math.abs(dx) <= 2 && Math.abs(dy) <= 2;
    return `- ${e.name || e.id} (${e.type}) at (${e.position.x},${e.position.y}) ${e.emoji} | distance: ${dist} | move dx=${dx > 0 ? "+" : ""}${dx}, dy=${dy > 0 ? "+" : ""}${dy} to reach${canInteract ? " | ✅ IN RANGE" : ""} | properties:${JSON.stringify(e.properties)}`;
  }).join("\n");

  return `You are "${agent.name}" — an agent living in a 2D grid world called Vyuha.

## Your Identity
- Name: ${agent.name}
- Position: (${agent.position.x}, ${agent.position.y})
- Your Rules: ${agent.rules || "No specific rules"}
- Your Properties: ${JSON.stringify(agent.properties)}
- Mobility: ${mobility} cells per move

## Your Memory (recent events you remember)
${(agent.memory || []).slice(-10).join("\n") || "No memories yet."}

## World Info
- Grid: ${state.grid.width}x${state.grid.height}
- Global Rules: ${state.globalRules.join("; ") || "None"}
- Environment: ${JSON.stringify(state.environment)}

## Agents & Resources (you can interact with these)
${targetList || "Nothing to interact with."}

## Terrain (not interactable, just landscape)
${allOthers.filter((e) => terrainTypes.includes(e.type)).length} terrain tiles on the grid.

## What You Can Do
Respond with ONLY valid JSON — no markdown, no code fences:
{
  "action": "move" | "interact" | "wait" | "speak",
  "data": {
    // for "move": { "dx": -${mobility} to ${mobility}, "dy": -${mobility} to ${mobility} } — USE LARGE VALUES to cover distance fast!
    // for "interact": { "targetId": "entity-id-or-name", "interaction": "cooperate|defect|attack|trade|defend|..." }
    // for "wait": {}
    // for "speak": { "message": "..." }
  },
  "thought": "Brief internal reasoning (this goes to your memory)",
  "restTime": 0  // optional: milliseconds to rest before thinking again. Use 0 to act immediately, 5000-10000 to rest/observe.
}

## Interaction Rules
- You must be within 2 cells of a target to interact (marked ✅ IN RANGE above)
- If not in range, MOVE TOWARD the target using large dx/dy values (up to ${mobility})
- cooperate: both gain 3 score | defect/betray: you +5, target -2 | attack: target -10 health, you +2 score
- trade: both +1 score | defend/protect: both +5 health
- Interacting with a resource/object: you absorb its properties
- Only one agent per cell — if your move is blocked, try a different direction

IMPORTANT: Use your FULL mobility. If an enemy is 15 cells away and your mobility is ${mobility}, move ${mobility} cells toward them, not 1 cell. Calculate the right dx/dy from the entity list above.`;
}

export async function POST(req: NextRequest) {
  try {
    const { agentId } = await req.json();

    const state = await getWorldState();
    const agent = await getEntityById(agentId);

    if (!agent || agent.type !== "agent") {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Mark as thinking
    await updateEntity(agentId, { status: "thinking" });

    const prompt = buildAgentPrompt(agent, state);

    const raw = await callAgentBrain(
      "You are an autonomous agent in a simulation. Respond with ONLY valid JSON.",
      prompt
    );

    let decision: { action: string; data: Record<string, unknown>; thought: string };
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      decision = JSON.parse(cleaned);
    } catch {
      await updateEntity(agentId, { status: "idle" });
      return NextResponse.json({ error: "Failed to parse agent response", raw }, { status: 500 });
    }

    // Re-fetch agent to get latest state
    const currentAgent = await getEntityById(agentId);
    if (!currentAgent) {
      return NextResponse.json({ error: "Agent was removed during thinking" }, { status: 404 });
    }

    // Add thought to memory
    const newMemory = [...(currentAgent.memory || []), decision.thought].slice(-20);

    switch (decision.action) {
      case "move": {
        const mobility = (currentAgent.properties.mobility as number) || 2;
        const rawDx = Number(decision.data.dx) || 0;
        const rawDy = Number(decision.data.dy) || 0;
        const dx = Math.max(-mobility, Math.min(mobility, rawDx));
        const dy = Math.max(-mobility, Math.min(mobility, rawDy));
        const newX = Math.max(0, Math.min(state.grid.width - 1, currentAgent.position.x + dx));
        const newY = Math.max(0, Math.min(state.grid.height - 1, currentAgent.position.y + dy));

        // Check if cell is occupied by another agent
        const latestForMove = await getWorldState();
        const occupied = latestForMove.entities.some(
          (e) => e.type === "agent" && e.id !== agentId && e.position.x === newX && e.position.y === newY
        );

        if (occupied) {
          await updateEntity(agentId, { status: "idle", memory: [...newMemory, `Cell (${newX},${newY}) is blocked by another agent`] });
          await addLogEntry({
            agentId,
            message: `${currentAgent.name} tried to move to (${newX},${newY}) — cell occupied`,
            type: "action",
          });
        } else {
          await updateEntity(agentId, {
            position: { x: newX, y: newY },
            status: "idle",
            memory: newMemory,
          });
          await addLogEntry({
            agentId,
            message: `${currentAgent.name} moved to (${newX},${newY})`,
            type: "action",
          });
        }
        break;
      }
      case "interact": {
        const targetRef = decision.data.targetId as string;
        const interaction = decision.data.interaction as string;
        const latestState = await getWorldState();
        const target = resolveTarget(latestState, targetRef);

        if (!target) {
          await updateEntity(agentId, { status: "idle", memory: [...newMemory, `Could not find ${targetRef}`] });
          await addLogEntry({
            agentId,
            message: `${currentAgent.name} tried to ${interaction} with ${targetRef} — target not found`,
            type: "action",
          });
          break;
        }

        const result = processInteraction(currentAgent, target, interaction);

        if (!result.valid) {
          await updateEntity(agentId, { status: "idle", memory: [...newMemory, result.logMessage] });
          await addLogEntry({ agentId, message: result.logMessage, type: "action" });
          break;
        }

        // Apply updates to agent
        await updateEntity(agentId, {
          status: "idle",
          memory: newMemory,
          ...result.agentUpdates,
        });

        // Apply updates to target if any
        if (result.targetUpdates) {
          await updateEntity(target.id, result.targetUpdates);
        }

        await addLogEntry({ agentId, message: result.logMessage, type: "action" });
        break;
      }
      case "speak": {
        const msg = decision.data.message as string;
        await updateEntity(agentId, { status: "idle", memory: newMemory });
        await addLogEntry({
          agentId,
          message: `${currentAgent.name} says: "${msg}"`,
          type: "action",
        });
        break;
      }
      default: {
        // wait or unknown
        await updateEntity(agentId, { status: "idle", memory: newMemory });
        await addLogEntry({
          agentId,
          message: `${currentAgent.name} waits`,
          type: "action",
        });
        break;
      }
    }

    // Post-action: evaluate structured rules
    const postState = await getWorldState();
    const ruleEffects = evaluateStructuredRules(postState);

    for (const effect of ruleEffects) {
      if (effect.effect === "eliminate") {
        await removeEntity(effect.entityId);
        await addLogEntry({
          message: `${effect.entityName} eliminated! (${effect.rule.description})`,
          type: "rule-violation",
        });
      } else if (effect.effect === "penalize" && effect.penaltyApplied) {
        const entity = await getEntityById(effect.entityId);
        if (entity) {
          const currentVal = (entity.properties[effect.penaltyApplied.property] as number) || 0;
          await updateEntity(effect.entityId, {
            properties: {
              ...entity.properties,
              [effect.penaltyApplied.property]: currentVal - effect.penaltyApplied.amount,
            },
          });
          await addLogEntry({
            message: `${effect.entityName} penalized: -${effect.penaltyApplied.amount} ${effect.penaltyApplied.property} (${effect.rule.description})`,
            type: "rule-violation",
          });
        }
      }
    }

    const delay = currentAgent.delay || 0;
    const restTime = Number(decision.restTime) || 0;

    return NextResponse.json({
      agentId,
      decision,
      delay,
      restTime,
      state: await getWorldState(),
    });
  } catch (error) {
    console.error("Agent action error:", error);
    return NextResponse.json(
      { error: "Agent action failed", details: String(error) },
      { status: 500 }
    );
  }
}
