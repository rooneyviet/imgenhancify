import { NextRequest, NextResponse } from "next/server";
import { ImageEnhancementFactory } from "../../../services/image-enhancement/ImageEnhancementFactory";
import { EnhancementRequest } from "../../../services/image-enhancement/ImageEnhancementProvider";

export async function POST(request: NextRequest) {
  console.log("API /api/enhance-image POST request received (v2 with Factory)");
  try {
    const body = await request.json();
    const imageUrl = body.image_url;

    if (!imageUrl) {
      console.error("No image_url provided in request body");
      return NextResponse.json({ error: "Missing image_url" }, { status: 400 });
    }

    console.log("Received image_url for enhancement:", imageUrl);

    const enhancementProvider = ImageEnhancementFactory.getProvider();
    const enhancementRequest: EnhancementRequest = { imageUrl };

    console.log("Calling enhancement provider...");
    const result = await enhancementProvider.enhanceImage(enhancementRequest);
    console.log("Enhancement provider result:", result);

    if (result.status === "FAILED") {
      return NextResponse.json(
        {
          error: result.error || "Failed to enhance image via provider",
          details: result.providerRawResponse,
        },
        { status: 500 }
      );
    }

    // Construct a clear response for the client
    // providerRawResponse might be large or contain sensitive info not needed by client for polling
    const clientResponse = {
      requestId: result.requestId,
      status: result.status,
      // enhancedUrl will be undefined if status is IN_QUEUE or IN_PROGRESS
      enhancedUrl: result.enhancedImageUrl,
      // Extract status_url and determine provider_name for polling
      status_url: result.providerRawResponse?.status_url || null,
      provider_name: result.providerRawResponse?.status_url
        ? ImageEnhancementFactory.determineProviderType()
        : null,
      // Optionally, include a subset of providerRawResponse if useful and safe
      // provider_details: { queue_position: result.providerRawResponse?.queue_position }
    };

    // If status_url is missing when it's expected (e.g. IN_QUEUE), it's an issue
    if (
      (result.status === "IN_QUEUE" || result.status === "IN_PROGRESS") &&
      !clientResponse.status_url
    ) {
      console.error(
        "Enhancement provider returned queue/progress status without a status_url:",
        result
      );
      return NextResponse.json(
        {
          error: "Provider did not return a status URL for polling.",
          details: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(clientResponse);
  } catch (error) {
    console.error("Error in /api/enhance-image route:", error);
    let errorMessage = "Unknown error in enhance-image route";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
