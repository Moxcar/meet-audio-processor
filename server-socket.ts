import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { getSocketHandler } from "./lib/socket-handler";
import { config, validateConfig } from "./lib/config";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Validate configuration
try {
  validateConfig();
} catch (error: any) {
  console.error("Configuration error:", error.message);
  process.exit(1);
}

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize Socket.IO
  const io = new SocketIOServer(httpServer, config.socketIo);
  
  // Initialize socket handler
  const socketHandler = getSocketHandler();
  socketHandler.setIO(io);
  socketHandler.getIO()?.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      socketHandler.getBotService().cleanupSocketSessions(socket.id);
    });

    socket.on("create-bot", async (data) => {
      await socketHandler.handleCreateBot(socket, data);
    });
  });

  // Start server
  httpServer.listen(port, () => {
    console.log("🚀 SERVER STARTED SUCCESSFULLY!");
    console.log(`📡 Server running on port ${port}`);
    console.log(`🔌 WebSocket server ready`);
    console.log(`🌐 Webhook URL: ${config.webhookBaseUrl}/webhook/transcription`);
    console.log("📋 CONFIGURATION CHECK:");
    console.log(
      `🔑 Recall.ai API Key: ${config.recallApiKey ? "✅ Present" : "❌ Missing"}`
    );
    console.log(`🌍 Webhook Base URL: ${config.webhookBaseUrl || "❌ Missing"}`);
    console.log("🎯 Ready to create bots with Deepgram AI Transcription!");
  });
});

