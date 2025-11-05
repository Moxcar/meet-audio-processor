import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";
import { config } from "@/lib/config";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  
  try {
    const formData = await request.formData();
    const meetingUrl = formData.get("meetingUrl") as string;
    const language = (formData.get("language") as string) || config.transcription.defaultLanguage;
    const botName = (formData.get("botName") as string) || config.transcription.defaultBotName;
    const transcriptionType = (formData.get("transcriptionType") as string) || config.transcription.defaultType;
    const botPhotoFile = formData.get("botPhoto") as File | null;
    const socketId = (formData.get("socketId") as string) || null;

    if (!meetingUrl) {
      return NextResponse.json(
        { error: "Meeting URL is required" },
        { status: 400 }
      );
    }

    let imagePath: string | null = null;
    
    if (botPhotoFile) {
      const bytes = await botPhotoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Create temp file
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      tempFilePath = join(process.cwd(), "uploads", `bot-image-${uniqueSuffix}.jpg`);
      imagePath = tempFilePath;
      
      // Ensure uploads directory exists
      const uploadsDir = join(process.cwd(), "uploads");
      const { mkdir } = await import("fs/promises");
      try {
        await mkdir(uploadsDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
      
      await writeFile(tempFilePath, buffer);
      console.log("Image configured with automatic_video_output");
      console.log("Image size:", buffer.length, "bytes");
    }

    const botService = getBotService();
    const botConfig = botService.createBotConfigWithFile(
      meetingUrl,
      botName,
      transcriptionType,
      language,
      imagePath
    );

    console.log("🚀 CREATING BOT WITH IMAGE - Full Request Details:");
    console.log("📋 Bot Config:", JSON.stringify(botConfig, null, 2));
    console.log("🔑 API Key:", config.recallApiKey ? "Present" : "Missing");
    console.log(
      "🌐 Webhook URL:",
      `${config.webhookBaseUrl}/webhook/transcription`
    );
    console.log("📡 Request URL:", `${config.recallApiUrl}/bot`);

    // Convert image to base64 for storage
    let botPhotoUrl: string | null = null;
    if (botPhotoFile) {
      const bytes = await botPhotoFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      botPhotoUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }

    const templateId = formData.get("templateId") as string | null;

    const botResponse = await botService.createBot(botConfig, {
      botPhotoUrl: botPhotoUrl,
      templateId: templateId || undefined,
    });
    const botId = botResponse.id;

    // If socketId provided, register bot session to route events to this client
    if (socketId) {
      try {
        botService.addBotSession(botId, socketId, meetingUrl, "created");
        console.log(`🔗 Bot session registered: botId=${botId} -> socketId=${socketId}`);
      } catch (e) {
        console.error("Failed to register bot session with socketId:", e);
      }
    }

    // Clean up uploaded file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (error) {
        console.error("Error deleting temp file:", error);
      }
    }

    return NextResponse.json({
      botId: botId,
      status: "created",
      message: "Bot created successfully",
    });
  } catch (error: any) {
    console.error("❌ ERROR CREATING BOT WITH IMAGE:");
    console.error("🚨 Error Message:", error.message);
    console.error("📊 Error Response Status:", error.response?.status);
    console.error(
      "📄 Error Response Data:",
      JSON.stringify(error.response?.data, null, 2)
    );
    console.error("🔍 Full Error Object:", error);

    // Clean up uploaded file if it exists
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (unlinkError) {
        console.error("Error deleting uploaded file:", unlinkError);
      }
    }

    return NextResponse.json(
      {
        error: "Failed to create bot",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

