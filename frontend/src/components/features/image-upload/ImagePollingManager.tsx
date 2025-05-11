"use client";

import { useEffect, useState } from "react";
import { useImageUploadStore } from "@/lib/store/imageUploadStore";
import { useImagePolling } from "@/hooks/useImagePolling";

interface PollingHandlerProps {
  imageId: string;
}

// Individual polling handler component
function PollingHandler({ imageId }: PollingHandlerProps) {
  const { initiatePolling } = useImagePolling({ imageId });

  // This component doesn't render anything, it just sets up the polling
  return null;
}

export function ImagePollingManager() {
  const store = useImageUploadStore();
  const [pollingImages, setPollingImages] = useState<string[]>([]);

  // Find all images that need polling
  useEffect(() => {
    const imagesToPoll = store.images
      .filter(
        (img) =>
          img.isPolling && img.pollingStatusUrl && img.pollingProviderName
      )
      .map((img) => img.id);

    setPollingImages(imagesToPoll);
  }, [store.images]);

  return (
    <>
      {pollingImages.map((imageId) => (
        <PollingHandler key={imageId} imageId={imageId} />
      ))}
    </>
  );
}
