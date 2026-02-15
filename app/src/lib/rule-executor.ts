import { Entity, WorldState, StructuredRule } from "./types";

interface InteractionResult {
  agentUpdates: Partial<Entity>;
  targetUpdates?: Partial<Entity>;
  logMessage: string;
  valid: boolean;
}

/**
 * Find a target entity by ID or name (agents often refer to targets by name)
 */
export function resolveTarget(state: WorldState, targetRef: string): Entity | undefined {
  return (
    state.entities.find((e) => e.id === targetRef) ||
    state.entities.find((e) => e.name.toLowerCase() === targetRef.toLowerCase()) ||
    state.entities.find((e) => e.name.toLowerCase().includes(targetRef.toLowerCase()))
  );
}

/**
 * Check if two entities are close enough to interact (within 2 cells)
 */
function isNearby(a: Entity, b: Entity, range = 2): boolean {
  return Math.abs(a.position.x - b.position.x) <= range &&
         Math.abs(a.position.y - b.position.y) <= range;
}

/**
 * Process an interaction between an agent and a target entity.
 * Applies game-theory payoffs for agent-agent interactions,
 * and property transfers for agent-resource interactions.
 */
export function processInteraction(
  agent: Entity,
  target: Entity,
  interactionType: string,
): InteractionResult {
  // Proximity check
  if (!isNearby(agent, target)) {
    return {
      agentUpdates: {},
      logMessage: `${agent.name} tried to ${interactionType} with ${target.name} but too far away`,
      valid: false,
    };
  }

  const type = interactionType.toLowerCase().trim();

  // Agent-to-agent interactions — game theory payoffs
  if (target.type === "agent") {
    const agentScore = (agent.properties.score as number) || 0;
    const targetScore = (target.properties.score as number) || 0;
    const targetHealth = (target.properties.health as number) ?? 100;
    const agentHealth = (agent.properties.health as number) ?? 100;

    if (type === "cooperate") {
      return {
        agentUpdates: { properties: { ...agent.properties, score: agentScore + 3 } },
        targetUpdates: { properties: { ...target.properties, score: targetScore + 3 } },
        logMessage: `${agent.name} cooperated with ${target.name} — both gain 3 score`,
        valid: true,
      };
    }

    if (type === "defect" || type === "betray") {
      return {
        agentUpdates: { properties: { ...agent.properties, score: agentScore + 5 } },
        targetUpdates: { properties: { ...target.properties, score: targetScore - 2 } },
        logMessage: `${agent.name} defected against ${target.name} — gains 5, ${target.name} loses 2`,
        valid: true,
      };
    }

    if (type === "attack") {
      return {
        agentUpdates: { properties: { ...agent.properties, score: agentScore + 2 } },
        targetUpdates: { properties: { ...target.properties, health: targetHealth - 10 } },
        logMessage: `${agent.name} attacked ${target.name} — ${target.name} loses 10 health`,
        valid: true,
      };
    }

    if (type === "trade") {
      // Both gain 1 score from successful trade
      return {
        agentUpdates: { properties: { ...agent.properties, score: agentScore + 1 } },
        targetUpdates: { properties: { ...target.properties, score: targetScore + 1 } },
        logMessage: `${agent.name} traded with ${target.name} — both gain 1 score`,
        valid: true,
      };
    }

    if (type === "defend" || type === "protect") {
      return {
        agentUpdates: { properties: { ...agent.properties, health: agentHealth + 5 } },
        targetUpdates: { properties: { ...target.properties, health: targetHealth + 5 } },
        logMessage: `${agent.name} defended with ${target.name} — both gain 5 health`,
        valid: true,
      };
    }

    // Generic agent-agent interaction
    return {
      agentUpdates: { properties: { ...agent.properties, score: agentScore + 1 } },
      targetUpdates: { properties: { ...target.properties, score: targetScore + 1 } },
      logMessage: `${agent.name} → ${interactionType} with ${target.name} — both gain 1 score`,
      valid: true,
    };
  }

  // Agent-to-resource interactions — absorb properties
  if (target.type === "resource" || target.type === "object" || target.type === "item") {
    const mergedProps = { ...agent.properties };
    const gained: string[] = [];

    for (const [key, value] of Object.entries(target.properties)) {
      if (typeof value === "number" && typeof mergedProps[key] === "number") {
        // Numeric: add to existing
        mergedProps[key] = (mergedProps[key] as number) + value;
      } else if (key === "value") {
        // "value" property adds to score
        mergedProps.score = ((mergedProps.score as number) || 0) + (value as number);
      } else {
        // Non-numeric: absorb the property
        mergedProps[key] = value;
      }
      gained.push(key);
    }

    return {
      agentUpdates: { properties: mergedProps },
      logMessage: `${agent.name} used ${target.name} — gained: ${gained.join(", ")}`,
      valid: true,
    };
  }

  // Fallback for any other entity type
  return {
    agentUpdates: { properties: { ...agent.properties, score: ((agent.properties.score as number) || 0) + 1 } },
    logMessage: `${agent.name} interacted with ${target.name}`,
    valid: true,
  };
}

/**
 * Check if a single entity matches a rule's condition
 */
function checkCondition(entity: Entity, check: StructuredRule["check"]): boolean {
  const value = entity.properties[check.property] as number | undefined;
  if (value === undefined) return false;

  switch (check.operator) {
    case "<=": return value <= check.value;
    case ">=": return value >= check.value;
    case "<":  return value < check.value;
    case ">":  return value > check.value;
    case "==": return value === check.value;
    case "!=": return value !== check.value;
    default: return false;
  }
}

export interface RuleEffect {
  entityId: string;
  entityName: string;
  effect: "eliminate" | "penalize";
  rule: StructuredRule;
  penaltyApplied?: { property: string; amount: number };
}

/**
 * Evaluate all structured rules against current world state.
 * Returns a list of effects to apply (eliminations, penalties).
 */
export function evaluateStructuredRules(state: WorldState): RuleEffect[] {
  const effects: RuleEffect[] = [];

  for (const rule of state.structuredRules) {
    for (const entity of state.entities) {
      // Check if rule applies to this entity type
      if (rule.appliesTo !== "all" && rule.appliesTo !== entity.type) continue;

      // Check condition
      if (!checkCondition(entity, rule.check)) continue;

      if (rule.effect === "eliminate") {
        effects.push({
          entityId: entity.id,
          entityName: entity.name,
          effect: "eliminate",
          rule,
        });
      } else if (rule.effect === "penalize" && rule.penalty) {
        effects.push({
          entityId: entity.id,
          entityName: entity.name,
          effect: "penalize",
          rule,
          penaltyApplied: rule.penalty,
        });
      }
    }
  }

  return effects;
}
