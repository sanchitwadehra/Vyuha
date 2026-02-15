"use client";

import { LogEntry } from "@/lib/types";
import { useRef, useEffect } from "react";

interface LogPanelProps {
  logs: LogEntry[];
}

const typeColors: Record<string, string> = {
  action: "text-zinc-400",
  "god-mode": "text-purple-400",
  system: "text-yellow-500",
  "rule-violation": "text-red-400",
};

export default function LogPanel({ logs }: LogPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-700 px-3 py-2 h-40 overflow-y-auto">
      <div className="text-xs text-zinc-500 mb-1 font-semibold">Activity Log</div>
      {logs.length === 0 && (
        <div className="text-xs text-zinc-600 italic">No activity yet</div>
      )}
      {logs.map((log, i) => (
        <div key={i} className={`text-xs ${typeColors[log.type] || "text-zinc-400"}`}>
          <span className="text-zinc-600 mr-1.5">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          {log.message}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
