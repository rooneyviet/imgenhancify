export type PollingStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface PollingStatusResponse {
  status: PollingStatus;
  data?: any; // Data returned from the provider, can be any or a more specific type
  error?: any; // Error information if any
}

export interface ImageResult {
  imageUrl: string;
  // Other fields can be added if needed, e.g., metadata, thumbnailUrls, etc.
}

export interface PollingProvider {
  /**
   * Sends a request to statusUrl to check the status of the task.
   * @param statusUrl URL to check the status.
   * @returns Promise containing PollingStatusResponse.
   */
  checkStatus(statusUrl: string): Promise<PollingStatusResponse>;

  /**
   * Extracts image result information from the data returned by checkStatus when status is COMPLETED.
   * @param responseData Data returned from checkStatus upon completion.
   * @returns Promise containing ImageResult.
   */
  getResult(responseData: any): Promise<ImageResult>;

  /**
   * Returns the interval (ms) between polls.
   * @returns Polling interval.
   */
  getPollingInterval(): number;

  /**
   * Returns the maximum polling duration (ms).
   * @returns Maximum polling duration.
   */
  getMaxPollingDuration(): number;
}
