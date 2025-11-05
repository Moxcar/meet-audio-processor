import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  let tempFilePath: string | null = null;
  
  try {
    const { botId } = await params;
    const formData = await request.formData();
    const audioFile = formData.get("audioFile") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    // Read audio file and convert to base64
    const bytes = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(bytes);
    const audioBase64 = audioBuffer.toString("base64");

    // Send audio to Recall.ai
    const botService = getBotService();
    const result = await botService.sendBotAudioOutput(botId, audioBase64);

    return NextResponse.json({
      botId: botId,
      status: "success",
      message: "Audio sent to bot successfully",
      result: result,
    });
  } catch (error: any) {
    console.error("Error sending audio to bot:", error);

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
        error: "Failed to send audio to bot",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

