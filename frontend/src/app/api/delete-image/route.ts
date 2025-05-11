import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  console.log(
    "API /api/delete-image POST request received (ImgBB integration)"
  );
  try {
    const body = await request.json();
    const providerDeleteUrl = body.provider_delete_url;

    if (!providerDeleteUrl) {
      console.error(
        "No provider_delete_url provided in request body for deletion"
      );
      return NextResponse.json(
        { error: "Missing provider_delete_url" },
        { status: 400 }
      );
    }

    // Validate if it looks like a URL (basic check)
    try {
      new URL(providerDeleteUrl);
    } catch (_) {
      console.error("Invalid provider_delete_url format:", providerDeleteUrl);
      return NextResponse.json(
        { error: "Invalid provider_delete_url format" },
        { status: 400 }
      );
    }

    console.log(
      "Request to delete image using provider_delete_url:",
      providerDeleteUrl
    );

    // ImgBB's delete_url is typically a GET request.
    // We are wrapping it in our POST API for consistency or potential future needs.
    // No API key is needed for ImgBB deletion if you have the delete_url.
    const response = await fetch(providerDeleteUrl, {
      method: "GET",
      // ImgBB delete URLs are typically pre-signed and don't require auth headers.
      // However, their API for "deleting an image" (if different from delete_url) might.
      // For now, assuming delete_url is a direct GET.
    });

    // ImgBB's delete URL typically redirects or returns a simple HTML page.
    // A 200 OK status usually means it worked or the image was already gone.
    // It might not return a JSON response indicating success/failure of deletion itself.
    if (!response.ok) {
      // It's hard to get a definitive failure message from ImgBB's delete link directly.
      // We'll log the status and assume failure if not 2xx.
      const responseText = await response
        .text()
        .catch(() => "Could not read response text");
      console.error(
        `ImgBB deletion via URL failed. Status: ${response.status}. Response: ${responseText.substring(0, 200)}...`
      );
      return NextResponse.json(
        {
          error: `Failed to delete image from provider. Status: ${response.status}`,
        },
        { status: response.status }
      );
    }

    // If response.ok, we assume deletion was successful or image was already gone.
    console.log(
      `ImgBB image deletion request to ${providerDeleteUrl} was successful (status ${response.status}).`
    );

    return NextResponse.json({
      message: `Image deletion request processed for ${providerDeleteUrl}.`,
    });
  } catch (error) {
    console.error("Error deleting image via provider_delete_url:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to delete image: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete image: Unknown error" },
      { status: 500 }
    );
  }
}
