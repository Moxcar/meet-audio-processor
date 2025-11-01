class WebhookHandler {
  constructor(socketHandler) {
    this.socketHandler = socketHandler;
    this.botService = socketHandler.getBotService();
  }

  // Handle webhook requests from Recall.ai
  handleWebhook(req, res) {
    try {
      const { event, data } = req.body;
      console.log("=== WEBHOOK RECEIVED ===");
      console.log("Event:", event);
      console.log("Bot ID:", data?.bot?.id);
      console.log("Status:", data?.status);
      console.log("Has transcript data:", !!data?.data);
      console.log("Webhook data:", JSON.stringify(data, null, 2));
      console.log("=========================");

      if (event === "bot.status_change") {
        this.handleBotStatusChange(data);
      }

      if (event === "transcript.data" || event === "transcript.partial_data") {
        this.handleTranscriptData(data, event);
      }

      res.status(200).json({ status: "success" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  // Handle bot status change events
  handleBotStatusChange(data) {
    const botId = data.bot?.id;
    const status = data.status;

    console.log(`Bot status change event: botId=${botId}, status=${status}`);

    if (botId && status) {
      this.socketHandler.handleBotStatusUpdate(botId, status);
      console.log(`Bot ${botId} status changed to: ${status}`);
    } else {
      console.log(`Missing botId or status: botId=${botId}, status=${status}`);
    }
  }

  // Handle transcript data events
  handleTranscriptData(data, event) {
    const botId = data.bot?.id;
    const transcriptData = data.data;

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

    if (botId && transcriptData) {
      this.socketHandler.handleTranscriptionData(botId, event, transcriptData);
    } else {
      console.log(
        `Missing botId or transcriptData: botId=${botId}, transcriptData=${!!transcriptData}`
      );
    }
  }
}

module.exports = WebhookHandler;
