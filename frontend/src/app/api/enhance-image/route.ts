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

    // Return the response from the provider (e.g., includes requestId)
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in /api/enhance-image route:", error);
    let errorMessage = "Unknown error in enhance-image route";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
