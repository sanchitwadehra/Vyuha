import { Redis } from "@upstash/redis";
import { WorldState, StateMutation, LogEntry, Entity, Rule } from "./types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const STATE_KEY = "vyuha:state";

const initialState: WorldState = {
  grid: { width: 20, height: 20 },
  entities: [],
  globalRules: [],
  structuredRules: [],
  environment: {},
  log: [],
  time: {
    started: new Date().toISOString(),
    elapsed: 0,
  },
  actionCount: 0,
  running: false,
};

export async function getWorldState(): Promise<WorldState> {
  const state = await redis.get<WorldState>(STATE_KEY);
  return state || { ...initialState };
}

async function saveState(state: WorldState): Promise<void> {
  await redis.set(STATE_KEY, state);
}

export async function resetWorldState(): Promise<void> {
  const state: WorldState = {
    ...initialState,
    time: { started: new Date().toISOString(), elapsed: 0 },
    log: [],
    entities: [],
  };
  await saveState(state);
}

export async function setRunning(running: boolean): Promise<void> {
  const state = await getWorldState();
  await saveState({ ...state, running });
}

export async function applyMutations(mutations: StateMutation[]): Promise<void> {
  if (!Array.isArray(mutations)) {
    console.warn("[applyMutations] mutations is not an array:", mutations);
    return;
  }

  let state = await getWorldState();

  for (const mutation of mutations) {
    switch (mutation.type) {
      case "add_entity": {
        const entity = mutation.payload as unknown as Entity;
        if (entity.type === "agent") {
          entity.status = entity.status || "idle";
          entity.memory = entity.memory || [];
          entity.delay = entity.delay ?? 0;
        }
        entity.properties = entity.properties || {};
        state = {
          ...state,
          entities: [...state.entities, entity],
        };
        break;
      }
      case "remove_entity": {
        const id = mutation.payload.id as string;
        state = {
          ...state,
          entities: state.entities.filter((e) => e.id !== id),
        };
        break;
      }
      case "modify_entity": {
        const { id: modId, ...changes } = mutation.payload as { id: string; [key: string]: unknown };
        state = {
          ...state,
          entities: state.entities.map((e) =>
            e.id === modId ? { ...e, ...changes } : e
          ),
        };
        break;
      }
      case "add_global_rule": {
        const rule = mutation.payload.rule as string;
        state = {
          ...state,
          globalRules: [...state.globalRules, rule],
        };
        break;
      }
      case "remove_global_rule": {
        const ruleText = mutation.payload.rule as string;
        state = {
          ...state,
          globalRules: state.globalRules.filter((r) => r !== ruleText),
        };
        break;
      }
      case "modify_grid": {
        state = {
          ...state,
          grid: { ...state.grid, ...(mutation.payload as { width?: number; height?: number }) },
        };
        break;
      }
      case "modify_environment": {
        state = {
          ...state,
          environment: { ...state.environment, ...(mutation.payload as Record<string, unknown>) },
        };
        break;
      }
      case "fill_area": {
        const { x1, y1, x2, y2, entityType, name, emoji, color, properties: fillProps } = mutation.payload as {
          x1: number; y1: number; x2: number; y2: number;
          entityType: string; name: string; emoji: string; color: string;
          properties?: Record<string, unknown>;
        };
        const newEntities: Entity[] = [];
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            newEntities.push({
              id: `${entityType}-${x}-${y}`,
              type: entityType,
              name,
              position: { x, y },
              emoji,
              color,
              properties: fillProps || {},
            });
          }
        }
        state = {
          ...state,
          entities: [...state.entities, ...newEntities],
        };
        break;
      }
      case "add_structured_rule": {
        const rule = mutation.payload as unknown as Rule;
        state = {
          ...state,
          structuredRules: [...state.structuredRules, rule],
        };
        break;
      }
      case "remove_structured_rule": {
        const ruleId = mutation.payload.id as string;
        state = {
          ...state,
          structuredRules: state.structuredRules.filter((r) => r.id !== ruleId),
        };
        break;
      }
    }
  }

  await saveState(state);
}

export async function updateEntity(id: string, updates: Partial<Entity>): Promise<void> {
  const state = await getWorldState();
  const newState = {
    ...state,
    entities: state.entities.map((e) =>
      e.id === id ? { ...e, ...updates } : e
    ),
  };
  await saveState(newState);
}

export async function removeEntity(id: string): Promise<void> {
  const state = await getWorldState();
  const newState = {
    ...state,
    entities: state.entities.filter((e) => e.id !== id),
  };
  await saveState(newState);
}

export async function addLogEntry(entry: Omit<LogEntry, "timestamp">): Promise<void> {
  const state = await getWorldState();
  const logEntry: LogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  const newState = {
    ...state,
    log: [...state.log.slice(-99), logEntry],
    actionCount: state.actionCount + 1,
  };
  await saveState(newState);
}

export async function getEntityById(id: string): Promise<Entity | undefined> {
  const state = await getWorldState();
  return state.entities.find((e) => e.id === id);
}

export async function getAgents(): Promise<Entity[]> {
  const state = await getWorldState();
  return state.entities.filter((e) => e.type === "agent");
}

export async function getNearbyEntities(position: { x: number; y: number }, radius: number): Promise<Entity[]> {
  const state = await getWorldState();
  return state.entities.filter((e) => {
    const dx = Math.abs(e.position.x - position.x);
    const dy = Math.abs(e.position.y - position.y);
    return dx <= radius && dy <= radius && (dx > 0 || dy > 0);
  });
}
