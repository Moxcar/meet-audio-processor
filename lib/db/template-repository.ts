import { getServerClient } from "@/lib/supabase";
import { BotTemplate } from "./bot-repository";

export interface CreateTemplateData {
  name: string;
  bot_name: string;
  transcription_type: "meeting_captions" | "ai_transcription";
  language: string;
  bot_photo_url?: string | null;
}

export interface UpdateTemplateData {
  name?: string;
  bot_name?: string;
  transcription_type?: "meeting_captions" | "ai_transcription";
  language?: string;
  bot_photo_url?: string | null;
}

export class TemplateRepository {
  private supabase = getServerClient();

  async createTemplate(data: CreateTemplateData): Promise<BotTemplate> {
    const { data: template, error } = await this.supabase
      .from("bot_templates")
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return template;
  }

  async getAllTemplates(): Promise<BotTemplate[]> {
    const { data, error } = await this.supabase
      .from("bot_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }

    return data || [];
  }

  async getTemplateById(templateId: string): Promise<BotTemplate | null> {
    const { data, error } = await this.supabase
      .from("bot_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to get template: ${error.message}`);
    }

    return data;
  }

  async updateTemplate(
    templateId: string,
    updates: UpdateTemplateData
  ): Promise<BotTemplate> {
    const { data: template, error } = await this.supabase
      .from("bot_templates")
      .update(updates)
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    return template;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await this.supabase
      .from("bot_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }
}

// Singleton instance
let templateRepositoryInstance: TemplateRepository | null = null;

export function getTemplateRepository(): TemplateRepository {
  if (!templateRepositoryInstance) {
    templateRepositoryInstance = new TemplateRepository();
  }
  return templateRepositoryInstance;
}

