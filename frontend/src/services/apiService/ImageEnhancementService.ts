/**
 * Service for handling image enhancement API operations
 */

/**
 * Request payload for the enhance image API
 */
export interface EnhanceImageRequest {
  image_url: string;
  provider?: string;
  workflow?: any; // This could be refined to a more specific type based on workflow structure
}

/**
 * Response type for the enhance image API
 */
export interface EnhanceImageResponse {
  enhancedUrl?: string;
  status_url?: string;
  provider_name?: string;
  request_id?: string;
  status?: string;
  message?: string;
  error?: string;
}

/**
 * Requests enhancement of an image
 * @param imageUrl URL of the image to enhance
 * @param provider Optional provider name for the enhancement service
 * @param workflow Optional workflow configuration for the enhancement process
 * @returns Promise resolving to the enhancement response
 * @throws Error if the enhancement request fails
 */
export async function requestEnhancement(
  imageUrl: string,
  provider?: string,
  workflow?: any
): Promise<EnhanceImageResponse> {
  // Prepare the request payload
  const payload: EnhanceImageRequest = {
    image_url: imageUrl,
  };

  // Add optional parameters if provided
  if (provider) {
    payload.provider = provider;
  }

  if (workflow) {
    payload.workflow = workflow;
  }

  // Make the API request
  const response = await fetch("/api/enhance-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Handle error responses
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "Image processing failed. Please try again."
    );
  }

  // Parse the response
  const enhanceResult = await response.json();

  // Validate the response structure
  if (!enhanceResult.enhancedUrl && !enhanceResult.status_url) {
    throw new Error(
      enhanceResult.error || "Unexpected enhancement API response structure."
    );
  }

  return enhanceResult;
}
