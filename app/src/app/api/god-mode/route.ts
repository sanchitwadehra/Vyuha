import { NextRequest, NextResponse } from "next/server";
import { callGodMode } from "@/lib/llm";
import { buildGodModePrompt } from "@/lib/god-mode-prompt";
import { getWorldState, applyMutations, addLogEntry } from "@/lib/world-state";
import { GodModeResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const state = getWorldState();
    const systemPrompt = buildGodModePrompt(state);

    const raw = await callGodMode(systemPrompt, message);

    let response: GodModeResponse;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      response = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response", raw },
        { status: 500 }
      );
    }

    // Ensure mutations is an array
    const mutations = Array.isArray(response.mutations) ? response.mutations : [];
    applyMutations(mutations);

    addLogEntry({
      message: `God Mode: ${message} → ${response.message}`,
      type: "god-mode",
    });

    return NextResponse.json({
      message: response.message,
      mutations: response.mutations,
      state: getWorldState(),
    });
  } catch (error) {
    console.error("God Mode error:", error);
    return NextResponse.json(
      { error: "God Mode failed", details: String(error) },
      { status: 500 }
    );
  }
}
