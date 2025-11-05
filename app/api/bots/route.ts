import { NextRequest, NextResponse } from "next/server";
import { getBotRepository } from "@/lib/db/bot-repository";

export async function GET() {
  try {
    const botRepository = getBotRepository();
    const bots = await botRepository.getAllBots();

    return NextResponse.json(bots);
  } catch (error: any) {
    console.error("Error getting bots:", error);
    return NextResponse.json(
      {
        error: "Failed to get bots",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

