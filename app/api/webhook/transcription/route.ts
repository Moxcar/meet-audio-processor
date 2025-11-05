import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";
import { getSocketHandler } from "@/lib/socket-handler";
import { getBotRepository } from "@/lib/db/bot-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, data } = body;
    
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Event:", event);
    console.log("Bot ID:", data?.bot?.id);
    console.log("Status:", data?.status);
    console.log("Has transcript data:", !!data?.data);
    console.log("Webhook data:", JSON.stringify(data, null, 2));
    console.log("=========================");

    const socketHandler = getSocketHandler();
    const botService = getBotService();

    if (event === "bot.status_change") {
      const botId = data.bot?.id;
      const status = data.status;

      console.log(`Bot status change event: botId=${botId}, status=${status}`);

      if (botId && status) {
        // Update status in database
        try {
          const botRepository = getBotRepository();
          await botRepository.updateBotStatus(botId, status);
          console.log(`✅ Bot status updated in database: ${botId} -> ${status}`);
        } catch (error: any) {
          console.error(`❌ Failed to update bot status in database: ${error.message}`);
        }
        
        socketHandler.handleBotStatusUpdate(botId, status);
        console.log(`Bot ${botId} status changed to: ${status}`);
      } else {
        console.log(`Missing botId or status: botId=${botId}, status=${status}`);
      }
    }

    if (event === "transcript.data" || event === "transcript.partial_data") {
      const botId = data.bot?.id;
      const transcriptData = data.data;

      console.log(`Transcription event: ${event} for bot: ${botId}`);
      console.log("Transcript data:", JSON.stringify(transcriptData, null, 2));
      console.log("Looking for bot session:", botId);
      console.log(
        "Available bot sessions:",
        Array.from(botService.getActiveBots().entries())
      );

      if (botId && transcriptData) {
        await socketHandler.handleTranscriptionData(botId, event, transcriptData);
      } else {
        console.log(
          `Missing botId or transcriptData: botId=${botId}, transcriptData=${!!transcriptData}`
        );
      }
    }

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

