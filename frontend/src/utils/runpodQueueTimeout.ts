/**
 * Utility for handling Runpod queue timeouts
 * This module provides functions to track and manage timeouts for Runpod jobs in the IN_QUEUE state
 */

// Timeout for Runpod jobs in IN_QUEUE status (60 seconds)
export const RUNPOD_QUEUE_TIMEOUT_MS = 60000;

// Map to track when jobs first entered the IN_QUEUE state
// Key: statusUrl, Value: timestamp when first seen in queue
const queueStartTimeMap = new Map<string, number>();

/**
 * Records when a job enters the IN_QUEUE state
 * @param statusUrl The status URL of the job
 * @returns The timestamp when the job was first seen in queue
 */
export function trackJobInQueue(statusUrl: string): number {
  // Only set the timestamp if this is the first time we're seeing this job in queue
  if (!queueStartTimeMap.has(statusUrl)) {
    const timestamp = Date.now();
    queueStartTimeMap.set(statusUrl, timestamp);
    console.log(
      `[RunpodQueueTimeout] Job ${statusUrl} entered IN_QUEUE state. Starting queue timer at ${new Date(timestamp).toISOString()}.`
    );
    return timestamp;
  }

  // If we already have a timestamp, return it without updating
  const existingTimestamp = queueStartTimeMap.get(statusUrl)!;
  console.log(
    `[RunpodQueueTimeout] Job ${statusUrl} already being tracked since ${new Date(existingTimestamp).toISOString()}, elapsed: ${Date.now() - existingTimestamp}ms.`
  );
  return existingTimestamp;
}

/**
 * Checks if a job has exceeded the queue timeout
 * @param statusUrl The status URL of the job
 * @returns Object containing whether the job has timed out and how long it's been in queue
 */
export function hasExceededQueueTimeout(statusUrl: string): {
  hasTimedOut: boolean;
  timeInQueue: number | null;
} {
  if (!queueStartTimeMap.has(statusUrl)) {
    console.log(
      `[RunpodQueueTimeout] Job ${statusUrl} not found in queue tracking map.`
    );
    return { hasTimedOut: false, timeInQueue: null };
  }

  const queueStartTime = queueStartTimeMap.get(statusUrl)!;
  const timeInQueue = Date.now() - queueStartTime;
  const hasTimedOut = timeInQueue > RUNPOD_QUEUE_TIMEOUT_MS;

  if (hasTimedOut) {
    console.log(
      `[RunpodQueueTimeout] Job ${statusUrl} has TIMED OUT after ${timeInQueue}ms in queue (started at ${new Date(queueStartTime).toISOString()}, timeout is ${RUNPOD_QUEUE_TIMEOUT_MS}ms).`
    );
  } else {
    console.log(
      `[RunpodQueueTimeout] Job ${statusUrl} has been in queue for ${timeInQueue}ms (started at ${new Date(queueStartTime).toISOString()}, timeout is ${RUNPOD_QUEUE_TIMEOUT_MS}ms).`
    );
  }

  return {
    hasTimedOut,
    timeInQueue,
  };
}

/**
 * Removes a job from the queue tracking map
 * @param statusUrl The status URL of the job
 */
export function removeJobFromQueueTracking(statusUrl: string): void {
  if (queueStartTimeMap.has(statusUrl)) {
    queueStartTimeMap.delete(statusUrl);
    console.log(
      `[RunpodQueueTimeout] Job ${statusUrl} removed from queue tracking.`
    );
  }
}

/**
 * Cancels a Runpod job that has exceeded the queue timeout
 * @param statusUrl The status URL of the job
 * @returns Promise resolving to the result of the cancellation request
 */
export async function cancelTimedOutJob(statusUrl: string): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log(
    `[RunpodQueueTimeout] Attempting to cancel timed out job: ${statusUrl}`
  );

  try {
    const response = await fetch("/api/cancel-runpod-job", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ statusUrl }),
    });

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.error(
        `[RunpodQueueTimeout] Error parsing JSON response from cancel API:`,
        jsonError
      );
      result = { error: "Failed to parse cancellation response" };
    }

    // Clean up regardless of success or failure
    removeJobFromQueueTracking(statusUrl);

    if (!response.ok) {
      console.error(
        `[RunpodQueueTimeout] Failed to cancel job (${response.status}):`,
        result
      );
      return {
        success: false,
        error:
          result.error ||
          `Failed to cancel job: ${response.status} ${response.statusText}`,
      };
    }

    console.log(
      `[RunpodQueueTimeout] Successfully cancelled job: ${statusUrl}`
    );
    return {
      success: true,
    };
  } catch (error) {
    console.error(
      `[RunpodQueueTimeout] Exception during job cancellation:`,
      error
    );

    // Clean up on error
    removeJobFromQueueTracking(statusUrl);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during cancellation",
    };
  }
}
