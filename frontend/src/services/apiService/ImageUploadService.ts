/**
 * Service for handling image upload API operations
 */

/**
 * Response type for the upload image API
 */
export interface UploadImageResponse {
  imageUrl: string;
  message?: string;
  error?: string;
}

/**
 * Uploads an image file to the server
 * @param file The file to upload
 * @returns Promise resolving to the upload response containing the image URL
 * @throws Error if the upload fails
 */
export async function uploadImage(file: File): Promise<UploadImageResponse> {
  // Create form data for the file upload
  const formData = new FormData();
  formData.append("file", file);

  // Make the API request
  const response = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });

  // Handle error responses
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "Original image upload failed. Please try again."
    );
  }

  // Parse and validate the response
  const uploadResult = await response.json();
  if (!uploadResult.imageUrl) {
    throw new Error("Did not receive image URL from upload API.");
  }

  return uploadResult;
}
