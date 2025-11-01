const BotService = require("../services/BotService");
const { config } = require("../config");

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.botService = new BotService();
  }

  // Initialize socket event handlers
  initialize() {
    this.io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        this.botService.cleanupSocketSessions(socket.id);
      });

      socket.on("create-bot", async (data) => {
        await this.handleCreateBot(socket, data);
      });
    });
  }

  // Handle bot creation via WebSocket
  async handleCreateBot(socket, data) {
    try {
      const {
        meetingUrl,
        language = config.transcription.defaultLanguage,
        botName = config.transcription.defaultBotName,
        botPhoto,
        transcriptionType = config.transcription.defaultType,
      } = data;

      console.log(
        "Creating bot for meeting:",
        meetingUrl,
        "with language:",
        language,
        "name:",
        botName,
        "transcription type:",
        transcriptionType
      );

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

      const botResponse = await this.botService.createBot(botConfig);
      const botId = botResponse.id;

      this.botService.addBotSession(botId, socket.id, meetingUrl, "created");

      socket.emit("bot-created", {
        botId: botId,
        status: "created",
        message: "Bot created successfully",
      });

      console.log("Bot created:", botId);
      console.log(
        "Active bots after creation:",
        Array.from(this.botService.getActiveBots().keys())
      );
      console.log("Bot session stored:", this.botService.getBotSession(botId));
    } catch (error) {
      console.error("❌ ERROR CREATING BOT:");
      console.error("🚨 Error Message:", error.message);
      console.error("📊 Error Response Status:", error.response?.status);
      console.error(
        "📄 Error Response Data:",
        JSON.stringify(error.response?.data, null, 2)
      );
      console.error("🔍 Full Error Object:", error);

      socket.emit("bot-error", {
        message: "Failed to create bot",
        error: error.response?.data || error.message,
      });
    }
  }

  // Handle bot status updates
  handleBotStatusUpdate(botId, status) {
    const botSession = this.botService.getBotSession(botId);

    console.log(`Updating bot status: botId=${botId}, status=${status}`);
    console.log("Bot session found:", !!botSession);

    if (botSession) {
      // Update the bot status in the session
      botSession.status = status;
      this.botService.updateBotStatus(botId, status);

      this.io.to(botSession.socketId).emit("bot-status", {
        botId: botId,
        status: status,
      });
      console.log(`Bot status update sent to socket: ${botSession.socketId}`);
    } else {
      console.log(`No bot session found for botId: ${botId}`);
      console.log(
        "Available bot sessions:",
        Array.from(this.botService.getActiveBots().keys())
      );
    }
  }

  // Handle transcription data
  handleTranscriptionData(botId, event, transcriptData) {
    const botSession = this.botService.getBotSession(botId);

    console.log(`Transcription event: ${event} for bot: ${botId}`);
    console.log("Transcript data:", JSON.stringify(transcriptData, null, 2));
    console.log("Looking for bot session:", botId);
    console.log(
      "Available bot sessions:",
      Array.from(this.botService.getActiveBots().entries())
    );

    // Debug: Check data structure to determine provider
    console.log("Data structure analysis:");
    console.log("- Has participant:", !!transcriptData?.participant);
    console.log("- Has words:", !!transcriptData?.words);
    console.log("- Is array:", Array.isArray(transcriptData));
    console.log(
      "- Keys:",
      transcriptData ? Object.keys(transcriptData) : "null"
    );

    const processedTranscript = this.botService.processTranscriptData(
      event,
      transcriptData
    );

    if (botSession) {
      console.log(`Sending transcription to socket: ${botSession.socketId}`);

      // Check if socket is still connected
      const socketExists = this.io.sockets.sockets.has(botSession.socketId);
      if (socketExists) {
        this.io
          .to(botSession.socketId)
          .emit("transcription", processedTranscript);
        console.log("Transcription sent successfully");
      } else {
        console.log(`Socket ${botSession.socketId} is no longer connected`);
        // Try to find any connected socket and broadcast to all
        this.io.emit("transcription", processedTranscript);
        console.log("Broadcasting to all connected clients");
      }
    } else {
      console.log(`No active session found for bot: ${botId}`);
      console.log(
        "Active bots:",
        Array.from(this.botService.getActiveBots().keys())
      );

      // Try to broadcast to all connected clients as fallback
      console.log("Broadcasting to all connected clients as fallback");
      this.io.emit("transcription", processedTranscript);
      console.log("Fallback broadcast completed");
    }
  }

  // Get bot service instance
  getBotService() {
    return this.botService;
  }
}

module.exports = SocketHandler;
