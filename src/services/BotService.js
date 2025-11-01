const axios = require("axios");
const fs = require("fs");
const { config } = require("../config");

class BotService {
  constructor() {
    this.activeBots = new Map();
  }

  // Store active bot sessions
  getActiveBots() {
    return this.activeBots;
  }

  // Add bot session
  addBotSession(botId, socketId, meetingUrl, status = "created") {
    this.activeBots.set(botId, {
      socketId: socketId,
      meetingUrl: meetingUrl,
      status: status,
    });
  }

  // Get bot session
  getBotSession(botId) {
    return this.activeBots.get(botId);
  }

  // Update bot status
  updateBotStatus(botId, status) {
    const session = this.activeBots.get(botId);
    if (session) {
      session.status = status;
    }
  }

  // Remove bot session
  removeBotSession(botId) {
    this.activeBots.delete(botId);
  }

  // Clean up sessions for disconnected socket
  cleanupSocketSessions(socketId) {
    for (const [botId, session] of this.activeBots.entries()) {
      if (session.socketId === socketId) {
        console.log(`Cleaning up bot session for bot: ${botId}`);
        this.activeBots.delete(botId);
      }
    }
  }

  // Configure transcription provider
  getTranscriptConfig(transcriptionType, language) {
    if (transcriptionType === "ai_transcription") {
      return {
        provider: {
          deepgram_streaming: {
            language: language === "auto" ? "en-US" : language,
            model: "nova-2", // Use nova-2 for better multilingual support
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
    meetingUrl,
    botName,
    transcriptionType,
    language,
    botPhoto = null
  ) {
    const transcriptConfig = this.getTranscriptConfig(
      transcriptionType,
      language
    );

    const botConfig = {
      meeting_url: meetingUrl,
      bot_name: botName,
      recording_config: {
        transcript: transcriptConfig,
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${config.webhookBaseUrl}/webhook/transcription`,
            events: ["transcript.data"],
            // events: ["transcript.data", "transcript.partial_data"],
          },
        ],
      },
    };

    // Add automatic_video_output if bot photo is provided
    if (botPhoto) {
      botConfig.automatic_video_output = {
        in_call_recording: {
          kind: "jpeg",
          b64_data: botPhoto.replace(/^data:image\/jpeg;base64,/, ""), // Remove data URL prefix
        },
      };
    }

    return botConfig;
  }

  // Create bot with image file
  createBotConfigWithFile(
    meetingUrl,
    botName,
    transcriptionType,
    language,
    imagePath
  ) {
    const transcriptConfig = this.getTranscriptConfig(
      transcriptionType,
      language
    );

    const botConfig = {
      meeting_url: meetingUrl,
      bot_name: botName,
      recording_config: {
        transcript: transcriptConfig,
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${config.webhookBaseUrl}/webhook/transcription`,
            events: ["transcript.data"],
            // events: ["transcript.data", "transcript.partial_data"],
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
  async createBot(botConfig) {
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

    return response.data;
  }

  // Get bot status
  async getBotStatus(botId) {
    const response = await axios.get(`${config.recallApiUrl}/bot/${botId}`, {
      headers: {
        Authorization: `Token ${config.recallApiKey}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  }

  // Process transcript data format
  processTranscriptData(event, transcriptData) {
    // Determine provider based on data structure
    let provider = "meeting_captions"; // Default

    // Deepgram data has participant and words at the same level
    if (transcriptData && transcriptData.participant && transcriptData.words) {
      provider = "deepgram_streaming";
    }
    // Meeting captions data is usually an array of participants
    else if (Array.isArray(transcriptData)) {
      provider = "meeting_captions";
    }

    return {
      type: event,
      data: transcriptData,
      transcript: transcriptData, // Keep for backward compatibility
      timestamp: new Date().toISOString(),
      provider: provider,
    };
  }
}

module.exports = BotService;
