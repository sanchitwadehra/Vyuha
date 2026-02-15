"use client";

import { useState, useRef, useEffect } from "react";
import { Entity } from "@/lib/types";

interface GridProps {
  width: number;
  height: number;
  entities: Entity[];
  environment: Record<string, unknown>;
}

function EntityCard({ entity }: { entity: Entity }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-lg">{entity.emoji}</span>
        <div>
          <div className="font-semibold text-zinc-100">{entity.name || entity.id}</div>
          <div className="text-[10px] text-zinc-500">{entity.type} · ({entity.position.x},{entity.position.y})</div>
        </div>
      </div>
      {entity.status && (
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${
            entity.status === "thinking" ? "bg-yellow-400 animate-pulse" :
            entity.status === "acting" ? "bg-green-400" : "bg-zinc-500"
          }`} />
          <span className="text-[10px] text-zinc-400">{entity.status}</span>
        </div>
      )}
      {entity.rules && (
        <div className="text-[10px] text-zinc-400 border-t border-zinc-700 pt-1 mt-0.5">
          <span className="text-zinc-500">Rules:</span> {entity.rules}
        </div>
      )}
      {entity.properties && Object.keys(entity.properties).length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] border-t border-zinc-700 pt-1 mt-0.5">
          {Object.entries(entity.properties).map(([k, v]) => (
            <span key={k}>
              <span className="text-zinc-500">{k}:</span>{" "}
              <span className="text-zinc-300">{String(v)}</span>
            </span>
          ))}
        </div>
      )}
      {entity.memory && entity.memory.length > 0 && (
        <div className="text-[10px] text-zinc-500 border-t border-zinc-700 pt-1 mt-0.5">
          Last thought: <span className="text-zinc-400 italic">{entity.memory[entity.memory.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

function EnvironmentOverlay({ environment }: { environment: Record<string, unknown> }) {
  const weather = environment.weather as string | undefined;
  const effects: string[] = [];

  if (weather === "rain" || weather === "storm" || weather === "raining") {
    effects.push("rain");
  }
  if (weather === "storm") {
    effects.push("storm");
  }

  if (effects.length === 0 && Object.keys(environment).length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 rounded-lg overflow-hidden">
      {effects.includes("rain") && (
        <div className="absolute inset-0 bg-blue-500/8" />
      )}
      {effects.includes("storm") && (
        <div className="absolute inset-0 bg-purple-500/10 animate-pulse" />
      )}
    </div>
  );
}

function EnvironmentBadges({ environment }: { environment: Record<string, unknown> }) {
  const entries = Object.entries(environment).filter(([, v]) => v != null);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400"
        >
          {key}: {String(value)}
        </span>
      ))}
    </div>
  );
}

export default function Grid({ width, height, entities, environment }: GridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [cellSize, setCellSize] = useState(24);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function calcSize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const maxW = rect.width - 16;
      const maxH = rect.height - 60;
      const size = Math.max(Math.floor(Math.min(maxW / width, maxH / height)), 14);
      setCellSize(size);
    }
    calcSize();
    window.addEventListener("resize", calcSize);
    return () => window.removeEventListener("resize", calcSize);
  }, [width, height]);

  const entityMap = new Map<string, Entity[]>();
  for (const entity of entities) {
    const key = `${entity.position.x},${entity.position.y}`;
    if (!entityMap.has(key)) entityMap.set(key, []);
    entityMap.get(key)!.push(entity);
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center gap-2 w-full h-full">
      <EnvironmentBadges environment={environment} />
      <div
        className="grid border border-zinc-700 rounded-lg overflow-visible relative"
        style={{
          gridTemplateColumns: `repeat(${width}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${height}, ${cellSize}px)`,
        }}
      >
        <EnvironmentOverlay environment={environment} />

        {Array.from({ length: height }, (_, y) =>
          Array.from({ length: width }, (_, x) => {
            const key = `${x},${y}`;
            const cellEntities = entityMap.get(key) || [];
            const topEntity = cellEntities[0];
            const isThinking = topEntity?.status === "thinking";
            const isHovered = hoveredCell === key && cellEntities.length > 0;

            return (
              <div
                key={key}
                className={`
                  border border-zinc-800/50 flex items-center justify-center
                  transition-all duration-300 relative
                  ${isThinking ? "animate-pulse" : ""}
                  ${cellEntities.length > 0 ? "cursor-pointer z-30" : ""}
                  ${isHovered ? "ring-1 ring-zinc-500 z-40" : ""}
                `}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: topEntity
                    ? `${topEntity.color}20`
                    : "transparent",
                  fontSize: Math.max(cellSize * 0.5, 12),
                }}
                onMouseEnter={() => setHoveredCell(key)}
                onMouseLeave={() => setHoveredCell(null)}
              >
                {cellEntities.length === 1 && (
                  <span className="select-none">{cellEntities[0].emoji}</span>
                )}
                {cellEntities.length > 1 && (
                  <div
                    className="flex flex-wrap items-center justify-center gap-0 select-none"
                    style={{ fontSize: Math.max(cellSize * 0.35 / Math.ceil(Math.sqrt(cellEntities.length)), 8) }}
                  >
                    {cellEntities.slice(0, 4).map((e) => (
                      <span key={e.id} className="leading-none">{e.emoji}</span>
                    ))}
                    {cellEntities.length > 4 && (
                      <span className="text-[6px] text-zinc-400">+{cellEntities.length - 4}</span>
                    )}
                  </div>
                )}
                {isThinking && (
                  <span className="absolute top-0 right-0.5 text-[8px]">
                    💭
                  </span>
                )}

                {/* Identity Card Tooltip */}
                {isHovered && (
                  <div
                    className="absolute z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl px-3 py-2 min-w-[200px] max-w-[260px] pointer-events-none"
                    style={{
                      bottom: y < height / 2 ? "auto" : "calc(100% + 8px)",
                      top: y < height / 2 ? "calc(100% + 8px)" : "auto",
                      left: x < width / 2 ? "0" : "auto",
                      right: x >= width / 2 ? "0" : "auto",
                    }}
                  >
                    {cellEntities.map((entity) => (
                      <EntityCard key={entity.id} entity={entity} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="text-xs text-zinc-500">
        {width}x{height} grid · {entities.filter((e) => e.type === "agent").length} agents · {entities.length} entities
      </div>
    </div>
  );
}
