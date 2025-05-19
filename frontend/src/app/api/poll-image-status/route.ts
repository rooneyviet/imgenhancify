import { NextRequest, NextResponse } from "next/server";
import {
  PollingProvider,
  ImageResult,
} from "@/services/polling/PollingProvider";
import { FalPollingProvider } from "@/services/polling/FalPollingProvider";
import { RunpodPollingProvider } from "@/services/polling/RunpodPollingProvider";

// A simple "factory" to get the provider
function getPollingProvider(providerNameLower: string): PollingProvider | null {
  // Receive the lowercased param
  switch (providerNameLower) {
    case "fal.ai":
      return new FalPollingProvider();
    case "runpod":
      return new RunpodPollingProvider();
    // Add other cases for future providers
    // case 'anotherprovider':
    //   return new AnotherPollingProvider();
    default:
      return null;
  }
}

interface PollImageStatusRequestBody {
  providerName: string;
  statusUrl: string;
  apiKeyName?: string; // Environment variable name containing the API key
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PollImageStatusRequestBody;
    const { providerName, statusUrl, apiKeyName } = body;

    // Log received values
    console.log(
      `[API /api/poll-image-status] Received: providerName="${providerName}", statusUrl="${statusUrl}", apiKeyName="${apiKeyName}"`
    );

    if (!providerName || !statusUrl) {
      console.error(
        "[API /api/poll-image-status] Missing providerName or statusUrl in request body."
      );
      return NextResponse.json(
        { error: "Missing providerName or statusUrl" },
        { status: 400 }
      );
    }

    const lowerCaseProviderName = providerName.toLowerCase();
    console.log(
      `[API /api/poll-image-status] Using lowerCaseProviderName: "${lowerCaseProviderName}"`
    );

    const provider = getPollingProvider(lowerCaseProviderName);
    if (!provider) {
      console.error(
        `[API /api/poll-image-status] Unsupported provider: "${providerName}" (resolved to "${lowerCaseProviderName}").`
      );
      return NextResponse.json(
        { error: `Unsupported provider: ${providerName}` },
        { status: 400 }
      );
    }
    console.log(
      `[API /api/poll-image-status] Successfully got PollingProvider for: "${lowerCaseProviderName}".`
    );

    // Perform a single status check
    console.log(
      `[API /api/poll-image-status] Checking status at ${statusUrl} for provider ${lowerCaseProviderName}...`
    );
    // Providers now get API key internally
    const statusResponse = await provider.checkStatus(statusUrl);

    // Log detailed response from provider.checkStatus
    console.log(
      `[API /api/poll-image-status] Status response from provider (${lowerCaseProviderName}):`,
      JSON.stringify(statusResponse, null, 2)
    );

    if (statusResponse.status === "COMPLETED") {
      if (!statusResponse.data) {
        console.error(
          "Polling COMPLETED but no data received from provider.checkStatus"
        );
        return NextResponse.json(
          { error: "Polling completed but no data received from provider" },
          { status: 500 }
        );
      }
      try {
        // Providers now get API key internally for getResult
        const imageResult: ImageResult = await provider.getResult(
          statusResponse.data
        );
        return NextResponse.json(imageResult, { status: 200 });
      } catch (error) {
        console.error("Error processing result from provider:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to process result from provider";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
      }
    } else if (statusResponse.status === "FAILED") {
      console.error(
        "Polling failed for URL:",
        statusUrl,
        "Error:",
        statusResponse.error
      );
      return NextResponse.json(
        {
          error: "Processing failed by the provider",
          details: statusResponse.error,
        },
        { status: 500 }
      );
    } else if (
      statusResponse.status === "IN_QUEUE" ||
      statusResponse.status === "IN_PROGRESS"
    ) {
      // Return the current status for the client to continue polling
      return NextResponse.json(statusResponse, { status: 200 });
    } else {
      // Unknown status from provider.checkStatus
      console.error(
        "Unknown status from provider.checkStatus:",
        statusResponse
      );
      return NextResponse.json(
        { error: "Unknown status from provider" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in poll-image-status API route:", error);
    if (error instanceof SyntaxError) {
      // JSON parsing error
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
