import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const botService = getBotService();
    const botData = await botService.getBotStatus(botId);

    return NextResponse.json({
      botId: botId,
      status: botData.status,
      outputVideo: botData.output_video,
      hasOutputVideo: !!botData.output_video,
      botData: botData,
    });
  } catch (error: any) {
    console.error("Error getting bot status:", error);
    return NextResponse.json(
      {
        error: "Failed to get bot status",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

