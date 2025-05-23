import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");
  const imageName = searchParams.get("name") || "downloaded-image";

  if (!imageUrl) {
    return NextResponse.json(
      { error: "Image URL is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to fetch image from S3: ${response.status} ${response.statusText}`,
        errorText
      );
      return NextResponse.json(
        {
          error: `Failed to fetch image: ${response.status} ${response.statusText}`,
          s3Error: errorText,
        },
        { status: response.status }
      );
    }

    const imageBlob = await response.blob();
    const headers = new Headers();
    headers.set("Content-Type", imageBlob.type);
    headers.set("Content-Disposition", `attachment; filename="${imageName}"`);

    return new NextResponse(imageBlob, { headers });
  } catch (error) {
    console.error("Error proxying image download:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to download image via proxy", details: errorMessage },
      { status: 500 }
    );
  }
}
