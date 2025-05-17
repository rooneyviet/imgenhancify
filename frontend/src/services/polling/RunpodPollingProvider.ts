import {
  PollingProvider,
  PollingStatusResponse,
  ImageResult,
  PollingStatus,
} from "./PollingProvider";

interface RunpodStatusResponse {
  status: string; // "COMPLETED", "FAILED", "IN_QUEUE", "IN_PROGRESS", etc.
  output?: {
    images?: Array<{
      data: string; // Base64 encoded image data
    }>;
  };
  error?: string; // Error message if status is "FAILED"
}

export class RunpodPollingProvider implements PollingProvider {
  /**
   * Cancels a Runpod job that is currently in the IN_QUEUE status
   * @param statusUrl The status URL of the job to cancel
   * @param apiKey The Runpod API key
   * @returns Promise with success status and optional error message
   */
  public async cancelJob(
    statusUrl: string,
    apiKey: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!apiKey) {
      console.error("Runpod API key is missing for cancellation.");
      return { success: false, error: "Runpod API key is missing." };
    }

    try {
      // Extract endpoint_id and job_id from the statusUrl
      // Example: https://api.runpod.ai/v2/abc-endpoint/status/xyz-job-id
      const urlParts = statusUrl.split("/");
      if (urlParts.length < 2) {
        return { success: false, error: "Invalid status URL format." };
      }

      const jobId = urlParts[urlParts.length - 1]; // Last part is job_id
      const endpointId = urlParts[urlParts.length - 3]; // Third from last is endpoint_id

      if (!jobId || !endpointId) {
        console.error(
          `Failed to extract job ID or endpoint ID from URL: ${statusUrl}`
        );
        return {
          success: false,
          error: "Could not extract job ID or endpoint ID from status URL.",
        };
      }

      // Construct the cancel URL
      const cancelUrl = `https://api.runpod.ai/v2/${endpointId}/cancel/${jobId}`;
      console.log(
        `[RunpodPollingProvider] Attempting to cancel job at: ${cancelUrl}`
      );

      const response = await fetch(cancelUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error(
          `Runpod cancellation API error (${response.status}):`,
          errorData
        );
        return {
          success: false,
          error:
            typeof errorData.message === "string"
              ? errorData.message
              : `Failed to cancel job: ${response.status} ${response.statusText}`,
        };
      }

      console.log(
        `[RunpodPollingProvider] Successfully cancelled job: ${jobId}`
      );
      return { success: true };
    } catch (error) {
      console.error("Error cancelling Runpod job:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during cancellation",
      };
    }
  }
  public async checkStatus(
    statusUrl: string,
    apiKey: string
  ): Promise<PollingStatusResponse> {
    if (!apiKey) {
      console.error("Runpod API key is missing.");
      return { status: "FAILED", error: "Runpod API key is missing." };
    }

    try {
      console.log(`[RunpodPollingProvider] Checking status at: ${statusUrl}`);

      const response = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error(`Runpod API error (${response.status}):`, errorData);
        return { status: "FAILED", error: errorData };
      }

      const runpodResponse: RunpodStatusResponse = await response.json();
      console.log(
        `[RunpodPollingProvider] Received status: ${runpodResponse.status}`
      );

      let pollingStatus: PollingStatus;
      switch (runpodResponse.status) {
        case "IN_QUEUE":
          pollingStatus = "IN_QUEUE";
          break;
        case "IN_PROGRESS":
          pollingStatus = "IN_PROGRESS";
          break;
        case "COMPLETED":
          pollingStatus = "COMPLETED";
          break;
        case "FAILED":
        case "CANCELLED":
          pollingStatus = "FAILED";
          break;
        default:
          console.warn("Unknown status from Runpod:", runpodResponse.status);
          // Assume it's processing to continue polling
          pollingStatus = "IN_PROGRESS";
      }

      // Return the entire runpodResponse in data so getResult can use it
      return { status: pollingStatus, data: runpodResponse };
    } catch (error) {
      console.error("Error checking Runpod status:", error);
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
    const runpodResponse = responseData as RunpodStatusResponse;

    if (!runpodResponse || typeof runpodResponse !== "object") {
      throw new Error("Invalid response data for getResult");
    }

    if (runpodResponse.status === "COMPLETED") {
      if (
        runpodResponse.output &&
        runpodResponse.output.images &&
        Array.isArray(runpodResponse.output.images) &&
        runpodResponse.output.images.length > 0 &&
        runpodResponse.output.images[0].data
      ) {
        // Extract the base64 image data and create a data URL
        const base64Data = runpodResponse.output.images[0].data;
        const imageUrl = `data:image/png;base64,${base64Data}`;
        console.log(
          "[RunpodPollingProvider] Successfully extracted image data"
        );
        return { imageUrl };
      } else {
        console.error(
          "[RunpodPollingProvider] Status is COMPLETED but no image data found in response",
          runpodResponse
        );
        throw new Error("No image data found in completed Runpod response");
      }
    } else if (runpodResponse.status === "FAILED") {
      const errorMessage = runpodResponse.error || "Unknown error from Runpod";
      console.error("[RunpodPollingProvider] Job failed:", errorMessage);
      throw new Error(`Runpod job failed: ${errorMessage}`);
    } else {
      console.error(
        "[RunpodPollingProvider] getResult called with non-completed status:",
        runpodResponse.status
      );
      throw new Error(
        `Cannot get result for job with status: ${runpodResponse.status}`
      );
    }
  }

  public getPollingInterval(): number {
    return 3000; // 3 seconds
  }

  public getMaxPollingDuration(): number {
    return 300000; // 5 minutes
  }
}
