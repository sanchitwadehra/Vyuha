export interface Position {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: string;
  name: string;
  position: Position;
  emoji: string;
  color: string;
  status?: "idle" | "thinking" | "acting";
  rules?: string;
  memory?: string[];
  delay?: number;
  properties: Record<string, unknown>;
}

export interface HardRule {
  id: string;
  type: "hard";
  description: string;
  condition: string;
  action: "block_move" | "block_action" | "destroy";
  penalty?: { [key: string]: number };
}

export interface SoftRule {
  id: string;
  type: "soft";
  description: string;
  condition: string;
  penalty: { [key: string]: number };
}

export type Rule = HardRule | SoftRule;

export interface WorldState {
  grid: { width: number; height: number };
  entities: Entity[];
  globalRules: string[];
  structuredRules: Rule[];
  environment: Record<string, unknown>;
  log: LogEntry[];
  time: {
    started: string;
    elapsed: number;
  };
  actionCount: number;
  running: boolean;
}

export interface LogEntry {
  timestamp: string;
  agentId?: string;
  message: string;
  type: "action" | "god-mode" | "system" | "rule-violation";
}

export interface AgentAction {
  agentId: string;
  action: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface GodModeResponse {
  mutations: StateMutation[];
  message: string;
}

export interface StateMutation {
  type: "add_entity" | "remove_entity" | "modify_entity" | "add_rule" | "remove_rule" | "modify_grid" | "modify_environment" | "add_global_rule" | "remove_global_rule";
  payload: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}
