import { NextRequest, NextResponse } from "next/server";
import { getBotRepository } from "@/lib/db/bot-repository";
import { getInterventionRepository } from "@/lib/db/intervention-repository";
import axios from "axios";
import FormDataLib from "form-data";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    
    // Get bot information - try by UUID first, then by recall_bot_id
    const botRepository = getBotRepository();
    let bot = await botRepository.getBotById(botId);
    
    // If not found by UUID, try by recall_bot_id
    if (!bot) {
      bot = await botRepository.getBotByRecallId(botId);
    }
    
    if (!bot) {
      return NextResponse.json(
        { error: "Bot not found" },
        { status: 404 }
      );
    }

    // Get all interventions for this bot (excluding partial ones)
    // Use bot.id (UUID) not botId parameter, as interventions are linked by bot.id
    const interventionRepository = getInterventionRepository();
    const interventions = await interventionRepository.getFinalizedInterventionsByBotId(bot.id);

    if (!interventions || interventions.length === 0) {
      return NextResponse.json(
        { error: "No transcript data found for this bot" },
        { status: 400 }
      );
    }

    // Format interventions for n8n
    const transcriptData = interventions.map((intervention) => ({
      speaker: intervention.participant_name,
      participant_id: intervention.participant_id,
      text: intervention.text,
      timestamp: intervention.timestamp,
      provider: intervention.provider,
    }));

    // Check if N8N_WEBHOOK_URL is configured
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      return NextResponse.json(
        {
          error: "N8N_WEBHOOK_URL environment variable is not configured",
        },
        { status: 500 }
      );
    }

    // Build multipart/form-data with a file
    const form = new FormDataLib();

    // Prepare file buffer (JSON file)
    const fileBuffer = Buffer.from(
      JSON.stringify({ transcript_data: transcriptData }, null, 2),
      "utf-8"
    );

    form.append("file", fileBuffer, {
      filename: `transcript-${bot.bot_name}-${botId}.json`,
      contentType: "application/json",
    });

    // Add metadata as form fields
    form.append("timestamp", new Date().toISOString());
    form.append("meeting_url", bot.meeting_url);
    form.append("bot_name", bot.bot_name);
    form.append("bot_id", botId);
    form.append("recall_bot_id", bot.recall_bot_id);
    form.append("total_interventions", String(interventions.length));
    form.append("source", "meet-audio-processor");
    form.append("processed_at", new Date().toISOString());
    form.append("call_started_at", bot.call_started_at || "");
    form.append("call_ended_at", bot.call_ended_at || "");

    console.log("📤 Sending transcript file to n8n webhook:", n8nWebhookUrl);
    console.log("📄 File name:", `transcript-${bot.bot_name}-${botId}.json`);
    console.log("📊 File size:", fileBuffer.length, "bytes");
    console.log("📝 Total interventions:", interventions.length);

    // Send to n8n webhook as multipart/form-data
    const response = await axios.post(n8nWebhookUrl, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 30000, // 30 seconds timeout
    });

    console.log(
      "✅ Successfully sent to n8n. Response status:",
      response.status
    );

    return NextResponse.json({
      success: true,
      message: "Transcript sent to n8n successfully",
      n8n_response_status: response.status,
      total_interventions: interventions.length,
      bot_id: botId,
    });
  } catch (error: any) {
    console.error("❌ Error sending to n8n:", error.message);

    let errorDetails = error.message;
    
    if (error.response) {
      console.error("📊 n8n Response Status:", error.response.status);
      console.error("📄 n8n Response Data:", error.response.data);
      
      // Handle different response types from n8n
      if (typeof error.response.data === 'string') {
        if (error.response.data.includes('<!DOCTYPE')) {
          errorDetails = `n8n webhook returned HTML error page (status ${error.response.status}). Please check the webhook URL configuration.`;
        } else {
          errorDetails = error.response.data.substring(0, 200);
        }
      } else if (error.response.data && typeof error.response.data === 'object') {
        errorDetails = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
      } else {
        errorDetails = `HTTP ${error.response.status}: ${error.response.statusText || 'Unknown error'}`;
      }
    }

    return NextResponse.json(
      {
        error: "Failed to send transcript to n8n",
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}

