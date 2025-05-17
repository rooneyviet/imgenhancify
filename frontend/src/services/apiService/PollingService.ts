/**
 * Service for handling image processing status polling and job cancellation
 */

/**
 * Request payload for polling image status
 */
export interface PollImageStatusPayload {
  statusUrl: string;
  providerName: string;
  apiKeyName?: string;
}

/**
 * Response type for the poll image status API
 */
export interface PollImageStatusResponse {
  imageUrl?: string;
  message?: string;
  status?: string; // e.g., "IN_PROGRESS", "COMPLETED", "ERROR", "IN_QUEUE"
  error?: any;
  logs?: any[];
  interim_images?: any[];
}

/**
 * Response type for the cancel job API
 */
export interface CancelJobResponse {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Fetches the current status of an image processing job
 * @param payload The polling request payload containing statusUrl and providerName
 * @returns Promise resolving to the polling response
 * @throws Error if the polling request fails
 */
export async function fetchPollingStatus(
  payload: PollImageStatusPayload
): Promise<PollImageStatusResponse> {
  const response = await fetch("/api/poll-image-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData: { error?: string; message?: string } = {
      message: `Polling request failed with status: ${response.status}`,
    };

    try {
      const parsedError = await response.json();
      // Our API route returns { error: "message" }
      if (parsedError && typeof parsedError.error === "string") {
        errorData.message = parsedError.error;
      } else if (parsedError && typeof parsedError.message === "string") {
        // Fallback if there is a message
        errorData.message = parsedError.message;
      }
    } catch (e) {
      // If JSON parsing fails, keep the original fetch error
      console.error(
        "Failed to parse error response JSON from /api/poll-image-status:",
        e
      );
    }

    throw new Error(errorData.message);
  }

  return response.json();
}

/**
 * Cancels an active image processing job
 * @param statusUrl The status URL of the job to cancel
 * @param providerName The name of the provider (e.g., "runpod")
 * @returns Promise resolving to the cancellation response
 */
export async function cancelJob(
  statusUrl: string,
  providerName: string
): Promise<CancelJobResponse> {
  try {
    // Currently, we only have a cancel endpoint for Runpod jobs
    // This could be extended to support other providers in the future
    const endpoint =
      providerName.toLowerCase() === "runpod"
        ? "/api/cancel-runpod-job"
        : `/api/cancel-${providerName.toLowerCase()}-job`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ statusUrl, providerName }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed with status: ${response.status}`,
      };
    }

    return { success: true, ...data };
  } catch (e) {
    console.error(`Error calling cancel job API for ${providerName}:`, e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown cancellation error",
    };
  }
}
