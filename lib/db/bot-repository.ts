import { getServerClient } from "@/lib/supabase";

export interface BotTemplate {
  id: string;
  name: string;
  bot_name: string;
  transcription_type: "meeting_captions" | "ai_transcription";
  language: string;
  bot_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bot {
  id: string;
  recall_bot_id: string;
  meeting_url: string;
  bot_name: string;
  transcription_type: "meeting_captions" | "ai_transcription";
  language: string;
  bot_photo_url: string | null;
  status: string;
  socket_id: string | null;
  output_video_url: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
  call_started_at: string | null;
  call_ended_at: string | null;
}

export interface CreateBotData {
  recall_bot_id: string;
  meeting_url: string;
  bot_name: string;
  transcription_type: "meeting_captions" | "ai_transcription";
  language: string;
  bot_photo_url?: string | null;
  status: string;
  socket_id?: string | null;
  template_id?: string | null;
}

export interface UpdateBotData {
  status?: string;
  socket_id?: string | null;
  output_video_url?: string | null;
  call_started_at?: string | null;
  call_ended_at?: string | null;
}

export class BotRepository {
  private supabase = getServerClient();

  async createBot(data: CreateBotData): Promise<Bot> {
    const { data: bot, error } = await this.supabase
      .from("bots")
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create bot: ${error.message}`);
    }

    return bot;
  }

  async updateBot(recallBotId: string, updates: UpdateBotData): Promise<Bot> {
    const { data: bot, error } = await this.supabase
      .from("bots")
      .update(updates)
      .eq("recall_bot_id", recallBotId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update bot: ${error.message}`);
    }

    return bot;
  }

  async getBotByRecallId(recallBotId: string): Promise<Bot | null> {
    const { data, error } = await this.supabase
      .from("bots")
      .select("*")
      .eq("recall_bot_id", recallBotId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return null;
      }
      throw new Error(`Failed to get bot: ${error.message}`);
    }

    return data;
  }

  async updateBotStatus(
    recallBotId: string,
    status: string
  ): Promise<Bot> {
    const updates: UpdateBotData = { status };

    // Set call_started_at when status becomes "in_call"
    if (status === "in_call") {
      updates.call_started_at = new Date().toISOString();
    }

    // Set call_ended_at when status becomes "call_ended"
    if (status === "call_ended") {
      updates.call_ended_at = new Date().toISOString();
    }

    return this.updateBot(recallBotId, updates);
  }

  async updateBotOutputVideo(
    recallBotId: string,
    outputVideoUrl: string
  ): Promise<Bot> {
    return this.updateBot(recallBotId, { output_video_url: outputVideoUrl });
  }

  async getBotById(botId: string): Promise<Bot | null> {
    const { data, error } = await this.supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to get bot: ${error.message}`);
    }

    return data;
  }

  async getAllBots(): Promise<Bot[]> {
    const { data, error } = await this.supabase
      .from("bots")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to get bots: ${error.message}`);
    }

    return data || [];
  }
}

// Singleton instance
let botRepositoryInstance: BotRepository | null = null;

export function getBotRepository(): BotRepository {
  if (!botRepositoryInstance) {
    botRepositoryInstance = new BotRepository();
  }
  return botRepositoryInstance;
}

