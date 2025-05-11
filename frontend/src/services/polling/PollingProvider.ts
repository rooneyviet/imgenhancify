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
   * @param apiKey API key to authenticate with the provider.
   * @returns Promise containing PollingStatusResponse.
   */
  checkStatus(
    statusUrl: string,
    apiKey: string
  ): Promise<PollingStatusResponse>;

  /**
   * Extracts image result information from the data returned by checkStatus when status is COMPLETED.
   * @param responseData Data returned from checkStatus upon completion.
   * @param apiKey API key needed to fetch additional data if required (e.g., calling Fal.ai's response_url).
   * @returns Promise containing ImageResult.
   */
  getResult(responseData: any, apiKey: string): Promise<ImageResult>;

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
