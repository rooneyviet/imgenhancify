import { NextRequest, NextResponse } from "next/server";

const IMGBB_API_URL = "https://api.imgbb.com/1/upload";
const IMAGE_EXPIRATION_SECONDS = 600; // 10 minutes, as per example

export async function POST(request: NextRequest) {
  console.log(
    "API /api/upload-image POST request received (ImgBB integration)"
  );
  try {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      console.error("IMGBB_API_KEY is not configured.");
      return NextResponse.json(
        { error: "Image upload service is not configured." },
        { status: 500 }
      );
    }

    const requestFormData = await request.formData();
    const file = requestFormData.get("file") as File | null;

    if (!file) {
      console.error("No file found in FormData");
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log(
      "File received for ImgBB upload:",
      file.name,
      file.size,
      file.type
    );

    const imgbbFormData = new FormData();
    imgbbFormData.append("image", file);
    // imgbbFormData.append('name', `user_upload_${Date.now()}_${file.name}`); // Optional: set a name for the image on ImgBB

    const uploadUrl = `${IMGBB_API_URL}?expiration=${IMAGE_EXPIRATION_SECONDS}&key=${apiKey}`;

    console.log(`Uploading to ImgBB: ${uploadUrl}`);

    const response = await fetch(uploadUrl, {
      method: "POST",
      body: imgbbFormData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("ImgBB upload failed:", result);
      const errorMessage =
        result?.error?.message || "Failed to upload image to ImgBB";
      return NextResponse.json(
        { error: errorMessage, details: result },
        { status: response.status || 500 }
      );
    }

    const imageUrl = result.data.url;
    const displayUrl = result.data.display_url; // ImgBB also provides a display_url
    const thumbUrl = result.data.thumb.url;
    const deleteUrl = result.data.delete_url; // IMPORTANT for deleting later

    console.log("ImgBB upload successful:");
    console.log("  URL:", imageUrl);
    console.log("  Display URL:", displayUrl);
    console.log("  Thumb URL:", thumbUrl);
    console.log("  Delete URL:", deleteUrl);

    // We should return the direct image URL (`result.data.url`) for fal.ai
    // And potentially the delete_url if we want the client to handle deletion,
    // or store it server-side (e.g., in a session or temporary DB) to delete it later.
    // For now, let's return the image URL and the delete URL.
    // The `delete-image` API will need to be adapted if we use ImgBB's delete_url.
    return NextResponse.json({
      imageUrl: imageUrl,
      provider_delete_url: deleteUrl, // This is specific to ImgBB
      provider_image_id: result.data.id, // ImgBB image ID
      message: "Image uploaded successfully to ImgBB.",
      imgbb_response: {
        // For debugging or more detailed client-side info if needed
        display_url: displayUrl,
        thumb_url: thumbUrl,
        size: result.data.size,
        expiration: result.data.expiration,
      },
    });
  } catch (error) {
    console.error("Error uploading image via ImgBB:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to upload image: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to upload image: Unknown error" },
      { status: 500 }
    );
  }
}
