import { NextRequest, NextResponse } from "next/server";
import { getWorldState, setRunning, getStateVersion, resetWorldState } from "@/lib/world-state";

export async function GET() {
  return NextResponse.json({
    state: getWorldState(),
    version: getStateVersion(),
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json();

  switch (action) {
    case "start":
      setRunning(true);
      return NextResponse.json({ state: getWorldState(), message: "Simulation started" });
    case "stop":
      setRunning(false);
      return NextResponse.json({ state: getWorldState(), message: "Simulation stopped" });
    case "reset":
      resetWorldState();
      return NextResponse.json({ state: getWorldState(), message: "World reset" });
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
