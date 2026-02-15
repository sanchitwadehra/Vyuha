import { NextRequest, NextResponse } from "next/server";
import { callAgentBrain } from "@/lib/llm";
import {
  getWorldState,
  getEntityById,
  getNearbyEntities,
  updateEntity,
  addLogEntry,
} from "@/lib/world-state";

function buildAgentPrompt(agent: ReturnType<typeof getEntityById>, state: ReturnType<typeof getWorldState>, nearby: ReturnType<typeof getNearbyEntities>): string {
  return `You are "${agent!.name}" — an agent living in a 2D grid world called Vyuha.

## Your Identity
- Name: ${agent!.name}
- Position: (${agent!.position.x}, ${agent!.position.y})
- Your Rules: ${agent!.rules || "No specific rules"}
- Your Properties: ${JSON.stringify(agent!.properties)}
- Your Status: ${agent!.status}

## Your Memory (recent events you remember)
${(agent!.memory || []).slice(-10).join("\n") || "No memories yet."}

## World Info
- Grid: ${state.grid.width}x${state.grid.height} (valid coordinates: x from 0 to ${state.grid.width - 1}, y from 0 to ${state.grid.height - 1})
- Your position boundaries: you can move left to x=${Math.max(0, agent!.position.x - 1)}, right to x=${Math.min(state.grid.width - 1, agent!.position.x + 1)}, up to y=${Math.max(0, agent!.position.y - 1)}, down to y=${Math.min(state.grid.height - 1, agent!.position.y + 1)}
- Global Rules: ${state.globalRules.join("; ") || "None"}
- Environment: ${JSON.stringify(state.environment)}

## Nearby Entities (within 5 cells)
${nearby.map((e) => `- ${e.name || e.id} (${e.type}) at (${e.position.x},${e.position.y}) ${e.emoji} properties:${JSON.stringify(e.properties)}`).join("\n") || "Nothing nearby."}

## What You Can Do
Respond with ONLY valid JSON — no markdown, no code fences:
{
  "action": "move" | "interact" | "wait" | "speak",
  "data": {
    // for "move": { "dx": -1|0|1, "dy": -1|0|1 }
    // for "interact": { "targetId": "...", "interaction": "cooperate|defect|attack|trade|..." }
    // for "wait": {}
    // for "speak": { "message": "..." }
  },
  "thought": "Brief internal reasoning (this goes to your memory)"
}

Think about your rules, the global rules, your surroundings, and your memory. Then decide your action.`;
}

export async function POST(req: NextRequest) {
  try {
    const { agentId } = await req.json();

    const state = getWorldState();
    const agent = getEntityById(agentId);

    if (!agent || agent.type !== "agent") {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Mark as thinking
    updateEntity(agentId, { status: "thinking" });

    const nearby = getNearbyEntities(agent.position, 5);
    const prompt = buildAgentPrompt(agent, state, nearby);

    const raw = await callAgentBrain(
      "You are an autonomous agent in a simulation. Respond with ONLY valid JSON.",
      prompt
    );

    let decision: { action: string; data: Record<string, unknown>; thought: string };
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      decision = JSON.parse(cleaned);
    } catch {
      updateEntity(agentId, { status: "idle" });
      return NextResponse.json({ error: "Failed to parse agent response", raw }, { status: 500 });
    }

    // Apply the action
    const currentAgent = getEntityById(agentId);
    if (!currentAgent) {
      return NextResponse.json({ error: "Agent was removed during thinking" }, { status: 404 });
    }

    // Add thought to memory
    const newMemory = [...(currentAgent.memory || []), decision.thought].slice(-20);

    switch (decision.action) {
      case "move": {
        const dx = Number(decision.data.dx) || 0;
        const dy = Number(decision.data.dy) || 0;
        const newX = Math.max(0, Math.min(state.grid.width - 1, currentAgent.position.x + dx));
        const newY = Math.max(0, Math.min(state.grid.height - 1, currentAgent.position.y + dy));
        updateEntity(agentId, {
          position: { x: newX, y: newY },
          status: "idle",
          memory: newMemory,
        });
        addLogEntry({
          agentId,
          message: `${currentAgent.name} moved to (${newX},${newY})`,
          type: "action",
        });
        break;
      }
      case "interact": {
        const targetId = decision.data.targetId as string;
        const interaction = decision.data.interaction as string;
        updateEntity(agentId, { status: "idle", memory: newMemory });
        addLogEntry({
          agentId,
          message: `${currentAgent.name} → ${interaction} with ${targetId}`,
          type: "action",
        });
        break;
      }
      case "speak": {
        const msg = decision.data.message as string;
        updateEntity(agentId, { status: "idle", memory: newMemory });
        addLogEntry({
          agentId,
          message: `${currentAgent.name} says: "${msg}"`,
          type: "action",
        });
        break;
      }
      default: {
        // wait or unknown
        updateEntity(agentId, { status: "idle", memory: newMemory });
        addLogEntry({
          agentId,
          message: `${currentAgent.name} waits`,
          type: "action",
        });
        break;
      }
    }

    // Apply delay if agent has one
    const delay = currentAgent.delay || 0;

    return NextResponse.json({
      agentId,
      decision,
      delay,
      state: getWorldState(),
    });
  } catch (error) {
    console.error("Agent action error:", error);
    return NextResponse.json(
      { error: "Agent action failed", details: String(error) },
      { status: 500 }
    );
  }
}
