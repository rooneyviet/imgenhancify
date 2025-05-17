import { NextRequest, NextResponse } from "next/server";
import { RunpodPollingProvider } from "@/services/polling/RunpodPollingProvider";

interface CancelRunpodJobRequestBody {
  statusUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CancelRunpodJobRequestBody;
    const { statusUrl } = body;

    // Log received values
    console.log(
      `[API /api/cancel-runpod-job] Received request to cancel job at: ${statusUrl}`
    );

    if (!statusUrl) {
      console.error(
        "[API /api/cancel-runpod-job] Missing statusUrl in request body."
      );
      return NextResponse.json({ error: "Missing statusUrl" }, { status: 400 });
    }

    // Get API key from environment
    const apiKey = process.env.RUNPOD_API_KEY;
    if (!apiKey) {
      console.error(
        "[API /api/cancel-runpod-job] CRITICAL: RUNPOD_API_KEY is not configured or not accessible in environment variables."
      );
      return NextResponse.json(
        { error: "RUNPOD_API_KEY is not configured for the server." },
        { status: 500 }
      );
    }

    // Create provider and cancel job
    const provider = new RunpodPollingProvider();
    const result = await provider.cancelJob(statusUrl, apiKey);

    if (result.success) {
      console.log(
        `[API /api/cancel-runpod-job] Successfully cancelled job at ${statusUrl}`
      );
      return NextResponse.json({
        success: true,
        message: "Job cancelled successfully",
      });
    } else {
      console.error(
        `[API /api/cancel-runpod-job] Failed to cancel job: ${result.error}`
      );
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to cancel job",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API /api/cancel-runpod-job] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
