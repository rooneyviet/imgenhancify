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

async function cancelRunpodJobOnClient(
  statusUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/cancel-runpod-job", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ statusUrl }),
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed with status: ${response.status}`,
      };
    }
    return { success: true };
  } catch (e) {
    console.error("Error calling /api/cancel-runpod-job:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unknown cancellation error",
    };
  }
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
      // Use the 'image' state variable from the hook, which is synced with the store

      if (!image) {
        // Check if the image object itself is available in the hook's state
        console.warn(
          `[useImagePolling] Image with ID ${imageId} not found in hook state during refetchInterval. Stopping polling.`
        );
        return false;
      }

      if (currentData?.imageUrl) {
        return false;
      }
      if (query.state.status === "error") {
        return false;
      }

      if (
        currentData?.status === "COMPLETED" ||
        currentData?.status === "ERROR"
      ) {
        return false;
      }

      // Runpod IN_QUEUE timeout logic
      if (
        currentData?.status === "IN_QUEUE" &&
        image.pollingProviderName?.toLowerCase() === "runpod"
      ) {
        if (image.inQueueSince === null) {
          storeActions.updateImage(imageId, { inQueueSince: Date.now() });
        } else {
          const timeSpentInQueue = Date.now() - image.inQueueSince;
          if (timeSpentInQueue > 60000) {
            // 60 seconds
            console.warn(
              `[useImagePolling] Runpod job ${imageId} in queue for >60s. Attempting cancellation.`
            );
            Promise.resolve().then(async () => {
              if (!image.pollingStatusUrl) {
                // Guard against missing URL
                console.error(
                  "[useImagePolling] Cannot cancel job: pollingStatusUrl is missing for imageId:",
                  imageId
                );
                storeActions.updateImage(imageId, {
                  isPolling: false,
                  pollingError: "Cannot cancel job: status URL missing.",
                  inQueueSince: null,
                });
                setTimeout(() => storeActions.processNextImage(), 2000);
                return;
              }
              const cancelResult = await cancelRunpodJobOnClient(
                image.pollingStatusUrl
              );
              if (cancelResult.success) {
                storeActions.updateImage(imageId, {
                  isPolling: false,
                  pollingError: "Job cancelled: Exceeded 60 seconds in queue.",
                  inQueueSince: null,
                });
              } else {
                storeActions.updateImage(imageId, {
                  isPolling: false,
                  pollingError: `Queue timeout (>60s). Cancellation failed: ${cancelResult.error || "Unknown reason"}`,
                  inQueueSince: null,
                });
              }
              setTimeout(() => storeActions.processNextImage(), 2000);
            });
            return false; // Stop polling
          }
        }
      } else if (
        image.inQueueSince !== null &&
        currentData?.status !== "IN_QUEUE"
      ) {
        // If status is no longer IN_QUEUE (and it was previously), reset the timer
        storeActions.updateImage(imageId, { inQueueSince: null });
      }

      if (query.state.dataUpdateCount + 1 >= MAX_POLLING_ATTEMPTS) {
        if (!currentData?.imageUrl) {
          Promise.resolve().then(() => {
            storeActions.updateImage(imageId, {
              isPolling: false,
              pollingError: `Polling timed out after ${MAX_POLLING_ATTEMPTS} attempts. Last status: ${currentData?.status || "unknown"}.`,
              inQueueSince: null,
            });
            setTimeout(() => storeActions.processNextImage(), 2000);
          });
        }
        return false;
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
        data.status !== "IN_QUEUE" &&
        data.status !== "COMPLETED"
      ) {
        storeActions.updateImage(imageId, {
          isPolling: false,
          pollingError:
            data.error?.message ||
            data.message ||
            `Image processing ended with unexpected status: ${data.status}`,
          inQueueSince: null,
        });
        setTimeout(() => storeActions.processNextImage(), 2000);
      }
    }
  }, [data, imageId, image]); // 'image' is included as a dependency for its properties used in this effect

  useEffect(() => {
    const storeActions = useImageUploadStore.getState();
    if (error && image) {
      // Check if image exists in hook state before trying to update
      storeActions.updateImage(imageId, {
        isPolling: false,
        pollingError:
          error.message || "An unknown error occurred during polling.",
        inQueueSince: null,
      });
      setTimeout(() => storeActions.processNextImage(), 2000);
    }
  }, [error, imageId, image]); // 'image' is included as a dependency

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
