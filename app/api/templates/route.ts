import { NextRequest, NextResponse } from "next/server";
import { getTemplateRepository } from "@/lib/db/template-repository";

export async function GET() {
  try {
    const templateRepository = getTemplateRepository();
    const templates = await templateRepository.getAllTemplates();

    return NextResponse.json(templates);
  } catch (error: any) {
    console.error("Error getting templates:", error);
    return NextResponse.json(
      {
        error: "Failed to get templates",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, bot_name, transcription_type, language, bot_photo_url } = body;

    if (!name || !bot_name || !transcription_type || !language) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: ["name", "bot_name", "transcription_type", "language"],
        },
        { status: 400 }
      );
    }

    if (
      transcription_type !== "meeting_captions" &&
      transcription_type !== "ai_transcription"
    ) {
      return NextResponse.json(
        {
          error: "Invalid transcription_type",
          valid: ["meeting_captions", "ai_transcription"],
        },
        { status: 400 }
      );
    }

    const templateRepository = getTemplateRepository();
    const template = await templateRepository.createTemplate({
      name,
      bot_name,
      transcription_type,
      language,
      bot_photo_url: bot_photo_url || null,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      {
        error: "Failed to create template",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

