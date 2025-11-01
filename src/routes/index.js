const express = require("express");
const fs = require("fs");
const axios = require("axios");
const BotService = require("../services/BotService");
const { upload } = require("../middleware/upload");
const { config } = require("../config");

class RoutesHandler {
  constructor(socketHandler) {
    this.router = express.Router();
    this.socketHandler = socketHandler;
    this.botService = socketHandler.getBotService();
    this.setupRoutes();
  }

  setupRoutes() {
    // Note: Webhook endpoint is handled directly in server.js, not here

    // API endpoint to create bot with image upload
    this.router.post(
      "/api/bot/create-with-image",
      upload.single("botPhoto"),
      async (req, res) => {
        await this.handleCreateBotWithImage(req, res);
      }
    );

    // API endpoint to create bot
    this.router.post("/api/bot/create", async (req, res) => {
      await this.handleCreateBot(req, res);
    });

    // Health check endpoint
    this.router.get("/", (req, res) => {
      res.json({
        message: "Meet Audio Processor API",
        status: "running",
        timestamp: new Date().toISOString(),
        activeBots: this.botService.getActiveBots().size,
      });
    });

    // Debug endpoint to check bot status
    this.router.get("/debug/bots", (req, res) => {
      const botsInfo = Array.from(
        this.botService.getActiveBots().entries()
      ).map(([botId, session]) => ({
        botId,
        socketId: session.socketId,
        meetingUrl: session.meetingUrl,
        status: session.status,
        socketConnected: this.socketHandler.io.sockets.sockets.has(
          session.socketId
        ),
      }));

      const connectedSockets = Array.from(
        this.socketHandler.io.sockets.sockets.keys()
      );

      res.json({
        activeBots: botsInfo,
        totalBots: this.botService.getActiveBots().size,
        connectedSockets: connectedSockets,
        totalConnectedSockets: connectedSockets.length,
      });
    });

    // Endpoint to clean up orphaned bot sessions
    this.router.post("/debug/cleanup", (req, res) => {
      const initialSize = this.botService.getActiveBots().size;
      const connectedSockets = Array.from(
        this.socketHandler.io.sockets.sockets.keys()
      );

      // Remove sessions for disconnected sockets
      for (const [botId, session] of this.botService
        .getActiveBots()
        .entries()) {
        if (!connectedSockets.includes(session.socketId)) {
          console.log(`Removing orphaned session for bot: ${botId}`);
          this.botService.removeBotSession(botId);
        }
      }

      const cleanedSize = this.botService.getActiveBots().size;

      res.json({
        message: "Cleanup completed",
        initialSessions: initialSize,
        remainingSessions: cleanedSize,
        removedSessions: initialSize - cleanedSize,
      });
    });

    // Endpoint to check bot status and output video
    this.router.get("/api/bot/:botId/status", async (req, res) => {
      await this.handleGetBotStatus(req, res);
    });

    // Endpoint to send transcript to n8n webhook
    this.router.post("/api/send-to-n8n", async (req, res) => {
      await this.handleSendToN8n(req, res);
    });

    // Test endpoint to verify webhook is working
    this.router.post("/test-webhook", (req, res) => {
      console.log("=== TEST WEBHOOK RECEIVED ===");
      console.log("Body:", JSON.stringify(req.body, null, 2));
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("=============================");
      res.json({ status: "success", message: "Test webhook received" });
    });

    // Test endpoint to simulate transcript webhook
    this.router.post("/test-transcript-webhook", (req, res) => {
      console.log("=== TEST TRANSCRIPT WEBHOOK ===");

      // Simulate a transcript webhook
      const mockWebhookData = {
        event: "transcript.partial_data",
        data: {
          bot: {
            id: req.body.botId || "test-bot-id",
          },
          data: {
            participant: {
              id: 100,
              name: "Test Speaker",
            },
            words: [
              {
                text: "Hola",
                start_timestamp: {
                  relative: 1.0,
                  absolute: "2025-10-29T05:00:00.000Z",
                },
                end_timestamp: {
                  relative: 1.5,
                  absolute: "2025-10-29T05:00:00.500Z",
                },
              },
              {
                text: "mundo",
                start_timestamp: {
                  relative: 1.5,
                  absolute: "2025-10-29T05:00:00.500Z",
                },
                end_timestamp: {
                  relative: 2.0,
                  absolute: "2025-10-29T05:00:01.000Z",
                },
              },
            ],
          },
        },
      };

      // Process the mock webhook
      this.socketHandler.handleTranscriptionData(
        mockWebhookData.data.bot.id,
        mockWebhookData.event,
        mockWebhookData.data.data
      );

      res.json({
        status: "success",
        message: "Test transcript webhook processed",
      });
    });

    // Endpoint to get final transcript from bot
    this.router.get("/api/bot/:botId/transcript", async (req, res) => {
      await this.handleGetBotTranscript(req, res);
    });
  }

