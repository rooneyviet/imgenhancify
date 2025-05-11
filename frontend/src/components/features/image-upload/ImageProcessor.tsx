"use client";

import { useEffect } from "react";
import { useImageUploadStore } from "@/lib/store/imageUploadStore";

interface ImageProcessorProps {
  imageId: string;
}

export function ImageProcessor({ imageId }: ImageProcessorProps) {
  const store = useImageUploadStore();
  const image = store.images.find((img) => img.id === imageId);

  useEffect(() => {
    if (!image) return;

    const processImage = async () => {
      if (!image.isUploading) return;

      try {
        // Step 1: Upload image
        const formData = new FormData();
        formData.append("file", image.file);

        const uploadResponse = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error || "Original image upload failed. Please try again."
          );
        }

        const uploadResult = await uploadResponse.json();
        if (!uploadResult.imageUrl) {
          throw new Error("Did not receive image URL from upload API.");
        }

        // Update image with uploaded URL and start enhancement
        store.updateImage(imageId, {
          isUploading: false,
          isEnhancing: true,
          uploadedImageUrl: uploadResult.imageUrl,
        });

        // Step 2: Enhance image
        const enhanceResponse = await fetch("/api/enhance-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: uploadResult.imageUrl }),
        });

        if (!enhanceResponse.ok) {
          const errorData = await enhanceResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error || "Image processing failed. Please try again."
          );
        }

        const enhanceResult = await enhanceResponse.json();

        // Handle different enhancement results
        if (enhanceResult.enhancedUrl) {
          // Direct result
          store.updateImage(imageId, {
            isEnhancing: false,
            enhancedImageUrl: enhanceResult.enhancedUrl,
          });

          // Process next image after delay
          setTimeout(() => {
            store.processNextImage();
          }, 2000);
        } else if (enhanceResult.status_url && enhanceResult.provider_name) {
          // Need to poll for result
          store.updateImage(imageId, {
            isEnhancing: false,
            falRequestId: enhanceResult.request_id || null,
          });
          store.startPolling(
            imageId,
            enhanceResult.status_url,
            enhanceResult.provider_name
          );
        } else if (
          enhanceResult.request_id &&
          enhanceResult.status === "IN_QUEUE" &&
          enhanceResult.status_url
        ) {
          // Fal.ai specific queue
          store.updateImage(imageId, {
            isEnhancing: false,
            falRequestId: enhanceResult.request_id,
          });
          store.startPolling(imageId, enhanceResult.status_url, "fal");
        } else {
          // Unexpected result
          store.updateImage(imageId, {
            isEnhancing: false,
            error:
              enhanceResult.error ||
              "Did not receive necessary information from API.",
          });

          // Process next image after delay
          setTimeout(() => {
            store.processNextImage();
          }, 2000);
        }
      } catch (error: any) {
        console.error("Error processing image:", error);
        store.updateImage(imageId, {
          isUploading: false,
          isEnhancing: false,
          isPolling: false,
          error: error.message || "An error occurred during processing.",
        });

        // Process next image after delay
        setTimeout(() => {
          store.processNextImage();
        }, 2000);
      }
    };

    if (image.isUploading) {
      processImage();
    }
  }, [imageId, image, store]);

  return null; // This is a logic-only component
}
