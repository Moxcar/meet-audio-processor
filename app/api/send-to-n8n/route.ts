import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import FormDataLib from "form-data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript_data, meeting_url, total_interventions, timestamp } = body;

    if (!transcript_data || transcript_data.length === 0) {
      return NextResponse.json(
        { error: "No transcript data to send" },
        { status: 400 }
      );
    }

    // Check if N8N_WEBHOOK_URL is configured
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      return NextResponse.json(
        {
          error: "N8N_WEBHOOK_URL environment variable is not configured",
        },
        { status: 500 }
      );
    }

    // Build multipart/form-data with a file instead of raw JSON body
    const form = new FormDataLib();

    // Prepare file buffer (JSON file)
    const fileBuffer = Buffer.from(
      JSON.stringify({ transcript_data }, null, 2),
      "utf-8"
    );

    form.append("file", fileBuffer, {
      filename: "transcript.json",
      contentType: "application/json",
    });

    // Add metadata as form fields
    if (timestamp) form.append("timestamp", String(timestamp));
    if (meeting_url) form.append("meeting_url", String(meeting_url));
    if (typeof total_interventions !== "undefined")
      form.append("total_interventions", String(total_interventions));
    form.append("source", "meet-audio-processor");
    form.append("processed_at", new Date().toISOString());

    console.log("📤 Sending transcript file to n8n webhook:", n8nWebhookUrl);
    console.log("📄 File name:", "transcript.json");
    console.log("📊 File size:", fileBuffer.length, "bytes");

    // Send to n8n webhook as multipart/form-data
    const response = await axios.post(n8nWebhookUrl, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 30000, // 30 seconds timeout
    });

    console.log(
      "✅ Successfully sent to n8n. Response status:",
      response.status
    );

    return NextResponse.json({
      success: true,
      message: "Transcript sent to n8n successfully",
      n8n_response_status: response.status,
      total_interventions: total_interventions,
    });
  } catch (error: any) {
    console.error("❌ Error sending to n8n:", error.message);

    let errorDetails = error.message;
    
    if (error.response) {
      console.error("📊 n8n Response Status:", error.response.status);
      console.error("📄 n8n Response Data:", error.response.data);
      
      // Handle different response types from n8n
      if (typeof error.response.data === 'string') {
        if (error.response.data.includes('<!DOCTYPE')) {
          errorDetails = `n8n webhook returned HTML error page (status ${error.response.status}). Please check the webhook URL configuration.`;
        } else {
          errorDetails = error.response.data.substring(0, 200);
        }
      } else if (error.response.data && typeof error.response.data === 'object') {
        errorDetails = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
      } else {
        errorDetails = `HTTP ${error.response.status}: ${error.response.statusText || 'Unknown error'}`;
      }
    }

    return NextResponse.json(
      {
        error: "Failed to send transcript to n8n",
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}

