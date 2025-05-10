import {
  ImageEnhancementProvider,
  EnhancementRequest,
  EnhancementResponse,
} from "./ImageEnhancementProvider";

// Ensure this URL is correct for the specific fal.ai model you're using.
// This one is for "fal-ai/drct-super-resolution" as per the initial prompt.
const FAL_API_URL = "https://queue.fal.run/fal-ai/drct-super-resolution";

export class FalAIProvider implements ImageEnhancementProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FAL_API_KEY || "";
    if (
      !this.apiKey ||
      this.apiKey === "YOUR_FAL_API_KEY_HERE" ||
      this.apiKey.trim() === ""
    ) {
      console.warn(
        "FalAIProvider: FAL_API_KEY is not configured or using placeholder. API calls will be mocked."
      );
    }
  }

  async enhanceImage(
    request: EnhancementRequest
  ): Promise<EnhancementResponse> {
    console.log("FalAIProvider: enhanceImage called with:", request.imageUrl);

    if (
      !this.apiKey ||
      this.apiKey === "YOUR_FAL_API_KEY_HERE" ||
      this.apiKey.trim() === ""
    ) {
      console.warn(
        "FalAIProvider: Mocking API call due to missing/placeholder API key."
      );
      const mockRequestId = `mock_fal_req_${Date.now()}`;
      return {
        requestId: mockRequestId,
        status: "QUEUED_MOCKED",
        providerRawResponse: {
          note: "This is a mocked response as FAL_API_KEY is not set.",
        },
      };
    }

    try {
      console.log(`FalAIProvider: Calling fal.ai API at ${FAL_API_URL}`);
      const payload = {
        image_url: request.imageUrl,
        upscaling_factor: 4, // As per initial prompt, make this configurable if needed
        // Add other parameters specific to the fal.ai model if necessary
      };

      console.log("FalAIProvider: Sending payload:", payload);

      const response = await fetch(FAL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      console.log(
        "FalAIProvider: Received response from fal.ai:",
        responseData
      );

      if (!response.ok) {
        console.error(
          "FalAIProvider: fal.ai API call failed with status:",
          response.status,
          responseData
        );
        return {
          status: "FAILED",
          error: `Fal.ai API error (status ${response.status}): ${responseData?.detail || responseData?.message || "Unknown error"}`,
          providerRawResponse: responseData,
        };
      }

      // Assuming fal.ai returns a request_id for async operations,
      // and other relevant info. Adapt based on actual fal.ai response structure.
      // The initial prompt mentioned:
      // REQUEST_ID=$(echo "$response" | grep -o '"request_id": *"[^"]*"' | sed 's/"request_id": *//; s/"//g')
      // This implies the response is JSON and contains a "request_id" field.
      // Fal.ai might also return a direct result for some models or a status.
      // For queue.fal.run, it usually returns a response that includes a URL to poll for the result.
      // Example response from queue.fal.run:
      // {
      //   "request_id": "some-uuid",
      //   "status_url": "https://queue.fal.run/fal-ai/drct-super-resolution/requests/some-uuid/status",
      //   "result_url": "https://queue.fal.run/fal-ai/drct-super-resolution/requests/some-uuid"
      //   ... other fields
      // }
      // Or for synchronous models, it might directly return the output.
      // The prompt asked to return what fal.ai provides, including request_id.

      // Let's assume the responseData contains at least a request_id or similar identifier.
      // And potentially a status.
      return {
        requestId: responseData.request_id || responseData.id, // Adjust based on actual fal.ai response
        status: responseData.status || "SUBMITTED_TO_FAL", // Or map from fal.ai's actual status
        enhancedImageUrl: responseData.image_url, // If fal.ai returns the enhanced image URL directly (sync)
        providerRawResponse: responseData,
      };
    } catch (error) {
      console.error("FalAIProvider: Error calling fal.ai API:", error);
      let errorMessage = "Unknown error during fal.ai API call";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        status: "FAILED",
        error: `FalAIProvider: ${errorMessage}`,
        providerRawResponse: error,
      };
    }
  }
}
