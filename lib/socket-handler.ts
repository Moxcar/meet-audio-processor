import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { getBotService } from "./bot-service";
import { config } from "./config";
import { getBotRepository } from "./db/bot-repository";
import { getInterventionRepository } from "./db/intervention-repository";

export class SocketHandler {
  private io: SocketIOServer | null = null;
  private botService = getBotService();

  // Initialize Socket.IO server
  initialize(server: HTTPServer) {
    const { Server } = require("socket.io");
    this.io = new Server(server, config.socketIo);

    if (!this.io) return this.io;

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

    return this.io;
  }

  // Set Socket.IO instance (for use with existing server)
  setIO(io: SocketIOServer) {
    this.io = io;
  }

  // Get Socket.IO instance
  getIO(): SocketIOServer | null {
    return this.io;
  }

  // Handle bot creation via WebSocket
  async handleCreateBot(socket: any, data: any) {
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
    } catch (error: any) {
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
  handleBotStatusUpdate(botId: string, status: string) {
    const botSession = this.botService.getBotSession(botId);

    console.log(`Updating bot status: botId=${botId}, status=${status}`);
    console.log("Bot session found:", !!botSession);

    if (botSession && this.io) {
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
  async handleTranscriptionData(botId: string, event: string, transcriptData: any) {
    const botSession = this.botService.getBotSession(botId);

    console.log(`Transcription event: ${event} for bot: ${botId}`);
    console.log("Transcript data:", JSON.stringify(transcriptData, null, 2));
    console.log("Looking for bot session:", botId);
    console.log(
      "Available bot sessions:",
      Array.from(this.botService.getActiveBots().entries())
    );

    const processedTranscript = this.botService.processTranscriptData(
      event,
      transcriptData
    );

    // Save interventions to database
    try {
      const botRepository = getBotRepository();
      const bot = await botRepository.getBotByRecallId(botId);
      
      if (bot) {
        const interventionRepository = getInterventionRepository();
        const isPartial = event === "transcript.partial_data";
        
        // Handle different data formats
        if (Array.isArray(transcriptData)) {
          // Meeting captions format - array of items
          for (const item of transcriptData) {
            if (item.text || item.speaker) {
              await interventionRepository.createIntervention({
                bot_id: bot.id,
                participant_name: item.speaker || "Speaker",
                participant_id: 0,
                text: item.text || "",
                timestamp: item.timestamp || new Date().toISOString(),
                is_partial: isPartial,
                provider: "meeting_captions",
              });
            }
          }
        } else if (transcriptData.participant && transcriptData.words) {
          // Deepgram format - single participant with words
          const words = transcriptData.words.map((w: any) => w.text).join(" ");
          await interventionRepository.createIntervention({
            bot_id: bot.id,
            participant_name: transcriptData.participant.name || `Speaker ${transcriptData.participant.id}`,
            participant_id: transcriptData.participant.id || 0,
            text: words,
            timestamp: transcriptData.words[0]?.start_timestamp?.absolute || new Date().toISOString(),
            is_partial: isPartial,
            provider: "deepgram_streaming",
          });
        }
        console.log("✅ Interventions saved to database");
      } else {
        console.log(`⚠️ Bot not found in database for recall_bot_id: ${botId}`);
      }
    } catch (error: any) {
      console.error("❌ Failed to save interventions to database:", error.message);
      // Continue processing even if DB save fails
    }

    if (botSession && this.io) {
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
      if (this.io) {
        console.log("Broadcasting to all connected clients as fallback");
        this.io.emit("transcription", processedTranscript);
        console.log("Fallback broadcast completed");
      }
    }
  }

  // Get bot service instance
  getBotService() {
    return this.botService;
  }

  // Check if socket is connected
  isSocketConnected(socketId: string): boolean {
    if (!this.io) return false;
    return this.io.sockets.sockets.has(socketId);
  }

  // Get connected sockets
  getConnectedSockets(): string[] {
    if (!this.io) return [];
    return Array.from(this.io.sockets.sockets.keys());
  }
}

// Ensure a single instance across HMR and different import contexts
declare global {
  // eslint-disable-next-line no-var
  var __socketHandler__: SocketHandler | undefined;
}

export function getSocketHandler(): SocketHandler {
  if (!globalThis.__socketHandler__) {
    globalThis.__socketHandler__ = new SocketHandler();
  }
  return globalThis.__socketHandler__;
}

