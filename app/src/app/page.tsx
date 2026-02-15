"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Grid from "@/components/Grid";
import ChatPanel from "@/components/ChatPanel";
import Controls from "@/components/Controls";
import LogPanel from "@/components/LogPanel";
import { WorldState, ChatMessage, Entity } from "@/lib/types";

const emptyState: WorldState = {
  grid: { width: 20, height: 20 },
  entities: [],
  globalRules: [],
  structuredRules: [],
  environment: {},
  log: [],
  time: { started: new Date().toISOString(), elapsed: 0 },
  actionCount: 0,
  running: false,
};

export default function Home() {
  const [worldState, setWorldState] = useState<WorldState>(emptyState);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isGodModeLoading, setIsGodModeLoading] = useState(false);
  const agentLoopsRef = useRef<Map<string, boolean>>(new Map());

  // On mount, fetch current state from Redis
  useEffect(() => {
    fetch("/api/simulation")
      .then((res) => res.json())
      .then((data) => setWorldState(data.state))
      .catch(() => {});
  }, []);

  // God Mode: send chat message
  const handleSendMessage = useCallback(async (message: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsGodModeLoading(true);

    try {
      const res = await fetch("/api/god-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (data.error) {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          content: `Error: ${data.error}`,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, errMsg]);
      } else {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        setWorldState(data.state);
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "system",
        content: `Connection error: ${err}`,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsGodModeLoading(false);
    }
  }, []);

  // Agent loop: runs independently for each agent
  const runAgentLoop = useCallback(async (agentId: string) => {
    while (agentLoopsRef.current.get(agentId)) {
      try {
        const res = await fetch("/api/agent-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId }),
        });
        const data = await res.json();

        if (data.error) {
          console.error(`Agent ${agentId} error:`, data.error);
          break;
        }

        setWorldState(data.state);

        // Respect agent's delay
        const delay = data.delay || 0;
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Small base delay to prevent hammering
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Agent ${agentId} loop error:`, err);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }, []);

  // Start simulation
  const handleStart = useCallback(async () => {
    const res = await fetch("/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const data = await res.json();
    setWorldState(data.state);

    // Start independent loops for each agent
    const agents = data.state.entities.filter((e: Entity) => e.type === "agent");
    for (const agent of agents) {
      agentLoopsRef.current.set(agent.id, true);
      runAgentLoop(agent.id);
    }
  }, [runAgentLoop]);

  // Stop simulation
  const handleStop = useCallback(async () => {
    // Stop all agent loops
    agentLoopsRef.current.forEach((_, key) => {
      agentLoopsRef.current.set(key, false);
    });
    agentLoopsRef.current.clear();

    const res = await fetch("/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    const data = await res.json();
    setWorldState(data.state);
  }, []);

  // Reset world
  const handleReset = useCallback(async () => {
    agentLoopsRef.current.forEach((_, key) => {
      agentLoopsRef.current.set(key, false);
    });
    agentLoopsRef.current.clear();

    const res = await fetch("/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    const data = await res.json();
    setWorldState(data.state);
    setChatMessages([]);
  }, []);

  const agents = worldState.entities.filter((e) => e.type === "agent");

  return (
    <div className="h-screen flex flex-col p-4 gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Vyuha <span className="text-zinc-500 font-normal text-sm">व्यूह</span>
          </h1>
          <p className="text-xs text-zinc-500">Agentic Sandbox — Game Theory x LLM Agents</p>
        </div>
        <Controls
          running={worldState.running}
          onStart={handleStart}
          onStop={handleStop}
          onReset={handleReset}
          agents={agents}
          actionCount={worldState.actionCount}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left: Grid + Log */}
        <div className="flex-[7] flex flex-col gap-3 min-h-0">
          <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-lg border border-zinc-700 overflow-auto">
            <Grid
              width={worldState.grid.width}
              height={worldState.grid.height}
              entities={worldState.entities}
              environment={worldState.environment}
            />
          </div>
          <LogPanel logs={worldState.log} />
        </div>

        {/* Right: Chat */}
        <div className="flex-[3] min-h-0">
          <ChatPanel
            messages={chatMessages}
            onSend={handleSendMessage}
            isLoading={isGodModeLoading}
          />
        </div>
      </div>
    </div>
  );
}
