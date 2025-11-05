import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const body = await request.json();
    const { b64_data } = body;

    if (!b64_data) {
      return NextResponse.json(
        { error: "b64_data is required" },
        { status: 400 }
      );
    }

    // Send audio to Recall.ai
    const botService = getBotService();
    const result = await botService.sendBotAudioOutput(botId, b64_data);

    return NextResponse.json({
      botId: botId,
      status: "success",
      message: "Audio sent to bot successfully",
      result: result,
    });
  } catch (error: any) {
    console.error("Error sending audio to bot:", error);
    return NextResponse.json(
      {
        error: "Failed to send audio to bot",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

