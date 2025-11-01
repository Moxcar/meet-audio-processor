const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

// Import modules
const { config, validateConfig } = require("./src/config");
const SocketHandler = require("./src/handlers/SocketHandler");
const WebhookHandler = require("./src/handlers/WebhookHandler");
const RoutesHandler = require("./src/routes");

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error("Configuration error:", error.message);
  process.exit(1);
}

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, config.socketIo);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Log every request to the server (moved before routes)
app.use((req, res, next) => {
  console.log("=============================");
  console.log(`${req.method} ${req.url}`);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));
  console.log("=============================");
  next();
});

// Initialize handlers
const socketHandler = new SocketHandler(io);
const webhookHandler = new WebhookHandler(socketHandler);
const routesHandler = new RoutesHandler(socketHandler);

// Initialize socket handlers
socketHandler.initialize();

// Setup routes
app.use("/", routesHandler.getRouter());

// Webhook endpoint (handled by WebhookHandler)
app.post("/webhook/transcription", (req, res) => {
  webhookHandler.handleWebhook(req, res);
});

// Start server
server.listen(config.port, () => {
  console.log("🚀 SERVER STARTED SUCCESSFULLY!");
  console.log(`📡 Server running on port ${config.port}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`🌐 Webhook URL: ${config.webhookBaseUrl}/webhook/transcription`);
  console.log("📋 CONFIGURATION CHECK:");
  console.log(
    `🔑 Recall.ai API Key: ${config.recallApiKey ? "✅ Present" : "❌ Missing"}`
  );
  console.log(`🌍 Webhook Base URL: ${config.webhookBaseUrl || "❌ Missing"}`);
  console.log("🎯 Ready to create bots with Deepgram AI Transcription!");
});
