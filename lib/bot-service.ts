import axios from "axios";
import fs from "fs";
import { config } from "./config";
import { getBotRepository } from "./db/bot-repository";

export interface BotSession {
  socketId: string;
  meetingUrl: string;
  status: string;
}

export class BotService {
  private activeBots: Map<string, BotSession> = new Map();

  // Store active bot sessions
  getActiveBots(): Map<string, BotSession> {
    return this.activeBots;
  }

  // Add bot session
  addBotSession(botId: string, socketId: string, meetingUrl: string, status: string = "created"): void {
    this.activeBots.set(botId, {
      socketId,
      meetingUrl,
      status,
    });
  }

  // Get bot session
  getBotSession(botId: string): BotSession | undefined {
    return this.activeBots.get(botId);
  }

  // Update bot status
  updateBotStatus(botId: string, status: string): void {
    const session = this.activeBots.get(botId);
    if (session) {
      session.status = status;
    }

    // Update status in database
    const botRepository = getBotRepository();
    botRepository
      .updateBotStatus(botId, status)
      .then(() => {
        console.log(`✅ Bot status updated in database: ${botId} -> ${status}`);
      })
      .catch((error: any) => {
        console.error(
          `❌ Failed to update bot status in database: ${error.message}`
        );
      });
  }

  // Remove bot session
  removeBotSession(botId: string): void {
    this.activeBots.delete(botId);
  }

  // Clean up sessions for disconnected socket
  cleanupSocketSessions(socketId: string): void {
    for (const [botId, session] of this.activeBots.entries()) {
      if (session.socketId === socketId) {
        console.log(`Cleaning up bot session for bot: ${botId}`);
        this.activeBots.delete(botId);
      }
    }
  }

  // Configure transcription provider
  getTranscriptConfig(transcriptionType: string, language: string) {
    if (transcriptionType === "ai_transcription") {
      return {
        provider: {
          deepgram_streaming: {
            language: language === "auto" ? "en-US" : language,
            model: "nova-2",
          },
        },
        diarization: {
          use_separate_streams_when_available: true,
        },
      };
    } else {
      return {
        provider: {
          meeting_captions: {},
        },
      };
    }
  }

