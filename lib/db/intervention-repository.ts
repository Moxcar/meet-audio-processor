import { getServerClient } from "@/lib/supabase";

export interface Intervention {
  id: string;
  bot_id: string;
  participant_name: string;
  participant_id: number;
  text: string;
  timestamp: string;
  is_partial: boolean;
  provider: "meeting_captions" | "deepgram_streaming";
  created_at: string;
}

export interface CreateInterventionData {
  bot_id: string;
  participant_name: string;
  participant_id: number;
  text: string;
  timestamp: string;
  is_partial?: boolean;
  provider: "meeting_captions" | "deepgram_streaming";
}

export class InterventionRepository {
  private supabase = getServerClient();

  async createIntervention(
    data: CreateInterventionData
  ): Promise<Intervention> {
    const { data: intervention, error } = await this.supabase
      .from("interventions")
      .insert({
        ...data,
        is_partial: data.is_partial ?? false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create intervention: ${error.message}`);
    }

    return intervention;
  }

  async getInterventionsByBotId(botId: string): Promise<Intervention[]> {
    const { data, error } = await this.supabase
      .from("interventions")
      .select("*")
      .eq("bot_id", botId)
      .order("timestamp", { ascending: true });

    if (error) {
      throw new Error(`Failed to get interventions: ${error.message}`);
    }

    return data || [];
  }

  async getInterventionsByBotIdAndParticipant(
    botId: string,
    participantId: number
  ): Promise<Intervention[]> {
    const { data, error } = await this.supabase
      .from("interventions")
      .select("*")
      .eq("bot_id", botId)
      .eq("participant_id", participantId)
      .order("timestamp", { ascending: true });

    if (error) {
      throw new Error(
        `Failed to get interventions by participant: ${error.message}`
      );
    }

    return data || [];
  }

  async getInterventionsByBotIdAfterTimestamp(
    botId: string,
    timestamp: string
  ): Promise<Intervention[]> {
    const { data, error } = await this.supabase
      .from("interventions")
      .select("*")
      .eq("bot_id", botId)
      .gte("timestamp", timestamp)
      .order("timestamp", { ascending: true });

    if (error) {
      throw new Error(`Failed to get interventions: ${error.message}`);
    }

    return data || [];
  }

  async getFinalizedInterventionsByBotId(
    botId: string
  ): Promise<Intervention[]> {
    const { data, error } = await this.supabase
      .from("interventions")
      .select("*")
      .eq("bot_id", botId)
      .eq("is_partial", false)
      .order("timestamp", { ascending: true });

    if (error) {
      throw new Error(`Failed to get finalized interventions: ${error.message}`);
    }

    return data || [];
  }
}

// Singleton instance
let interventionRepositoryInstance: InterventionRepository | null = null;

export function getInterventionRepository(): InterventionRepository {
  if (!interventionRepositoryInstance) {
    interventionRepositoryInstance = new InterventionRepository();
  }
  return interventionRepositoryInstance;
}

