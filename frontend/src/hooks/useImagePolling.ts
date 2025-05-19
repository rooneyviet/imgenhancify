import { useQuery, Query } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useImageUploadStore, ImageItem } from "@/lib/store/imageUploadStore";
import {
  fetchPollingStatus,
  cancelJob,
  PollImageStatusPayload,
  PollImageStatusResponse,
} from "@/services/apiService/PollingService";

const POLLING_INTERVAL = 3000;
const MAX_POLLING_ATTEMPTS = 50;

interface UseImagePollingProps {
  imageId: string;
}

export interface UseImagePollingReturn {
  initiatePolling: (statusUrl: string, providerName: string) => void;
  isPollingQueryLoading: boolean;
  pollingData: PollImageStatusResponse | undefined;
  pollingQueryError: Error | null;
  image: ImageItem | undefined;
}

export const useImagePolling = ({
  imageId,
}: UseImagePollingProps): UseImagePollingReturn => {
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
    return fetchPollingStatus({
      statusUrl: image.pollingStatusUrl,
      providerName: image.pollingProviderName,
      apiKeyName:
        image.pollingProviderName === "fal" ? "FAL_AI_KEY" : undefined,
    });
  };

  // Helper function to handle Runpod queue timeout
  const handleRunpodQueueTimeout = async () => {
    if (!image || !image.pollingStatusUrl) return;

    const storeActions = useImageUploadStore.getState();
    console.warn(
      `[useImagePolling] Runpod job ${imageId} in queue for >60s. Attempting cancellation.`
    );

    if (!image.pollingStatusUrl) {
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

    const cancelResult = await cancelJob(
      image.pollingStatusUrl,
      image.pollingProviderName || "runpod"
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
      const currentAttempt = query.state.dataUpdateCount + 1;

      console.log(
        `[useImagePolling] Image ID: ${imageId}, Polling attempt: ${currentAttempt} of ${MAX_POLLING_ATTEMPTS}. Current status: ${currentData?.status || "fetching..."}`
      );

      // Stop polling if image is not available
      if (!image) {
        console.warn(
          `[useImagePolling] Image with ID ${imageId} not found in hook state during refetchInterval. Stopping polling.`
        );
        return false;
      }

      // Stop polling if we have an image URL or there was an error
      if (currentData?.imageUrl || query.state.status === "error") {
        return false;
      }

      // Stop polling if status is COMPLETED or ERROR
      if (
        currentData?.status === "COMPLETED" ||
        currentData?.status === "ERROR"
      ) {
        return false;
      }

      // Stop polling if we've reached the maximum number of attempts
      if (currentAttempt >= MAX_POLLING_ATTEMPTS) {
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

      // Continue polling with the specified interval
      return POLLING_INTERVAL;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    retry: (failureCount: number) => failureCount < 2,
  });

  // Helper function to process successful polling results
  const handlePollingSuccess = (data: PollImageStatusResponse) => {
    if (!image) return;

    const storeActions = useImageUploadStore.getState();

    // Case 1: Image URL is available - processing completed successfully
    if (data.imageUrl) {
      storeActions.updateImage(imageId, {
        enhancedImageUrl: data.imageUrl,
        isPolling: false,
      });
      setTimeout(() => storeActions.processNextImage(), 2000);
      return;
    }

    // Case 2: Status is COMPLETED but no image URL - something went wrong
    if (data.status === "COMPLETED" && !data.imageUrl) {
      storeActions.updateImage(imageId, {
        isPolling: false,
        pollingError:
          data.message || "Processing completed but no image URL was returned.",
      });
      setTimeout(() => storeActions.processNextImage(), 2000);
      return;
    }

    // Case 3: Status is ERROR - processing failed
    if (data.status === "ERROR") {
      storeActions.updateImage(imageId, {
        isPolling: false,
        pollingError:
          data.error?.message ||
          data.message ||
          `Image processing failed with status: ${data.status}`,
      });
      setTimeout(() => storeActions.processNextImage(), 2000);
      return;
    }

    // Case 4: Unexpected status
    if (
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
  };

  // Helper function to handle polling errors
  const handlePollingError = (error: Error) => {
    if (!image) return;

    const storeActions = useImageUploadStore.getState();
    storeActions.updateImage(imageId, {
      isPolling: false,
      pollingError:
        error.message || "An unknown error occurred during polling.",
      inQueueSince: null,
    });

    setTimeout(() => storeActions.processNextImage(), 2000);
  };

  // React to data changes
  useEffect(() => {
    if (data && image) {
      handlePollingSuccess(data);
    }
  }, [data, imageId, image]);

  // React to error changes
  useEffect(() => {
    if (error && image) {
      handlePollingError(error);
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
