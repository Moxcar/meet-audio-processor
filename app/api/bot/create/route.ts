import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";
import { config } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      meetingUrl,
      language = config.transcription.defaultLanguage,
      botName = config.transcription.defaultBotName,
      botPhoto,
      transcriptionType = config.transcription.defaultType,
    } = body;

    if (!meetingUrl) {
      return NextResponse.json(
        { error: "Meeting URL is required" },
        { status: 400 }
      );
    }

    const botService = getBotService();
    const botConfig = botService.createBotConfig(
      meetingUrl,
      botName,
      transcriptionType,
      language,
      botPhoto
    );

    if (botPhoto) {
      console.log("Image configured with automatic_video_output");
    }

    console.log("🚀 CREATING BOT (API) - Full Request Details:");
    console.log("📋 Bot Config:", JSON.stringify(botConfig, null, 2));
    console.log("🔑 API Key:", config.recallApiKey ? "Present" : "Missing");
    console.log(
      "🌐 Webhook URL:",
      `${config.webhookBaseUrl}/webhook/transcription`
    );
    console.log("📡 Request URL:", `${config.recallApiUrl}/bot`);

    const botResponse = await botService.createBot(botConfig, {
      botPhotoUrl: botPhoto ? `data:image/jpeg;base64,${botPhoto}` : null,
      templateId: body.templateId || undefined,
    });
    const botId = botResponse.id;

    return NextResponse.json({
      botId: botId,
      status: "created",
      message: "Bot created successfully",
    });
  } catch (error: any) {
    console.error("❌ ERROR CREATING BOT (API):");
    console.error("🚨 Error Message:", error.message);
    console.error("📊 Error Response Status:", error.response?.status);
    console.error(
      "📄 Error Response Data:",
      JSON.stringify(error.response?.data, null, 2)
    );
    console.error("🔍 Full Error Object:", error);

    return NextResponse.json(
      {
        error: "Failed to create bot",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

