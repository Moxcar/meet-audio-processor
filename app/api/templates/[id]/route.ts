import { NextRequest, NextResponse } from "next/server";
import { getTemplateRepository } from "@/lib/db/template-repository";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateRepository = getTemplateRepository();
    const template = await templateRepository.getTemplateById(id);

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error: any) {
    console.error("Error getting template:", error);
    return NextResponse.json(
      {
        error: "Failed to get template",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, bot_name, transcription_type, language, bot_photo_url } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (bot_name !== undefined) updates.bot_name = bot_name;
    if (transcription_type !== undefined) {
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
      updates.transcription_type = transcription_type;
    }
    if (language !== undefined) updates.language = language;
    if (bot_photo_url !== undefined) updates.bot_photo_url = bot_photo_url;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const templateRepository = getTemplateRepository();
    const template = await templateRepository.updateTemplate(id, updates);

    return NextResponse.json(template);
  } catch (error: any) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      {
        error: "Failed to update template",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateRepository = getTemplateRepository();
    await templateRepository.deleteTemplate(id);

    return NextResponse.json({ message: "Template deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      {
        error: "Failed to delete template",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

