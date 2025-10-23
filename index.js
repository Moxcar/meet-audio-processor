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
  });

  socket.on("create-bot", async (data) => {
    try {
      const {
        meetingUrl,
        language = "auto",
        botName = "Transcription Bot",
        botPhoto,
      } = data;
      console.log(
        "Creating bot for meeting:",
        meetingUrl,
        "with language:",
        language,
        "name:",
        botName
      );

      const botConfig = {
        meeting_url: meetingUrl,
        bot_name: botName,
        recording_config: {
          transcript: {
            provider: {
              recallai_streaming: {
                language_code: language,
              },
            },
          },
          realtime_endpoints: [
            {
              type: "webhook",
              url: `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`,
              events: ["transcript.data", "transcript.partial_data"],
            },
          ],
        },
      };

      // Add bot photo if provided
      if (botPhoto) {
        botConfig.bot_photo = botPhoto;
      }

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
    } catch (error) {
      console.error(
        "Error creating bot:",
        error.response?.data || error.message
      );
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
      }
    }

    if (event === "transcript.data" || event === "transcript.partial_data") {
      const botId = data.bot?.id;
      const transcriptData = data.data;
      const botSession = activeBots.get(botId);

      console.log(`Transcription event: ${event} for bot: ${botId}`);
      console.log("Transcript data:", JSON.stringify(transcriptData, null, 2));

      if (botSession) {
        console.log(`Sending transcription to socket: ${botSession.socketId}`);
        io.to(botSession.socketId).emit("transcription", {
          type: event,
          transcript: transcriptData,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`No active session found for bot: ${botId}`);
        console.log("Active bots:", Array.from(activeBots.keys()));
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
      } = req.body;
      const botPhotoFile = req.file;

      if (!meetingUrl) {
        return res.status(400).json({ error: "Meeting URL is required" });
      }

      const botConfig = {
        meeting_url: meetingUrl,
        bot_name: botName,
        recording_config: {
          transcript: {
            provider: {
              recallai_streaming: {
                language_code: language,
              },
            },
          },
          realtime_endpoints: [
            {
              type: "webhook",
              url: `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`,
              events: ["transcript.data", "transcript.partial_data"],
            },
          ],
        },
      };

      // Create bot first
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

      const botId = botResponse.data.id;

      // If image was uploaded, set it as bot's output video
      if (botPhotoFile) {
        try {
          // Convert image to base64 for Recall.ai
          const imageBuffer = fs.readFileSync(botPhotoFile.path);
          const base64Image = imageBuffer.toString("base64");

          // Set bot's output video (image) using Recall.ai API
          await axios.post(
            `https://us-west-2.recall.ai/api/v1/bot/${botId}/output_video`,
            {
              data: `data:image/jpeg;base64,${base64Image}`,
              duration: 0, // Static image
            },
            {
              headers: {
                Authorization: `Token ${process.env.RECALL_AI_API_KEY}`,
                "Content-Type": "application/json",
              },
            }
          );

          // Clean up uploaded file
          fs.unlinkSync(botPhotoFile.path);
        } catch (imageError) {
          console.error("Error setting bot image:", imageError);
          // Continue even if image setting fails
        }
      }

      res.json({
        botId: botId,
        status: "created",
        message: "Bot created successfully",
      });
    } catch (error) {
      console.error(
        "Error creating bot:",
        error.response?.data || error.message
      );
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
    } = req.body;

    if (!meetingUrl) {
      return res.status(400).json({ error: "Meeting URL is required" });
    }

    const botConfig = {
      meeting_url: meetingUrl,
      bot_name: botName,
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {
              language_code: language,
            },
          },
        },
        realtime_endpoints: [
          {
            type: "webhook",
            url: `${process.env.WEBHOOK_BASE_URL}/webhook/transcription`,
            events: ["transcript.data", "transcript.partial_data"],
          },
        ],
      },
    };

    // Add bot photo if provided
    if (botPhoto) {
      botConfig.bot_photo = botPhoto;
    }

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

    const botId = botResponse.data.id;
    res.json({
      botId: botId,
      status: "created",
      message: "Bot created successfully",
    });
  } catch (error) {
    console.error("Error creating bot:", error.response?.data || error.message);
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
  }));

  res.json({
    activeBots: botsInfo,
    totalBots: activeBots.size,
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(
    `Webhook URL: ${process.env.WEBHOOK_BASE_URL}/webhook/transcription`
  );
});
