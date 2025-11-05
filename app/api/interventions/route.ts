import { NextRequest, NextResponse } from "next/server";
import { getInterventionRepository } from "@/lib/db/intervention-repository";
import { getBotRepository } from "@/lib/db/bot-repository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get("botId");
    const recallBotId = searchParams.get("recallBotId");

    if (!botId && !recallBotId) {
      return NextResponse.json(
        { error: "botId or recallBotId is required" },
        { status: 400 }
      );
    }

    const interventionRepository = getInterventionRepository();
    let interventions;

    if (botId) {
      interventions = await interventionRepository.getInterventionsByBotId(botId);
    } else if (recallBotId) {
      // Get bot by recall_bot_id first
      const botRepository = getBotRepository();
      const bot = await botRepository.getBotByRecallId(recallBotId);
      
      if (!bot) {
        return NextResponse.json(
          { error: "Bot not found" },
          { status: 404 }
        );
      }

      interventions = await interventionRepository.getInterventionsByBotId(bot.id);
    } else {
      return NextResponse.json(
        { error: "botId or recallBotId is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(interventions);
  } catch (error: any) {
    console.error("Error getting interventions:", error);
    return NextResponse.json(
      {
        error: "Failed to get interventions",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      recall_bot_id,
      bot_id,
      participant_name,
      participant_id,
      text,
      timestamp,
      is_partial,
      provider,
    } = body;

    if (!text || !timestamp || !participant_name) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["text", "timestamp", "participant_name"],
        },
        { status: 400 }
      );
    }

    let finalBotId: string;

    if (bot_id) {
      finalBotId = bot_id;
    } else if (recall_bot_id) {
      // Get bot by recall_bot_id first
      const botRepository = getBotRepository();
      const bot = await botRepository.getBotByRecallId(recall_bot_id);

      if (!bot) {
        return NextResponse.json(
          { error: "Bot not found" },
          { status: 404 }
        );
      }

      finalBotId = bot.id;
    } else {
      return NextResponse.json(
        {
          error: "bot_id or recall_bot_id is required",
        },
        { status: 400 }
      );
    }

    const interventionRepository = getInterventionRepository();
    const intervention = await interventionRepository.createIntervention({
      bot_id: finalBotId,
      participant_name,
      participant_id: participant_id || 0,
      text,
      timestamp,
      is_partial: is_partial ?? false,
      provider:
        provider === "deepgram_streaming"
          ? "deepgram_streaming"
          : "meeting_captions",
    });

    return NextResponse.json(intervention, { status: 201 });
  } catch (error: any) {
    console.error("Error creating intervention:", error);
    return NextResponse.json(
      {
        error: "Failed to create intervention",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

