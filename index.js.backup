require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Store active bot sessions
const activeBots = new Map();

// Note: Using automatic_video_output instead of setBotOutputVideo

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "bot-image-" + uniqueSuffix + ".jpg");
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (
      file.mimetype.startsWith("image/jpeg") ||
      file.mimetype.startsWith("image/jpg")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG images are allowed"), false);
    }
  },
});

// WebSocket connection handler
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Clean up any bot sessions for this socket
    for (const [botId, session] of activeBots.entries()) {
      if (session.socketId === socket.id) {
        console.log(`Cleaning up bot session for bot: ${botId}`);
        activeBots.delete(botId);
      }
    }
  });

  socket.on("create-bot", async (data) => {
    try {
      const {
        meetingUrl,
        language = "auto",
        botName = "Transcription Bot",
        botPhoto,
        transcriptionType = "meeting_captions",
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

      // Configure transcription provider based on selection
      let transcriptConfig;
      if (transcriptionType === "ai_transcription") {
        transcriptConfig = {
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
        transcriptConfig = {
          provider: {
            meeting_captions: {},
          },
        };
      }

      const botConfig = {
        meeting_url: meetingUrl,
        bot_name: botName,
        recording_config: {
          transcript: transcriptConfig,
          realtime_endpoints: [
            {
              type: "webhook",
              url: `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`,
              events: ["transcript.data", "transcript.partial_data"],
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

        console.log("Image configured with automatic_video_output");
      }

      console.log("🚀 CREATING BOT - Full Request Details:");
      console.log("📋 Bot Config:", JSON.stringify(botConfig, null, 2));
      console.log(
        "🔑 API Key:",
        process.env.RECALL_AI_API_KEY ? "Present" : "Missing"
      );
      console.log(
        "🌐 Webhook URL:",
        `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`
      );
      console.log("📡 Request URL:", "https://us-west-2.recall.ai/api/v1/bot");

      const botResponse = await axios.post(
        "https://us-west-2.recall.ai/api/v1/bot",
        botConfig,
        {
          headers: {
            Authorization: `Token ${process.env.RECALL_AI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ BOT CREATED SUCCESSFULLY:");
      console.log("📊 Response Status:", botResponse.status);
      console.log(
        "📄 Response Data:",
        JSON.stringify(botResponse.data, null, 2)
      );

      const botId = botResponse.data.id;
      activeBots.set(botId, {
        socketId: socket.id,
        meetingUrl: meetingUrl,
        status: "created",
      });

      socket.emit("bot-created", {
        botId: botId,
        status: "created",
        message: "Bot created successfully",
      });

      console.log("Bot created:", botId);
      console.log("Active bots after creation:", Array.from(activeBots.keys()));
      console.log("Bot session stored:", activeBots.get(botId));
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
  });
});

// Webhook endpoint for Recall.ai
app.post("/webhook/transcription", (req, res) => {
  try {
    const { event, data } = req.body;
    console.log("Webhook received:", event);
    console.log("Webhook data:", JSON.stringify(data, null, 2));

    if (event === "bot.status_change") {
      const botId = data.bot?.id;
      const status = data.status;
      const botSession = activeBots.get(botId);

      if (botSession) {
        botSession.status = status;
        io.to(botSession.socketId).emit("bot-status", {
          botId: botId,
          status: status,
        });

        // Image is now configured with automatic_video_output during bot creation
      }
    }

    if (event === "transcript.data" || event === "transcript.partial_data") {
      const botId = data.bot?.id;
      const transcriptData = data.data;
      const botSession = activeBots.get(botId);

      console.log(`Transcription event: ${event} for bot: ${botId}`);
      console.log("Transcript data:", JSON.stringify(transcriptData, null, 2));
      console.log("Looking for bot session:", botId);
      console.log("Available bot sessions:", Array.from(activeBots.entries()));

      // Debug: Check data structure to determine provider
      console.log("Data structure analysis:");
      console.log("- Has participant:", !!transcriptData?.participant);
      console.log("- Has words:", !!transcriptData?.words);
      console.log("- Is array:", Array.isArray(transcriptData));
      console.log(
        "- Keys:",
        transcriptData ? Object.keys(transcriptData) : "null"
      );

      if (botSession) {
        console.log(`Sending transcription to socket: ${botSession.socketId}`);

        // Determine provider based on data structure
        let provider = "meeting_captions"; // Default

        // Deepgram data has participant and words at the same level
        if (
          transcriptData &&
          transcriptData.participant &&
          transcriptData.words
        ) {
          provider = "deepgram_streaming";
          console.log("Detected Deepgram format");
        }
        // Meeting captions data is usually an array of participants
        else if (Array.isArray(transcriptData)) {
          provider = "meeting_captions";
          console.log("Detected Meeting Captions format (array)");
        } else {
          console.log("Using default provider:", provider);
        }

        // Process transcript data format
        const processedTranscript = {
          type: event,
          data: transcriptData, // Include raw data for Deepgram
          transcript: transcriptData, // Keep for backward compatibility
          timestamp: new Date().toISOString(),
          provider: provider,
        };

        // Check if socket is still connected
        const socketExists = io.sockets.sockets.has(botSession.socketId);
        if (socketExists) {
          io.to(botSession.socketId).emit("transcription", processedTranscript);
          console.log("Transcription sent successfully");
        } else {
          console.log(`Socket ${botSession.socketId} is no longer connected`);
          // Try to find any connected socket and broadcast to all
          io.emit("transcription", processedTranscript);
          console.log("Broadcasting to all connected clients");
        }
      } else {
        console.log(`No active session found for bot: ${botId}`);
        console.log("Active bots:", Array.from(activeBots.keys()));

        // Try to broadcast to all connected clients as fallback
        let provider = "meeting_captions"; // Default

        // Deepgram data has participant and words at the same level
        if (
          transcriptData &&
          transcriptData.participant &&
          transcriptData.words
        ) {
          provider = "deepgram_streaming";
          console.log("Fallback: Detected Deepgram format");
        }
        // Meeting captions data is usually an array of participants
        else if (Array.isArray(transcriptData)) {
          provider = "meeting_captions";
          console.log("Fallback: Detected Meeting Captions format (array)");
        }

        const processedTranscript = {
          type: event,
          data: transcriptData,
          transcript: transcriptData,
          timestamp: new Date().toISOString(),
          provider: provider,
        };
        io.emit("transcription", processedTranscript);
        console.log("Broadcasting to all clients as fallback");
      }
    }

    res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API endpoint to create bot with image upload
app.post(
  "/api/bot/create-with-image",
  upload.single("botPhoto"),
  async (req, res) => {
    try {
      const {
        meetingUrl,
        language = "auto",
        botName = "Transcription Bot",
        transcriptionType = "meeting_captions",
      } = req.body;
      const botPhotoFile = req.file;

      if (!meetingUrl) {
        return res.status(400).json({ error: "Meeting URL is required" });
      }

      // Configure transcription provider based on selection
      let transcriptConfig;
      if (transcriptionType === "ai_transcription") {
        transcriptConfig = {
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
        transcriptConfig = {
          provider: {
            meeting_captions: {},
          },
        };
      }

      const botConfig = {
        meeting_url: meetingUrl,
        bot_name: botName,
        recording_config: {
          transcript: transcriptConfig,
          realtime_endpoints: [
            {
              type: "webhook",
              url: `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`,
              events: ["transcript.data", "transcript.partial_data"],
            },
          ],
        },
      };

      // Add automatic_video_output if image is provided
      if (botPhotoFile) {
        const imageBuffer = fs.readFileSync(botPhotoFile.path);
        const base64Image = imageBuffer.toString("base64");

        botConfig.automatic_video_output = {
          in_call_recording: {
            kind: "jpeg",
            b64_data: base64Image,
          },
        };

        console.log("Image configured with automatic_video_output");
        console.log("Image size:", base64Image.length, "characters");
      }

      console.log("🚀 CREATING BOT WITH IMAGE - Full Request Details:");
      console.log("📋 Bot Config:", JSON.stringify(botConfig, null, 2));
      console.log(
        "🔑 API Key:",
        process.env.RECALL_AI_API_KEY ? "Present" : "Missing"
      );
      console.log(
        "🌐 Webhook URL:",
        `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`
      );
      console.log("📡 Request URL:", "https://us-west-2.recall.ai/api/v1/bot");

      // Create bot with image configuration
      const botResponse = await axios.post(
        "https://us-west-2.recall.ai/api/v1/bot",
        botConfig,
        {
          headers: {
            Authorization: `Token ${process.env.RECALL_AI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ BOT WITH IMAGE CREATED SUCCESSFULLY:");
      console.log("📊 Response Status:", botResponse.status);
      console.log(
        "📄 Response Data:",
        JSON.stringify(botResponse.data, null, 2)
      );

      const botId = botResponse.data.id;

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
);

// API endpoint to create bot
app.post("/api/bot/create", async (req, res) => {
  try {
    const {
      meetingUrl,
      language = "auto",
      botName = "Transcription Bot",
      botPhoto,
      transcriptionType = "meeting_captions",
    } = req.body;

    if (!meetingUrl) {
      return res.status(400).json({ error: "Meeting URL is required" });
    }

    // Configure transcription provider based on selection
    let transcriptConfig;
    if (transcriptionType === "ai_transcription") {
      transcriptConfig = {
        provider: {
          deepgram_streaming: {
            language: language === "auto" ? "en-US" : language,
          },
        },
        diarization: {
          use_separate_streams_when_available: true,
        },
      };
    } else {
      transcriptConfig = {
        provider: {
          meeting_captions: {},
        },
      };
    }

    const botConfig = {
      meeting_url: meetingUrl,
      bot_name: botName,
      recording_config: {
        transcript: transcriptConfig,
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`,
            events: ["transcript.data", "transcript.partial_data"],
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

      console.log("Image configured with automatic_video_output");
    }

    console.log("🚀 CREATING BOT (API) - Full Request Details:");
    console.log("📋 Bot Config:", JSON.stringify(botConfig, null, 2));
    console.log(
      "🔑 API Key:",
      process.env.RECALL_AI_API_KEY ? "Present" : "Missing"
    );
    console.log(
      "🌐 Webhook URL:",
      `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`
    );
    console.log("📡 Request URL:", "https://us-west-2.recall.ai/api/v1/bot");

    const botResponse = await axios.post(
      "https://us-west-2.recall.ai/api/v1/bot",
      botConfig,
      {
        headers: {
          Authorization: `Token ${process.env.RECALL_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ BOT (API) CREATED SUCCESSFULLY:");
    console.log("📊 Response Status:", botResponse.status);
    console.log("📄 Response Data:", JSON.stringify(botResponse.data, null, 2));

    const botId = botResponse.data.id;
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
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Meet Audio Processor API",
    status: "running",
    timestamp: new Date().toISOString(),
    activeBots: activeBots.size,
  });
});

// Debug endpoint to check bot status
app.get("/debug/bots", (req, res) => {
  const botsInfo = Array.from(activeBots.entries()).map(([botId, session]) => ({
    botId,
    socketId: session.socketId,
    meetingUrl: session.meetingUrl,
    status: session.status,
    socketConnected: io.sockets.sockets.has(session.socketId),
  }));

  const connectedSockets = Array.from(io.sockets.sockets.keys());

  res.json({
    activeBots: botsInfo,
    totalBots: activeBots.size,
    connectedSockets: connectedSockets,
    totalConnectedSockets: connectedSockets.length,
  });
});

// Endpoint to clean up orphaned bot sessions
app.post("/debug/cleanup", (req, res) => {
  const initialSize = activeBots.size;
  const connectedSockets = Array.from(io.sockets.sockets.keys());

  // Remove sessions for disconnected sockets
  for (const [botId, session] of activeBots.entries()) {
    if (!connectedSockets.includes(session.socketId)) {
      console.log(`Removing orphaned session for bot: ${botId}`);
      activeBots.delete(botId);
    }
  }

  const cleanedSize = activeBots.size;

  res.json({
    message: "Cleanup completed",
    initialSessions: initialSize,
    remainingSessions: cleanedSize,
    removedSessions: initialSize - cleanedSize,
  });
});

// Endpoint to check bot status and output video
app.get("/api/bot/:botId/status", async (req, res) => {
  try {
    const { botId } = req.params;

    const botResponse = await axios.get(
      `https://us-west-2.recall.ai/api/v1/bot/${botId}`,
      {
        headers: {
          Authorization: `Token ${process.env.RECALL_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      botId: botId,
      status: botResponse.data.status,
      outputVideo: botResponse.data.output_video,
      hasOutputVideo: !!botResponse.data.output_video,
      botData: botResponse.data,
    });
  } catch (error) {
    console.error("Error getting bot status:", error);
    res.status(500).json({
      error: "Failed to get bot status",
      details: error.response?.data || error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log("🚀 SERVER STARTED SUCCESSFULLY!");
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(
    `🌐 Webhook URL: ${process.env.WEBHOOK_BASE_URL}/webhook/transcription`
  );
  console.log("📋 CONFIGURATION CHECK:");
  console.log(
    `🔑 Recall.ai API Key: ${
      process.env.RECALL_AI_API_KEY ? "✅ Present" : "❌ Missing"
    }`
  );
  console.log(
    `🌍 Webhook Base URL: ${process.env.WEBHOOK_BASE_URL || "❌ Missing"}`
  );
  console.log("🎯 Ready to create bots with Deepgram AI Transcription!");
});
