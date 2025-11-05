import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";
import axios from "axios";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const botService = getBotService();
    const botData = await botService.getBotStatus(botId);

    if (!botData.recordings || botData.recordings.length === 0) {
      return NextResponse.json(
        {
          error: "No recordings found for this bot",
          botId: botId,
        },
        { status: 404 }
      );
    }

    const latestRecording = botData.recordings[botData.recordings.length - 1];

    if (
      !latestRecording.media_shortcuts?.transcript ||
      latestRecording.media_shortcuts.transcript.status.code !== "done"
    ) {
      return NextResponse.json(
        {
          error: "Transcript not ready yet",
          status:
            latestRecording.media_shortcuts?.transcript?.status?.code ||
            "unknown",
        },
        { status: 404 }
      );
    }

    // Download transcript from Recall.ai
    const transcriptUrl =
      latestRecording.media_shortcuts.transcript.data.download_url;
    const transcriptResponse = await axios.get(transcriptUrl);

    return NextResponse.json({
      botId: botId,
      transcript: transcriptResponse.data,
      recordingId: latestRecording.id,
      status: "success",
    });
  } catch (error: any) {
    console.error("Error getting bot transcript:", error);
    return NextResponse.json(
      {
        error: "Failed to get bot transcript",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

