"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
}

const samplePrompts = [
  "Add a population of 5",
  "Add resource scarcity — only 3 food sources",
  "Divide agents into two rival armies",
  "A storm arrives, reducing visibility",
  "Add a danger zone in the top-right corner",
];

export default function ChatPanel({ messages, onSend, isLoading }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleSampleClick = (prompt: string) => {
    if (isLoading) return;
    onSend(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-200">God Mode</h2>
        <p className="text-xs text-zinc-500">Control everything with natural language</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 text-center">
              Type anything to shape the world
            </p>
            <div className="space-y-2">
              {samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSampleClick(prompt)}
                  className="w-full text-left text-xs px-3 py-2 rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-750 hover:text-zinc-200 transition-colors border border-zinc-700/50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm ${
              msg.role === "user"
                ? "text-blue-400"
                : msg.role === "system"
                ? "text-yellow-500 text-xs italic"
                : "text-zinc-300"
            }`}
          >
            <span className="text-xs text-zinc-600 mr-2">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
            {msg.role === "user" && <span className="text-zinc-500">you: </span>}
            {msg.role === "assistant" && <span className="text-zinc-500">vyuha: </span>}
            {msg.content}
          </div>
        ))}

        {isLoading && (
          <div className="text-xs text-zinc-500 animate-pulse">
            God Mode is thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-zinc-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Command the world..."
            disabled={isLoading}
            className="flex-1 bg-zinc-800 text-zinc-200 text-sm px-3 py-2 rounded-md border border-zinc-700 focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
