import { useQuery, Query } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useImageUploadStore, ImageItem } from "@/lib/store/imageUploadStore";

interface PollImageStatusPayload {
  providerName: string;
  statusUrl: string;
  apiKeyName?: string;
}

interface PollImageStatusResponse {
  imageUrl?: string;
  message?: string; // For errors or other statuses
  // Fal.ai specific fields that might come through the poll-image-status route
  status?: string; // e.g., "IN_PROGRESS", "COMPLETED", "ERROR"
  error?: any;
  logs?: any[];
  interim_images?: any[];
}

const POLLING_INTERVAL = 3000;
const MAX_POLLING_ATTEMPTS = 20;

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

interface UseImagePollingProps {
  imageId: string;
}

export const useImagePolling = ({ imageId }: UseImagePollingProps) => {
  const store = useImageUploadStore();
  const [image, setImage] = useState<ImageItem | undefined>(
    store.images.find((img) => img.id === imageId)
  );

  // Update the image reference when it changes in the store
  useEffect(() => {
    const updateImage = () => {
      const currentImage = useImageUploadStore
        .getState()
        .images.find((img) => img.id === imageId);
      setImage(currentImage);
    };

    // Initial update
    updateImage();

    // Subscribe to store changes
    const unsubscribe = useImageUploadStore.subscribe(updateImage);
    return () => unsubscribe();
  }, [imageId]);

  const queryKey = [
    "pollImageStatus",
    imageId,
    image?.pollingStatusUrl,
    image?.pollingProviderName,
  ];

  const queryFn = () => {
    if (!image || !image.pollingStatusUrl || !image.pollingProviderName) {
      throw new Error(
        "Polling attempted without required URL or provider name."
      );
    }
    return pollImageStatus({
      statusUrl: image.pollingStatusUrl,
      providerName: image.pollingProviderName,
      apiKeyName:
        image.pollingProviderName === "fal" ? "FAL_AI_KEY" : undefined,
    });
  };

  const { data, error, isLoading, refetch } = useQuery<
    PollImageStatusResponse,
    Error,
    PollImageStatusResponse,
    typeof queryKey
  >({
    queryKey: queryKey,
    queryFn: queryFn,
    enabled:
      !!image?.pollingStatusUrl &&
      !!image?.pollingProviderName &&
      !!image?.isPolling,
    refetchInterval: (
      query: Query<
        PollImageStatusResponse,
        Error,
        PollImageStatusResponse,
        typeof queryKey
      >
    ) => {
      const currentData = query.state.data;
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
        return false;
      }

      // Check for max polling attempts
      if (query.state.dataUpdateCount + 1 >= MAX_POLLING_ATTEMPTS) {
        if (!currentData?.imageUrl) {
          // Use a microtask to defer store update slightly
          Promise.resolve().then(() => {
            storeActions.updateImage(imageId, {
              isPolling: false,
              pollingError: `Polling timed out after ${MAX_POLLING_ATTEMPTS} attempts. Last status: ${currentData?.status || "unknown"}.`,
            });

            // Process next image in queue after a delay
            setTimeout(() => {
              storeActions.processNextImage();
            }, 2000); // 2-second delay as specified in requirements
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
  });

  useEffect(() => {
    const storeActions = useImageUploadStore.getState();
    if (data && image) {
      if (data.imageUrl) {
        storeActions.updateImage(imageId, {
          enhancedImageUrl: data.imageUrl,
          isPolling: false,
        });

        // Process next image in queue after a delay
        setTimeout(() => {
          storeActions.processNextImage();
        }, 2000); // 2-second delay as specified in requirements
      } else if (data.status === "COMPLETED" && !data.imageUrl) {
        storeActions.updateImage(imageId, {
          isPolling: false,
          pollingError:
            data.message ||
            "Processing completed but no image URL was returned.",
        });

        // Process next image in queue after a delay
        setTimeout(() => {
          storeActions.processNextImage();
        }, 2000);
      } else if (data.status === "ERROR") {
        storeActions.updateImage(imageId, {
          isPolling: false,
          pollingError:
            data.error?.message ||
            data.message ||
            `Image processing failed with status: ${data.status}`,
        });

        // Process next image in queue after a delay
        setTimeout(() => {
          storeActions.processNextImage();
        }, 2000);
      } else if (
        data.status &&
        data.status !== "IN_PROGRESS" &&
        data.status !== "COMPLETED"
      ) {
        storeActions.updateImage(imageId, {
          isPolling: false,
          pollingError:
            data.error?.message ||
            data.message ||
            `Image processing resulted in an unexpected status: ${data.status}`,
        });

        // Process next image in queue after a delay
        setTimeout(() => {
          storeActions.processNextImage();
        }, 2000);
      }
    }
  }, [data, imageId, image]);

  useEffect(() => {
    if (error && image) {
      const storeActions = useImageUploadStore.getState();
      storeActions.updateImage(imageId, {
        isPolling: false,
        pollingError:
          error.message || "An unknown error occurred during polling.",
      });

      // Process next image in queue after a delay
      setTimeout(() => {
        storeActions.processNextImage();
      }, 2000);
    }
  }, [error, imageId, image]);

  // Function to manually trigger the start of polling
  const initiatePolling = (statusUrl: string, providerName: string) => {
    useImageUploadStore
      .getState()
      .startPolling(imageId, statusUrl, providerName);
  };

  return {
    initiatePolling,
    isPollingQueryLoading: isLoading,
    pollingData: data,
    pollingQueryError: error,
    image, // Return the current image state
  };
};
