# Meet Audio Processor - Modular Backend

This project has been refactored into a modular architecture for better maintainability and organization.

## Project Structure

```
src/
├── config/
│   └── index.js          # Configuration and environment variables
├── services/
│   └── BotService.js     # Bot management and Recall.ai API interactions
├── handlers/
│   ├── SocketHandler.js  # WebSocket event handling
│   └── WebhookHandler.js # Recall.ai webhook processing
├── routes/
│   └── index.js          # Express routes and API endpoints
└── middleware/
    └── upload.js         # File upload middleware (multer)

server.js                 # Main server file (replaces index.js)
index.js.backup          # Backup of original monolithic file
```

## Modules Overview

### Configuration (`src/config/index.js`)
- Centralized configuration management
- Environment variable validation
- Default values for transcription settings
- File upload configuration

### Bot Service (`src/services/BotService.js`)
- Bot creation and management
- Recall.ai API interactions
- Active bot session tracking
- Transcript data processing
- Configuration builders for different bot types

### Socket Handler (`src/handlers/SocketHandler.js`)
- WebSocket connection management
- Real-time bot creation via WebSocket
- Bot status updates
- Transcription data broadcasting

### Webhook Handler (`src/handlers/WebhookHandler.js`)
- Recall.ai webhook processing
- Bot status change handling
- Transcript data event processing

### Routes (`src/routes/index.js`)
- Express API endpoints
- Bot creation with/without image upload
- Debug and monitoring endpoints
- Health check endpoints

### Middleware (`src/middleware/upload.js`)
- File upload configuration
- Image validation and processing
- Multer setup for bot photo uploads

## Key Benefits

1. **Separation of Concerns**: Each module has a specific responsibility
2. **Maintainability**: Easier to locate and modify specific functionality
3. **Testability**: Individual modules can be tested in isolation
4. **Scalability**: New features can be added without affecting existing code
5. **Code Reusability**: Services can be reused across different handlers

## Usage

The application works exactly the same as before:

```bash
# Development
npm run dev

# Production
npm start
```

## Migration Notes

- Original `index.js` is backed up as `index.js.backup`
- All functionality remains identical
- Configuration is now centralized and validated
- WebSocket and API endpoints work the same way
- File uploads continue to work as before

## Environment Variables

Required environment variables:
- `RECALL_AI_API_KEY`: Your Recall.ai API key
- `WEBHOOK_BASE_URL`: Base URL for webhook endpoints
- `PORT`: Server port (optional, defaults to 3000)