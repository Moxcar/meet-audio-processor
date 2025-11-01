require("dotenv").config();

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
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ["image/jpeg", "image/jpg"],
    filenamePrefix: "bot-image"
  },
  
  // Socket.io configuration
  socketIo: {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  },
  
  // Transcription configuration
  transcription: {
    defaultLanguage: "auto",
    defaultBotName: "Transcription Bot",
    defaultType: "meeting_captions",
    deepgramModel: "nova-2"
  }
};

// Validation
const validateConfig = () => {
  const required = ['recallApiKey', 'webhookBaseUrl'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

module.exports = {
  config,
  validateConfig
};