  // Create bot configuration
  createBotConfig(
    meetingUrl: string,
    botName: string,
    transcriptionType: string,
    language: string,
    botPhoto: string | null = null
  ) {
    const transcriptConfig = this.getTranscriptConfig(
      transcriptionType,
      language
    );

    const botConfig: any = {
      meeting_url: meetingUrl,
      bot_name: botName,
      recording_config: {
        transcript: transcriptConfig,
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${config.webhookBaseUrl}/webhook/transcription`,
            events: ["transcript.data"],
          },
        ],
      },
    };

    // Add automatic_video_output if bot photo is provided
    if (botPhoto) {
      botConfig.automatic_video_output = {
        in_call_recording: {
          kind: "jpeg",
          b64_data: botPhoto.replace(/^data:image\/jpeg;base64,/, ""),
        },
      };
    }

    return botConfig;
  }

  // Create bot with image file
  createBotConfigWithFile(
    meetingUrl: string,
    botName: string,
    transcriptionType: string,
    language: string,
    imagePath: string | null
  ) {
    const transcriptConfig = this.getTranscriptConfig(
      transcriptionType,
      language
    );

    const botConfig: any = {
      meeting_url: meetingUrl,
      bot_name: botName,
      recording_config: {
        transcript: transcriptConfig,
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${config.webhookBaseUrl}/webhook/transcription`,
            events: ["transcript.data"],
          },
        ],
      },
    };

    // Add automatic_video_output if image file is provided
    if (imagePath) {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString("base64");

      botConfig.automatic_video_output = {
        in_call_recording: {
          kind: "jpeg",
          b64_data: base64Image,
        },
      };
    }

    return botConfig;
  }

  // Create bot via Recall.ai API
  async createBot(
    botConfig: any,
    options?: {
      socketId?: string;
      templateId?: string;
      botPhotoUrl?: string | null;
    }
  ) {
    console.log("🚀 CREATING BOT - Full Request Details:");
    console.log("📋 Bot Config:", JSON.stringify(botConfig, null, 2));
    console.log("🔑 API Key:", config.recallApiKey ? "Present" : "Missing");
    console.log(
      "🌐 Webhook URL:",
      `${config.webhookBaseUrl}/webhook/transcription`
    );
    console.log("📡 Request URL:", `${config.recallApiUrl}/bot`);

    const response = await axios.post(`${config.recallApiUrl}/bot`, botConfig, {
      headers: {
        Authorization: `Token ${config.recallApiKey}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ BOT CREATED SUCCESSFULLY:");
    console.log("📊 Response Status:", response.status);
    console.log("📄 Response Data:", JSON.stringify(response.data, null, 2));

    const recallBotData = response.data;

    // Save bot to database
    try {
      const botRepository = getBotRepository();
      await botRepository.createBot({
        recall_bot_id: recallBotData.id,
        meeting_url: botConfig.meeting_url,
        bot_name: botConfig.bot_name,
        transcription_type: botConfig.recording_config?.transcript?.provider
          ?.deepgram_streaming
          ? "ai_transcription"
          : "meeting_captions",
        language:
          botConfig.recording_config?.transcript?.provider?.deepgram_streaming
            ?.language || "auto",
        bot_photo_url: options?.botPhotoUrl || null,
        status: "created",
        socket_id: options?.socketId || null,
        template_id: options?.templateId || null,
      });
      console.log("✅ Bot saved to database");
    } catch (error: any) {
      console.error("❌ Failed to save bot to database:", error.message);
      // Don't throw - we still want to return the bot data even if DB save fails
    }

    return recallBotData;
  }

  // Get bot status
  async getBotStatus(botId: string) {
    const response = await axios.get(`${config.recallApiUrl}/bot/${botId}`, {
      headers: {
        Authorization: `Token ${config.recallApiKey}`,
        "Content-Type": "application/json",
      },
    });

    const botData = response.data;

    // Update output_video_url in database if available
    if (botData.output_video) {
      try {
        const botRepository = getBotRepository();
        await botRepository.updateBotOutputVideo(botId, botData.output_video);
      } catch (error: any) {
        console.error(
          `❌ Failed to update bot output video in database: ${error.message}`
        );
      }
    }

    return botData;
  }

  // Send audio output to bot
  async sendBotAudioOutput(botId: string, audioBase64: string) {
    console.log("🔊 SENDING AUDIO OUTPUT TO BOT:", botId);
    console.log("📡 Request URL:", `${config.recallApiUrl}/bot/${botId}/output_audio/`);

    const payload = {
      kind: "mp3",
      b64_data: audioBase64,
    };

    const response = await axios.post(
      `${config.recallApiUrl}/bot/${botId}/output_audio/`,
      payload,
      {
        headers: {
          Authorization: `Token ${config.recallApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ AUDIO OUTPUT SENT SUCCESSFULLY:");
    console.log("📊 Response Status:", response.status);
    console.log("📄 Response Data:", JSON.stringify(response.data, null, 2));

    return response.data;
  }

  // Process transcript data format
  processTranscriptData(event: string, transcriptData: any) {
    let provider = "meeting_captions";

    if (transcriptData && transcriptData.participant && transcriptData.words) {
      provider = "deepgram_streaming";
    } else if (Array.isArray(transcriptData)) {
      provider = "meeting_captions";
    }

    return {
      type: event,
      data: transcriptData,
      transcript: transcriptData,
      timestamp: new Date().toISOString(),
      provider: provider,
    };
  }
}

// Singleton instance
let botServiceInstance: BotService | null = null;

export function getBotService(): BotService {
  if (!botServiceInstance) {
    botServiceInstance = new BotService();
  }
  return botServiceInstance;
}

