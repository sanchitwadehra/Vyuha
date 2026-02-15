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
  const otherAgents = allOthers.filter((e) => e.type === "agent");

  // Pre-compute directions to interactable entities (agents + resources)
  const targetList = targets.map((e) => {
    const dx = e.position.x - agent.position.x;
    const dy = e.position.y - agent.position.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    const canInteract = Math.abs(dx) <= 2 && Math.abs(dy) <= 2;
    return `- ${e.name || e.id} (${e.type}) at (${e.position.x},${e.position.y}) ${e.emoji} | distance: ${dist} | dx=${dx > 0 ? "+" : ""}${dx}, dy=${dy > 0 ? "+" : ""}${dy}${canInteract ? " | ✅ IN RANGE — can interact" : ` | ❌ TOO FAR — move first`} | properties:${JSON.stringify(e.properties)}`;
  }).join("\n");

  // Show occupied cells so agents can avoid them
  const occupiedCells = otherAgents.map((e) => `(${e.position.x},${e.position.y})`).join(", ");

  return `You are "${agent.name}" — an agent in a 2D grid world.

## You
Position: (${agent.position.x}, ${agent.position.y}) | Mobility: ${mobility} | Rules: ${agent.rules || "None"}
Properties: ${JSON.stringify(agent.properties)}

## Memory
${(agent.memory || []).slice(-8).join("\n") || "No memories yet."}

## World
Grid: ${state.grid.width}x${state.grid.height} | Rules: ${state.globalRules.join("; ") || "None"}

## Entities (you can interact with these)
${targetList || "Nothing nearby."}

## Occupied cells (you CANNOT move here): ${occupiedCells || "none"}

## Actions — respond with ONLY valid JSON, no markdown:
{"action":"move","data":{"dx":N,"dy":N},"thought":"..."}
{"action":"interact","data":{"targetId":"name","interaction":"attack|cooperate|defect|trade|defend"},"thought":"..."}
{"action":"wait","data":{},"thought":"..."}
{"action":"speak","data":{"message":"..."},"thought":"..."}

## CRITICAL RULES — follow these exactly:
1. CHECK RANGE FIRST: Only use "interact" if the target is marked ✅ IN RANGE. If ❌ TOO FAR, you MUST "move" toward them first.
2. AVOID OCCUPIED CELLS: Do not move to a cell listed above. Offset your dx/dy by 1 to go around.
3. USE FULL MOBILITY: Move up to ${mobility} cells per turn. Don't creep 1 cell at a time.
4. TARGET BY NAME: Use the entity's name (e.g. "Red Soldier") as targetId, not the full description.
5. Payoffs: cooperate +3/+3, defect +5/-2, attack: target -10 health you +2 score, trade +1/+1, defend +5hp/+5hp.`;
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

    let decision: { action: string; data: Record<string, unknown>; thought: string; restTime?: number };
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
        const targetX = Math.max(0, Math.min(state.grid.width - 1, currentAgent.position.x + dx));
        const targetY = Math.max(0, Math.min(state.grid.height - 1, currentAgent.position.y + dy));

        const latestForMove = await getWorldState();
        const isOccupied = (x: number, y: number) =>
          latestForMove.entities.some(
            (e) => e.type === "agent" && e.id !== agentId && e.position.x === x && e.position.y === y
          );

        // Try target cell first, then try nearby alternatives
        let finalX = targetX;
        let finalY = targetY;
        let moved = false;

        if (!isOccupied(targetX, targetY)) {
          moved = true;
        } else {
          // Try cells adjacent to target, preferring ones closer to the original direction
          const offsets = [
            { ox: 0, oy: 1 }, { ox: 0, oy: -1 }, { ox: 1, oy: 0 }, { ox: -1, oy: 0 },
            { ox: 1, oy: 1 }, { ox: 1, oy: -1 }, { ox: -1, oy: 1 }, { ox: -1, oy: -1 },
          ];
          for (const { ox, oy } of offsets) {
            const altX = Math.max(0, Math.min(state.grid.width - 1, targetX + ox));
            const altY = Math.max(0, Math.min(state.grid.height - 1, targetY + oy));
            // Don't stay in the same place
            if (altX === currentAgent.position.x && altY === currentAgent.position.y) continue;
            if (!isOccupied(altX, altY)) {
              finalX = altX;
              finalY = altY;
              moved = true;
              break;
            }
          }
        }

        if (moved) {
          await updateEntity(agentId, {
            position: { x: finalX, y: finalY },
            status: "idle",
            memory: newMemory,
          });
          await addLogEntry({
            agentId,
            message: `${currentAgent.name} moved to (${finalX},${finalY})`,
            type: "action",
          });
        } else {
          await updateEntity(agentId, { status: "idle", memory: [...newMemory, `Surrounded — all nearby cells occupied`] });
          await addLogEntry({
            agentId,
            message: `${currentAgent.name} is stuck — surrounded by other agents`,
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

        // Consume resources/items after use
        if (target.type === "resource" || target.type === "object" || target.type === "item") {
          await removeEntity(target.id);
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
