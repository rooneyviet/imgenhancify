import { useQuery, Query } from "@tanstack/react-query";
import { useEffect } from "react"; // Import useEffect
import { useImageUploadStore } from "@/lib/store/imageUploadStore";

interface PollImageStatusPayload {
  providerName: string;
  statusUrl: string;
  apiKeyName?: string; // Optional, as per requirements
}

interface PollImageStatusResponse {
  imageUrl?: string;
  message?: string; // For errors or other statuses
  // Fal.ai specific fields that might come through the poll-image-status route
  status?: string; // e.g., "IN_PROGRESS", "COMPLETED", "ERROR"
  error?: any;
  logs?: any[];
  interim_images?: any[]; // If the API supports interim results
}

const POLLING_INTERVAL = 3000; // Poll every 3 seconds
const MAX_POLLING_ATTEMPTS = 20; // Stop after 20 attempts (1 minute)

async function pollImageStatus(
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

export const useImagePolling = () => {
  const {
    pollingStatusUrl,
    pollingProviderName,
    setIsPolling,
    setEnhancedImageUrl,
    setPollingError,
    startPolling, // Use the new action
    isPolling,
  } = useImageUploadStore();

  const queryKey = ["pollImageStatus", pollingStatusUrl, pollingProviderName];

  // This query will only be enabled if pollingStatusUrl and pollingProviderName are set,
  // and isPolling is true.

  const queryFn = () => {
    if (!pollingStatusUrl || !pollingProviderName) {
      // This should ideally not be reached if 'enabled' logic is correct,
      // but it's a safeguard.
      throw new Error(
        "Polling attempted without required URL or provider name."
      );
    }
    return pollImageStatus({
      statusUrl: pollingStatusUrl,
      providerName: pollingProviderName,
      apiKeyName: pollingProviderName === "fal" ? "FAL_AI_KEY" : undefined,
    });
  };

  const { data, error, isLoading, refetch } = useQuery<
    PollImageStatusResponse,
    Error,
    PollImageStatusResponse,
    typeof queryKey // Use typeof queryKey for the QueryKey type
  >({
    // Pass a single options object
    queryKey: queryKey,
    queryFn: queryFn,
    enabled: !!pollingStatusUrl && !!pollingProviderName && isPolling,
    refetchInterval: (
      // data: PollImageStatusResponse | undefined, // data is the first argument
      // query: Query<PollImageStatusResponse, Error, PollImageStatusResponse, typeof queryKey> // query is the second argument
      // TanStack Query v5 for useQuery's refetchInterval, the first param is the data, second is the query object.
      // Let's ensure the type for query is correct.
      query: Query<
        PollImageStatusResponse,
        Error,
        PollImageStatusResponse,
        typeof queryKey
      >
    ) => {
      const currentData = query.state.data; // Access data from query.state
      const storeActions = useImageUploadStore.getState();

      if (currentData?.imageUrl) {
        return false; // Success: imageUrl received. onSuccess will handle store updates.
      }
      if (query.state.status === "error") {
        return false; // Error state, onError will handle.
      }

      // Fal specific statuses that mean "final"
      if (
        currentData?.status === "COMPLETED" ||
        currentData?.status === "ERROR"
      ) {
        // onSuccess will handle these cases by calling setPollingError if needed.
        return false;
      }

      // Check for max polling attempts
      // query.state.dataUpdateCount counts successful fetches.
      // We should count total fetches or time. Let's use dataUpdateCount for now.
      if (query.state.dataUpdateCount + 1 >= MAX_POLLING_ATTEMPTS) {
        if (!currentData?.imageUrl) {
          // Use a microtask to defer store update slightly
          Promise.resolve().then(() => {
            storeActions.setPollingError(
              `Polling timed out after ${MAX_POLLING_ATTEMPTS} attempts. Last status: ${currentData?.status || "unknown"}.`
            );
          });
        }
        return false; // Stop polling
      }
      return POLLING_INTERVAL;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: (failureCount: number, err: Error) => {
      if (failureCount >= 2) return false;
      return true;
    },
    // onSuccess and onError are removed from options and handled by useEffect below
  });

  useEffect(() => {
    const storeActions = useImageUploadStore.getState();
    if (data) {
      // `data` is from the useQuery destructuring
      if (data.imageUrl) {
        storeActions.setEnhancedImageUrl(data.imageUrl);
      } else if (data.status === "COMPLETED" && !data.imageUrl) {
        storeActions.setPollingError(
          data.message || "Processing completed but no image URL was returned."
        );
      } else if (data.status === "ERROR") {
        storeActions.setPollingError(
          data.error?.message ||
            data.message ||
            `Image processing failed with status: ${data.status}`
        );
      } else if (
        data.status &&
        data.status !== "IN_PROGRESS" &&
        data.status !== "COMPLETED"
      ) {
        // This handles other unexpected final statuses.
        // COMPLETED without imageUrl is handled above.
        storeActions.setPollingError(
          data.error?.message ||
            data.message ||
            `Image processing resulted in an unexpected status: ${data.status}`
        );
      }
      // isPolling is set to false by setEnhancedImageUrl or setPollingError in the store
    }
  }, [data]); // Rerun when data changes

  useEffect(() => {
    if (error) {
      // `error` is from the useQuery destructuring
      useImageUploadStore
        .getState()
        .setPollingError(
          error.message || "An unknown error occurred during polling."
        );
      // isPolling is set to false by setPollingError in the store
    }
  }, [error]); // Rerun when error changes

  // Function to manually trigger the start of polling,
  // which will set the necessary store states and enable the useQuery.
  const initiatePolling = (statusUrl: string, providerName: string) => {
    startPolling(statusUrl, providerName); // This sets isPolling to true and other info
    // refetch(); // Optionally trigger an immediate fetch, though useQuery will fetch when enabled
  };

  return {
    initiatePolling,
    isPollingQueryLoading: isLoading, // Expose loading state of the query itself
    pollingData: data,
    pollingQueryError: error,
  };
};
