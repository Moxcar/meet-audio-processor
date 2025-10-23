# Meet Audio Processor

A real-time Google Meet audio processing system using Recall.ai, Node.js, and WebSockets for live transcription display.

## Features

- 🎤 Real-time audio transcription from Google Meet calls
- 🔄 Live WebSocket communication for instant updates
- 🎨 Modern, responsive web interface
- 🤖 Automated bot integration with Recall.ai
- 📝 Live transcription display with speaker identification

## Installation

```bash
npm install
```

## Configuration

1. Copy the environment template:

```bash
cp env.example .env
```

2. Configure your environment variables in `.env`:

```env
RECALL_AI_API_KEY=your_recall_ai_api_key_here
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
PORT=3000
```

3. Get your Recall.ai API key from [Recall.ai Dashboard](https://app.recall.ai/)

4. For local development, expose your server using ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3000

# Copy the HTTPS URL to WEBHOOK_BASE_URL in your .env file
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

## How to Use

1. **Start the server** using one of the commands above
2. **Open your browser** and navigate to `http://localhost:3000`
3. **Enter a Google Meet URL** in the input field
4. **Click "Conectar Bot"** to create and connect the transcription bot
5. **Wait for connection** - the bot will join the meeting automatically
6. **View live transcriptions** as they appear in real-time

## API Endpoints

- `GET /` - Health check and API status
- `POST /webhook/transcription` - Webhook endpoint for Recall.ai events
- `POST /api/bot/create` - Create a new transcription bot

## WebSocket Events

### Client to Server

- `create-bot` - Create a new bot for a meeting URL

### Server to Client

- `bot-created` - Bot successfully created
- `bot-error` - Error creating bot
- `bot-status` - Bot status updates (connecting, in_call, ended)
- `transcription` - Live transcription data

## Architecture

```
Google Meet → Recall.ai Bot → Webhook → Node.js Server → WebSocket → Web Client
```

1. **Bot Creation**: Client sends meeting URL to server
2. **Bot Joins**: Recall.ai bot joins the Google Meet call
3. **Audio Processing**: Bot processes audio and sends transcriptions via webhook
4. **Real-time Updates**: Server forwards transcriptions to connected clients via WebSocket
5. **Live Display**: Web client displays transcriptions in real-time

## Dependencies

- **express** - Web framework
- **socket.io** - WebSocket communication
- **axios** - HTTP client for Recall.ai API
- **dotenv** - Environment variable management
- **cors** - Cross-origin resource sharing

## Troubleshooting

### Bot Not Connecting

- Verify your Recall.ai API key is correct
- Ensure the webhook URL is accessible from the internet
- Check that the Google Meet URL is valid and the meeting is active

### No Transcriptions

- Make sure participants are speaking
- Verify the bot has joined the meeting (check bot status)
- Check server logs for webhook errors

### WebSocket Connection Issues

- Ensure the server is running
- Check browser console for connection errors
- Verify CORS settings if accessing from different domain

## Development

The application uses:

- **Backend**: Node.js with Express and Socket.io
- **Frontend**: Vanilla JavaScript with Socket.io client
- **Styling**: Modern CSS with responsive design
- **Integration**: Recall.ai API for bot management and transcription
