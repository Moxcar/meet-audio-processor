import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";
import { getSocketHandler } from "@/lib/socket-handler";

export async function POST(request: NextRequest) {
  const botService = getBotService();
  const socketHandler = getSocketHandler();
  const initialSize = botService.getActiveBots().size;
  const connectedSockets = socketHandler.getConnectedSockets();

  // Remove sessions for disconnected sockets
  for (const [botId, session] of botService.getActiveBots().entries()) {
    if (!connectedSockets.includes(session.socketId)) {
      console.log(`Removing orphaned session for bot: ${botId}`);
      botService.removeBotSession(botId);
    }
  }

  const cleanedSize = botService.getActiveBots().size;

  return NextResponse.json({
    message: "Cleanup completed",
    initialSessions: initialSize,
    remainingSessions: cleanedSize,
    removedSessions: initialSize - cleanedSize,
  });
}