  // Handle bot creation with image upload
  async handleCreateBotWithImage(req, res) {
    try {
      const {
        meetingUrl,
        language = config.transcription.defaultLanguage,
        botName = config.transcription.defaultBotName,
        transcriptionType = config.transcription.defaultType,
      } = req.body;
      const botPhotoFile = req.file;

      if (!meetingUrl) {
        return res.status(400).json({ error: "Meeting URL is required" });
      }

      const botConfig = this.botService.createBotConfigWithFile(
        meetingUrl,
        botName,
        transcriptionType,
        language,
        botPhotoFile?.path
      );

      if (botPhotoFile) {
        console.log("Image configured with automatic_video_output");
        console.log(
          "Image size:",
          fs.readFileSync(botPhotoFile.path).length,
          "bytes"
        );
      }

      console.log("🚀 CREATING BOT WITH IMAGE - Full Request Details:");
      console.log("📋 Bot Config:", JSON.stringify(botConfig, null, 2));
      console.log("🔑 API Key:", config.recallApiKey ? "Present" : "Missing");
      console.log(
        "🌐 Webhook URL:",
        `${config.webhookBaseUrl}/webhook/transcription`
      );
      console.log("📡 Request URL:", `${config.recallApiUrl}/bot`);

      const botResponse = await this.botService.createBot(botConfig);
      const botId = botResponse.id;

      // Clean up uploaded file
      if (botPhotoFile) {
        fs.unlinkSync(botPhotoFile.path);
      }

      res.json({
        botId: botId,
        status: "created",
        message: "Bot created successfully",
      });
    } catch (error) {
      console.error("❌ ERROR CREATING BOT WITH IMAGE:");
      console.error("🚨 Error Message:", error.message);
      console.error("📊 Error Response Status:", error.response?.status);
      console.error(
        "📄 Error Response Data:",
        JSON.stringify(error.response?.data, null, 2)
      );
      console.error("🔍 Full Error Object:", error);

      res.status(500).json({
        error: "Failed to create bot",
        details: error.response?.data || error.message,
      });
    }
  }

