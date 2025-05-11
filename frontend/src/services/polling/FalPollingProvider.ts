import {
  PollingProvider,
  PollingStatusResponse,
  ImageResult,
  PollingStatus,
} from "./PollingProvider";

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  // Fal.ai might return other fields depending on the model and status
  // Example: response_url, logs, error, etc.
  response_url?: string; // Usually present when status is IN_PROGRESS or COMPLETED
  [key: string]: any; // Allow other fields
}

export class FalPollingProvider implements PollingProvider {
  public async checkStatus(
    statusUrl: string,
    apiKey: string
  ): Promise<PollingStatusResponse> {
    if (!apiKey) {
      console.error("Fal API key is missing.");
      return { status: "FAILED", error: "Fal API key is missing." };
    }

    try {
      const response = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error(`Fal API error (${response.status}):`, errorData);
        return { status: "FAILED", error: errorData };
      }

      const falResponse: FalStatusResponse = await response.json();

      let pollingStatus: PollingStatus;
      switch (falResponse.status) {
        case "IN_QUEUE":
          pollingStatus = "IN_QUEUE";
          break;
        case "IN_PROGRESS":
          pollingStatus = "IN_PROGRESS";
          break;
        case "COMPLETED":
          pollingStatus = "COMPLETED";
          break;
        default:
          // If Fal.ai returns an unexpected status
          console.warn("Unknown status from Fal.ai:", falResponse.status);
          // Assume it's processing to continue polling, or could be considered FAILED depending on logic
          pollingStatus = "IN_PROGRESS";
      }

      // Return the entire falResponse in data so getResult can use it
      return { status: pollingStatus, data: falResponse };
    } catch (error) {
      console.error("Error checking Fal status:", error);
      return {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async getResult(
    responseData: any,
    apiKey: string
  ): Promise<ImageResult> {
    // responseData here is falResponse from checkStatus (result of calling status_url)
    const falInitialStatusResponse = responseData as FalStatusResponse;

    if (
      !falInitialStatusResponse ||
      typeof falInitialStatusResponse !== "object"
    ) {
      throw new Error("Invalid initial status response data for getResult");
    }

    // Based on your feedback, when status is COMPLETED, falInitialStatusResponse.response_url
    // is the URL that needs to be fetched to get the actual image URL.
    if (
      falInitialStatusResponse.response_url &&
      typeof falInitialStatusResponse.response_url === "string"
    ) {
      const finalResultUrl = falInitialStatusResponse.response_url;
      console.log(
        `[FalPollingProvider] Status COMPLETED. Fetching final result from: ${finalResultUrl}`
      );

      if (!apiKey) {
        // This should not happen if the API route passes the apiKey
        console.error(
          "[FalPollingProvider] API key is missing in getResult, cannot fetch final result URL."
        );
        throw new Error(
          "API key missing, cannot fetch final result from Fal.ai."
        );
      }

      try {
        const finalResponse = await fetch(finalResultUrl, {
          method: "GET",
          headers: {
            Authorization: `Key ${apiKey}`,
            Accept: "application/json", // Request JSON response
          },
        });

        if (!finalResponse.ok) {
          const errorText = await finalResponse.text();
          console.error(
            `[FalPollingProvider] Error fetching final result from ${finalResultUrl} (status ${finalResponse.status}):`,
            errorText
          );
          throw new Error(
            `Failed to fetch final result from Fal.ai: ${finalResponse.status} - ${errorText}`
          );
        }

        const finalResultData = await finalResponse.json();
        console.log(
          `[FalPollingProvider] Received final result data:`,
          JSON.stringify(finalResultData, null, 2)
        );

        // Based on your example: {"image":{"url":"..."}}
        if (
          finalResultData &&
          finalResultData.image &&
          typeof finalResultData.image.url === "string"
        ) {
          return { imageUrl: finalResultData.image.url };
        } else {
          console.error(
            "[FalPollingProvider] Could not extract direct image URL from final Fal.ai response. Expected format like { image: { url: '...' } }.",
            finalResultData
          );
          throw new Error(
            "Direct image URL not found in the final Fal.ai response structure."
          );
        }
      } catch (error) {
        console.error(
          `[FalPollingProvider] Exception while fetching or parsing final result from ${finalResultUrl}:`,
          error
        );
        throw error; // Rethrow error for API route to handle
      }
    } else {
      // Fallback or error if response_url is missing when COMPLETED
      // Based on old logic, but this might no longer be appropriate.
      console.warn(
        "[FalPollingProvider] COMPLETED status but no response_url found in initial status data. Attempting direct extraction (legacy).",
        falInitialStatusResponse
      );
      let imageUrl: string | undefined;
      if (
        falInitialStatusResponse.images &&
        Array.isArray(falInitialStatusResponse.images) &&
        falInitialStatusResponse.images.length > 0 &&
        falInitialStatusResponse.images[0].url
      ) {
        imageUrl = falInitialStatusResponse.images[0].url;
      } else if (falInitialStatusResponse.image_url) {
        imageUrl = falInitialStatusResponse.image_url;
      } else if (
        falInitialStatusResponse.output &&
        typeof falInitialStatusResponse.output === "string" &&
        falInitialStatusResponse.output.startsWith("http")
      ) {
        imageUrl = falInitialStatusResponse.output;
      }

      if (imageUrl) {
        console.log(
          "[FalPollingProvider] Extracted imageUrl via legacy method:",
          imageUrl
        );
        return { imageUrl };
      }

      console.error(
        "[FalPollingProvider] Could not extract image URL. Status was COMPLETED, but response_url was missing or direct extraction failed.",
        falInitialStatusResponse
      );
      throw new Error(
        "Image URL not found in Fal response after completion (response_url missing or invalid)."
      );
    }
  }

  public getPollingInterval(): number {
    return 3000; // 1 second
  }

  public getMaxPollingDuration(): number {
    return 300000; // 5 minutes
  }
}
