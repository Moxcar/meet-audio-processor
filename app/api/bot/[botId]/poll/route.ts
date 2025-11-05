import { NextRequest, NextResponse } from "next/server";
import { getBotRepository } from "@/lib/db/bot-repository";
import { getInterventionRepository } from "@/lib/db/intervention-repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const { searchParams } = new URL(request.url);
    const lastTimestamp = searchParams.get("lastTimestamp");
    
    // Get bot information - try by UUID first, then by recall_bot_id
    const botRepository = getBotRepository();
    let bot = await botRepository.getBotById(botId);
    
    if (!bot) {
      bot = await botRepository.getBotByRecallId(botId);
    }
    
    if (!bot) {
      return NextResponse.json(
        { error: "Bot not found" },
        { status: 404 }
      );
    }

    // Get interventions since last timestamp
    const interventionRepository = getInterventionRepository();
    let interventions;
    
    if (lastTimestamp) {
      interventions = await interventionRepository.getInterventionsByBotIdAfterTimestamp(
        bot.id,
        lastTimestamp
      );
    } else {
      // Get all interventions
      interventions = await interventionRepository.getInterventionsByBotId(bot.id);
    }

    // Get latest intervention timestamp
    const latestTimestamp = interventions.length > 0
      ? interventions[interventions.length - 1].timestamp
      : lastTimestamp || bot.created_at;

    return NextResponse.json({
      bot: {
        id: bot.id,
        recall_bot_id: bot.recall_bot_id,
        status: bot.status,
        meeting_url: bot.meeting_url,
        bot_name: bot.bot_name,
      },
      interventions: interventions.map((i) => ({
        id: i.id,
        participant: {
          name: i.participant_name,
          id: i.participant_id,
        },
        text: i.text,
        timestamp: i.timestamp,
        isPartial: i.is_partial,
      })),
      lastTimestamp: latestTimestamp,
    });
  } catch (error: any) {
    console.error("Error polling bot:", error);
    return NextResponse.json(
      {
        error: "Failed to poll bot",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