  // Handle bot creation via API
  async handleCreateBot(req, res) {
    try {
      const {
        meetingUrl,
        language = config.transcription.defaultLanguage,
        botName = config.transcription.defaultBotName,
        botPhoto,
        transcriptionType = config.transcription.defaultType,
      } = req.body;

      if (!meetingUrl) {
        return res.status(400).json({ error: "Meeting URL is required" });
      }

      const botConfig = this.botService.createBotConfig(
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

      const botResponse = await this.botService.createBot(botConfig);
      const botId = botResponse.id;

      res.json({
        botId: botId,
        status: "created",
        message: "Bot created successfully",
      });
    } catch (error) {
      console.error("❌ ERROR CREATING BOT (API):");
      console.error("🚨 Error Message:", error.message);
      console.error("📊 Error Response Status:", error.response?.status);
      console.error(
        "📄 Error Response Data:",
        JSON.stringify(error.response?.data, null, 2)
      );
      console.error("🔍 Full Error Object:", error);

      res.status(500).json({
        error: "Failed to create bot",
        details: error.response?.data || error.message,
      });
    }
  }

  // Handle get bot status
  async handleGetBotStatus(req, res) {
    try {
      const { botId } = req.params;
      const botData = await this.botService.getBotStatus(botId);

      res.json({
        botId: botId,
        status: botData.status,
        outputVideo: botData.output_video,
        hasOutputVideo: !!botData.output_video,
        botData: botData,
      });
    } catch (error) {
      console.error("Error getting bot status:", error);
      res.status(500).json({
        error: "Failed to get bot status",
        details: error.response?.data || error.message,
      });
    }
  }

  // Handle getting final transcript from bot
  async handleGetBotTranscript(req, res) {
    try {
      const { botId } = req.params;
      const botData = await this.botService.getBotStatus(botId);

      if (!botData.recordings || botData.recordings.length === 0) {
        return res.status(404).json({
          error: "No recordings found for this bot",
          botId: botId,
        });
      }

      const latestRecording = botData.recordings[botData.recordings.length - 1];

      if (
        !latestRecording.media_shortcuts?.transcript ||
        latestRecording.media_shortcuts.transcript.status.code !== "done"
      ) {
        return res.status(404).json({
          error: "Transcript not ready yet",
          status:
            latestRecording.media_shortcuts?.transcript?.status?.code ||
            "unknown",
        });
      }

      // Download transcript from Recall.ai
      const transcriptUrl =
        latestRecording.media_shortcuts.transcript.data.download_url;
      const transcriptResponse = await axios.get(transcriptUrl);

      res.json({
        botId: botId,
        transcript: transcriptResponse.data,
        recordingId: latestRecording.id,
        status: "success",
      });
    } catch (error) {
      console.error("Error getting bot transcript:", error);
      res.status(500).json({
        error: "Failed to get bot transcript",
        details: error.response?.data || error.message,
      });
    }
  }

  // Handle sending transcript to n8n webhook
  async handleSendToN8n(req, res) {
    try {
      const { transcript_data, meeting_url, total_interventions, timestamp } =
        req.body;

      if (!transcript_data || transcript_data.length === 0) {
        return res.status(400).json({ error: "No transcript data to send" });
      }

      // Check if N8N_WEBHOOK_URL is configured
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      if (!n8nWebhookUrl) {
        return res.status(500).json({
          error: "N8N_WEBHOOK_URL environment variable is not configured",
        });
      }

      // Prepare payload for n8n
      const payload = {
        timestamp,
        meeting_url,
        total_interventions,
        transcript_data,
        source: "meet-audio-processor",
        processed_at: new Date().toISOString(),
      };

      console.log("📤 Sending transcript to n8n webhook:", n8nWebhookUrl);
      console.log(
        "📊 Payload size:",
        JSON.stringify(payload).length,
        "characters"
      );

      // Send to n8n webhook
      const response = await axios.post(n8nWebhookUrl, payload, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 seconds timeout
      });

      console.log(
        "✅ Successfully sent to n8n. Response status:",
        response.status
      );

      res.json({
        success: true,
        message: "Transcript sent to n8n successfully",
        n8n_response_status: response.status,
        total_interventions: total_interventions,
      });
    } catch (error) {
      console.error("❌ Error sending to n8n:", error.message);

      if (error.response) {
        console.error("📊 n8n Response Status:", error.response.status);
        console.error("📄 n8n Response Data:", error.response.data);
      }

      res.status(500).json({
        error: "Failed to send transcript to n8n",
        details: error.response?.data || error.message,
      });
    }
  }

  // Get router instance
  getRouter() {
    return this.router;
  }
}

module.exports = RoutesHandler;
