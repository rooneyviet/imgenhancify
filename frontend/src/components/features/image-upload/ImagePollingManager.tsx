"use client";

import { useEffect, useState } from "react";
import { useImageUploadStore } from "@/lib/store/imageUploadStore";
import { useImagePolling } from "@/hooks/useImagePolling";

// Single image polling component
// This component is responsible for polling a single image
// By creating a separate component for each image, we ensure that
// hooks are called consistently for each component instance
function SingleImagePoller({ imageId }: { imageId: string }) {
  // Each component instance has its own stable hook calls
  useImagePolling({ imageId });

  // This component doesn't render anything visible
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

  // Render a separate component for each image that needs polling
  // This follows React's pattern for rendering dynamic lists
  return (
    <>
      {pollingImages.map((imageId) => (
        <SingleImagePoller key={imageId} imageId={imageId} />
      ))}
    </>
  );
}
