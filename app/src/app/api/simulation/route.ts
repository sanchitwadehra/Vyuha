import { NextRequest, NextResponse } from "next/server";
import { getWorldState, setRunning, resetWorldState } from "@/lib/world-state";

export async function GET() {
  return NextResponse.json({
    state: await getWorldState(),
  });
}

export async function POST(req: NextRequest) {
  const { action } = await req.json();

  switch (action) {
    case "start":
      await setRunning(true);
      return NextResponse.json({ state: await getWorldState(), message: "Simulation started" });
    case "stop":
      await setRunning(false);
      return NextResponse.json({ state: await getWorldState(), message: "Simulation stopped" });
    case "reset":
      await resetWorldState();
      return NextResponse.json({ state: await getWorldState(), message: "World reset" });
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
