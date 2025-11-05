import dotenv from "dotenv";
dotenv.config();

const config = {
  // Server configuration
  port: process.env.PORT || 3000,

  // Recall.ai configuration
  recallApiKey: process.env.RECALL_AI_API_KEY,
  recallApiUrl: "https://us-west-2.recall.ai/api/v1",
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL,

  // File upload configuration
  upload: {
    destination: "uploads",
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ["image/jpeg", "image/jpg", "audio/mpeg", "audio/mp3"],
    filenamePrefix: "bot-image",
  },
  // Audio upload configuration
  audioUpload: {
    destination: "uploads",
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ["audio/mpeg", "audio/mp3"],
    filenamePrefix: "audio-file",
  },

  // Socket.io configuration
  socketIo: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  },

  // Transcription configuration
  transcription: {
    defaultLanguage: "auto",
    defaultBotName: "Transcription Bot",
    defaultType: "meeting_captions",
    deepgramModel: "nova-2",
  },
};

// Validation
export const validateConfig = () => {
  const required: (keyof typeof config)[] = ["recallApiKey", "webhookBaseUrl"];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

export { config };
