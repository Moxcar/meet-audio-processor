import { NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";

export async function GET() {
  const botService = getBotService();
  
  return NextResponse.json({
    message: "Meet Audio Processor API",
    status: "running",
    timestamp: new Date().toISOString(),
    activeBots: botService.getActiveBots().size,
  });
}

