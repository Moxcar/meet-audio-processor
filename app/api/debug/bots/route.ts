import { NextRequest, NextResponse } from "next/server";
import { getBotService } from "@/lib/bot-service";
import { getSocketHandler } from "@/lib/socket-handler";

export async function GET(request: NextRequest) {
  const botService = getBotService();
  const socketHandler = getSocketHandler();
  
  const botsInfo = Array.from(
    botService.getActiveBots().entries()
  ).map(([botId, session]) => ({
    botId,
    socketId: session.socketId,
    meetingUrl: session.meetingUrl,
    status: session.status,
    socketConnected: socketHandler.isSocketConnected(session.socketId),
  }));

  const connectedSockets = socketHandler.getConnectedSockets();

  return NextResponse.json({
    activeBots: botsInfo,
    totalBots: botService.getActiveBots().size,
    connectedSockets: connectedSockets,
    totalConnectedSockets: connectedSockets.length,
  });
}

