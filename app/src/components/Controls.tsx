"use client";

import { Entity } from "@/lib/types";

interface ControlsProps {
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  agents: Entity[];
  actionCount: number;
}

export default function Controls({
  running,
  onStart,
  onStop,
  onReset,
  agents,
  actionCount,
}: ControlsProps) {
  const thinkingCount = agents.filter((a) => a.status === "thinking").length;
  const idleCount = agents.filter((a) => a.status === "idle" || !a.status).length;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-700">
      <div className="flex gap-2">
        {!running ? (
          <button
            onClick={onStart}
            disabled={agents.length === 0}
            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start
          </button>
        ) : (
          <button
            onClick={onStop}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-500 transition-colors"
          >
            Stop
          </button>
        )}
        <button
          onClick={onReset}
          className="px-3 py-1.5 bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md hover:bg-zinc-600 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="flex gap-4 text-xs text-zinc-400">
        <span>
          Agents: <span className="text-zinc-200">{agents.length}</span>
        </span>
        <span>
          Thinking: <span className={thinkingCount > 0 ? "text-yellow-400" : "text-zinc-200"}>{thinkingCount}</span>
        </span>
        <span>
          Idle: <span className="text-zinc-200">{idleCount}</span>
        </span>
        <span>
          Actions: <span className="text-zinc-200">{actionCount}</span>
        </span>
      </div>

      <div className={`ml-auto w-2 h-2 rounded-full ${running ? "bg-green-500 animate-pulse" : "bg-zinc-600"}`} />
    </div>
  );
}
