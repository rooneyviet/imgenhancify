"use client";

import { useEffect, useRef } from "react";
import { useImageUploadStore } from "@/lib/store/imageUploadStore";
import { uploadImage } from "@/services/apiService/ImageUploadService";
import { requestEnhancement } from "@/services/apiService/ImageEnhancementService";

interface ImageProcessorProps {
  imageId: string;
}

export function ImageProcessor({ imageId }: ImageProcessorProps) {
  const store = useImageUploadStore();
  const image = store.images.find((img) => img.id === imageId);
  // Ref to track if processing has been initiated for the current "true" state of image.isUploading
  const processingRef = useRef(false);

  useEffect(() => {
    if (!image) {
      processingRef.current = false; // Reset if image is gone
      return;
    }

    // If image is uploading and we haven't started processing this "uploading" phase
    if (image.isUploading && !processingRef.current) {
      processingRef.current = true; // Mark that we are initiating processing for this phase
      console.log(
        `ImageProcessor (${imageId}): image.isUploading is true and processingRef is false. Starting processImage.`
      );

      const processImage = async () => {
        // Double check isUploading state inside async function, as it might change
        const currentImageState = useImageUploadStore
          .getState()
          .images.find((img) => img.id === imageId);
        if (!currentImageState || !currentImageState.isUploading) {
          console.log(
            `ImageProcessor (${imageId}): Aborting async processImage; isUploading is now false or image gone.`
          );
          // processingRef will be reset by the `else if (!image.isUploading)` block in the next effect run.
          return;
        }

        try {
          // Step 1: Upload image
          console.log(
            `ImageProcessor (${imageId}): Step 1: Uploading image file: ${currentImageState.file.name}`
          );

          const uploadResult = await uploadImage(currentImageState.file);

          console.log(
            `ImageProcessor (${imageId}): Step 1 complete. Uploaded to: ${uploadResult.imageUrl}. Updating store.`
          );
          // This update will set isUploading to false
          useImageUploadStore.getState().updateImage(imageId, {
            isUploading: false,
            isEnhancing: true,
            uploadedImageUrl: uploadResult.imageUrl,
          });

          // Step 2: Enhance image
          // This part will run immediately after. The isUploading flag is now false.
          // The next run of useEffect will see isUploading as false and reset processingRef.
          console.log(
            `ImageProcessor (${imageId}): Step 2: Enhancing image using URL: ${uploadResult.imageUrl}`
          );

          const enhanceResult = await requestEnhancement(uploadResult.imageUrl);

          console.log(
            `ImageProcessor (${imageId}): Step 2 complete. Result:`,
            enhanceResult
          );

          if (enhanceResult.enhancedUrl) {
            useImageUploadStore.getState().updateImage(imageId, {
              isEnhancing: false,
              enhancedImageUrl: enhanceResult.enhancedUrl,
            });
            setTimeout(
              () => useImageUploadStore.getState().processNextImage(),
              2000
            );
          } else if (enhanceResult.status_url && enhanceResult.provider_name) {
            useImageUploadStore.getState().updateImage(imageId, {
              isEnhancing: false,
            });
            useImageUploadStore
              .getState()
              .startPolling(
                imageId,
                enhanceResult.status_url,
                enhanceResult.provider_name
              );
          } else {
            // This case might be hit if enhanceResult is an error object from the API route
            // or if the structure is unexpected.
            throw new Error(
              enhanceResult.error ||
                "Unexpected enhancement API response structure."
            );
          }
        } catch (error: any) {
          console.error(
            `ImageProcessor (${imageId}): Error processing image:`,
            error
          );
          useImageUploadStore.getState().updateImage(imageId, {
            isUploading: false,
            isEnhancing: false,
            isPolling: false,
            error: error.message || "An error occurred during processing.",
          });
          // Ensure processingRef is reset if an error occurs mid-way.
          // The store update above sets isUploading: false, so the next effect run should reset it.
          setTimeout(
            () => useImageUploadStore.getState().processNextImage(),
            2000
          );
        }
      };
      processImage();
    } else if (image.isUploading && processingRef.current) {
      console.log(
        `ImageProcessor (${imageId}): image.isUploading is true, but processingRef is also true. Skipping duplicate call.`
      );
    } else if (!image.isUploading) {
      // If image is no longer uploading, reset the ref for the next time it might become true
      if (processingRef.current) {
        console.log(
          `ImageProcessor (${imageId}): image.isUploading is false. Resetting processingRef.`
        );
        processingRef.current = false;
      }
    }
  }, [imageId, image]); // Depend on the image object. When its properties (like isUploading) change, effect re-runs.

  return null; // This is a logic-only component
}
