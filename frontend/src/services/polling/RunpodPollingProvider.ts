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
