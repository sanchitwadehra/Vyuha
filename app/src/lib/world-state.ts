import { WorldState, AgentAction, StateMutation, LogEntry, Entity } from "./types";

// Survive Next.js HMR in development — state persists across hot reloads
const globalStore = globalThis as unknown as {
  __vyuha_state?: WorldState;
  __vyuha_version?: number;
  __vyuha_queue?: AgentAction[];
};

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

let worldState: WorldState = globalStore.__vyuha_state || { ...initialState };
const actionQueue: AgentAction[] = globalStore.__vyuha_queue || [];
let stateVersion = globalStore.__vyuha_version || 0;

function persist() {
  globalStore.__vyuha_state = worldState;
  globalStore.__vyuha_version = stateVersion;
  globalStore.__vyuha_queue = actionQueue;
}

export function getWorldState(): WorldState {
  return worldState;
}

export function getStateVersion(): number {
  return stateVersion;
}

export function resetWorldState(): void {
  worldState = {
    ...initialState,
    time: { started: new Date().toISOString(), elapsed: 0 },
    log: [],
    entities: [],
  };
  stateVersion++;
  persist();
}

export function setRunning(running: boolean): void {
  worldState = { ...worldState, running };
  stateVersion++;
  persist();
}

export function applyMutations(mutations: StateMutation[]): void {
  if (!Array.isArray(mutations)) {
    console.warn("[applyMutations] mutations is not an array:", mutations);
    return;
  }
  for (const mutation of mutations) {
    switch (mutation.type) {
      case "add_entity": {
        const entity = mutation.payload as unknown as Entity;
        // Ensure defaults for agent entities
        if (entity.type === "agent") {
          entity.status = entity.status || "idle";
          entity.memory = entity.memory || [];
          entity.delay = entity.delay ?? 0;
        }
        entity.properties = entity.properties || {};
        worldState = {
          ...worldState,
          entities: [...worldState.entities, entity],
        };
        break;
      }
      case "remove_entity": {
        const id = mutation.payload.id as string;
        worldState = {
          ...worldState,
          entities: worldState.entities.filter((e) => e.id !== id),
        };
        break;
      }
      case "modify_entity": {
        const { id: modId, ...changes } = mutation.payload as { id: string; [key: string]: unknown };
        worldState = {
          ...worldState,
          entities: worldState.entities.map((e) =>
            e.id === modId ? { ...e, ...changes } : e
          ),
        };
        break;
      }
      case "add_global_rule": {
        const rule = mutation.payload.rule as string;
        worldState = {
          ...worldState,
          globalRules: [...worldState.globalRules, rule],
        };
        break;
      }
      case "remove_global_rule": {
        const ruleText = mutation.payload.rule as string;
        worldState = {
          ...worldState,
          globalRules: worldState.globalRules.filter((r) => r !== ruleText),
        };
        break;
      }
      case "modify_grid": {
        worldState = {
          ...worldState,
          grid: { ...worldState.grid, ...(mutation.payload as { width?: number; height?: number }) },
        };
        break;
      }
      case "modify_environment": {
        worldState = {
          ...worldState,
          environment: { ...worldState.environment, ...(mutation.payload as Record<string, unknown>) },
        };
        break;
      }
    }
  }
  stateVersion++;
  persist();
}

export function updateEntity(id: string, updates: Partial<Entity>): void {
  worldState = {
    ...worldState,
    entities: worldState.entities.map((e) =>
      e.id === id ? { ...e, ...updates } : e
    ),
  };
  stateVersion++;
  persist();
}

export function addLogEntry(entry: Omit<LogEntry, "timestamp">): void {
  const logEntry: LogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  worldState = {
    ...worldState,
    log: [...worldState.log.slice(-99), logEntry],
    actionCount: worldState.actionCount + 1,
  };
  stateVersion++;
  persist();
}

export function getEntityById(id: string): Entity | undefined {
  return worldState.entities.find((e) => e.id === id);
}

export function getAgents(): Entity[] {
  return worldState.entities.filter((e) => e.type === "agent");
}

export function getNearbyEntities(position: { x: number; y: number }, radius: number): Entity[] {
  return worldState.entities.filter((e) => {
    const dx = Math.abs(e.position.x - position.x);
    const dy = Math.abs(e.position.y - position.y);
    return dx <= radius && dy <= radius && (dx > 0 || dy > 0);
  });
}
