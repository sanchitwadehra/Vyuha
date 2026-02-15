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

export interface StructuredRule {
  id: string;
  type: "hard" | "soft";
  description: string;
  // What triggers this rule
  check: {
    property: string;       // entity property to check, e.g. "health", "score"
    operator: "<=" | ">=" | "<" | ">" | "==" | "!=";
    value: number;
  };
  // What happens when triggered
  effect: "eliminate" | "penalize";
  // For penalize: which property loses how much
  penalty?: { property: string; amount: number };
  // Which entity types this applies to ("agent", "resource", or "all")
  appliesTo: string;
}

export type Rule = StructuredRule;

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
  type: "add_entity" | "remove_entity" | "modify_entity" | "add_rule" | "remove_rule" | "modify_grid" | "modify_environment" | "add_global_rule" | "remove_global_rule" | "add_structured_rule" | "remove_structured_rule" | "fill_area";
  payload: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}
