"use client";

import { useCallback, useState, useEffect } from "react";
import { useImageUploadStore } from "@/lib/store/imageUploadStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { SelectedImageCompare } from "./ImageCompareResult";
import { ImageProcessor } from "./ImageProcessor";
import { ImagePollingManager } from "./ImagePollingManager";
import { acceptedFileTypes, MAX_IMAGES } from "./constants";
import { DropzoneUI, ImageThumbnailsGrid, UploadActionsFooter } from "./ui";
import { useImageDownloader } from "@/hooks/useImageDownloader";

export function ImageUploadArea() {
  const store = useImageUploadStore();
  const [activeProcessors, setActiveProcessors] = useState<string[]>([]);

  // Update active processors when images change
  useEffect(() => {
    const newProcessors = store.images
      .filter((img) => img.isUploading || img.isEnhancing)
      .map((img) => img.id);

    setActiveProcessors(newProcessors);
  }, [store.images]);

  // Handle enhancing all images
  const handleEnhanceImages = () => {
    if (store.images.length === 0) {
      toast.error("Error", {
        description: "Please select at least one image to process.",
      });
      return;
    }

    // Start processing the first image
    if (store.processingQueue.length > 0) {
      // Set isProcessingQueue to true before starting processing
      useImageUploadStore.setState({
        isProcessingQueue: true,
        isProcessing: true,
      });

      // Start processing the first image
      store.processNextImage();

      toast.success("Processing Started", {
        description: `Starting to process ${store.images.length} ${store.images.length === 1 ? "image" : "images"}.`,
      });
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      if (fileRejections.length > 0) {
        const firstRejection = fileRejections[0];
        let message = "An error occurred while uploading the file.";

        if (
          firstRejection.errors.some((e: any) => e.code === "file-invalid-type")
        ) {
          message = "Invalid file. Please select an image file.";
        }

        store.setError(message);
        toast.error("Upload Error", { description: message });
        return;
      }

      if (acceptedFiles.length > 0) {
        // Check if adding these would exceed the limit
        const currentCount = store.images.length;
        const newCount = currentCount + acceptedFiles.length;

        if (newCount > MAX_IMAGES) {
          const canAdd = MAX_IMAGES - currentCount;
          if (canAdd <= 0) {
            toast.error("Limit Reached", {
              description: `You can only upload a maximum of ${MAX_IMAGES} images.`,
            });
            return;
          }

          // Only add up to the limit
          const limitedFiles = acceptedFiles.slice(0, canAdd);
          store.addImages(limitedFiles);

          toast.warning("Limit Reached", {
            description: `Added ${canAdd} images. You've reached the maximum of ${MAX_IMAGES} images.`,
          });
        } else {
          // Add all the new images to the store
          store.addImages(acceptedFiles);

          const fileCount = acceptedFiles.length;
          toast.success("Images Added", {
            description: `${fileCount} ${fileCount === 1 ? "image" : "images"} added.`,
          });
        }
      }
    },
    [store]
  );

  // We no longer need the useDropzone hook here as it's moved to DropzoneUI component

  const handleRemoveAll = () => {
    store.resetState();
    toast.info("All images removed");
  };

  // Check if all images have been processed
  const allImagesProcessed =
    store.images.length > 0 &&
    store.images.every(
      (img) => img.enhancedImageUrl || img.error || img.pollingError
    );

  // Get successful images (those with enhancedImageUrl and no errors)
  const successfulImages = store.images.filter(
    (img) => img.enhancedImageUrl && !img.error && !img.pollingError
  );

  // Determine if we should show the download button
  const showDownloadButton = allImagesProcessed && successfulImages.length > 0;

  // Start a new session by resetting the state
  const handleStartNewSession = () => {
    store.resetState();
    toast.info("Ready for new images");
  };

  // Handle the download button click
  const handleDownload = async () => {
    if (successfulImages.length === 0) return;

    const { downloadSingleImage, downloadMultipleImagesAsZip } =
      useImageDownloader();

    if (successfulImages.length === 1) {
      // Download single image
      const image = successfulImages[0];
      if (image.enhancedImageUrl) {
        const fileName =
          image.file.name.replace(/\.[^/.]+$/, "") + "-enhanced.jpg";
        await downloadSingleImage(image.enhancedImageUrl, fileName);
      }
    } else {
      // Download multiple images as zip
      const imagesToDownload = successfulImages
        .filter((img) => img.enhancedImageUrl)
        .map((img) => ({
          url: img.enhancedImageUrl as string,
          name: img.file.name.replace(/\.[^/.]+$/, "") + "-enhanced.jpg",
        }));

      await downloadMultipleImagesAsZip(imagesToDownload);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Enhance Image Quality</CardTitle>
        <CardDescription>
          Upload up to {MAX_IMAGES} images to improve their quality using AI.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Render invisible image processors for each active image */}
        {activeProcessors.map((id) => (
          <ImageProcessor key={id} imageId={id} />
        ))}

        {/* Polling manager for all images that need polling */}
        <ImagePollingManager />

        {/* Dropzone - Only show if not processing and not all images processed */}
        {!store.isProcessing && !allImagesProcessed && (
          <DropzoneUI onDrop={onDrop} error={store.error} />
        )}

        {/* Image Thumbnails Grid */}
        <ImageThumbnailsGrid
          images={store.images}
          selectedImageId={store.selectedImageId}
          isProcessing={store.isProcessing}
          allImagesProcessed={allImagesProcessed}
          onSelectImage={(id) => store.selectImage(id)}
          onRemoveImage={(id) => store.removeImage(id)}
          onRemoveAll={handleRemoveAll}
        />

        {/* Selected Image Comparison */}
        <SelectedImageCompare />
      </CardContent>

      <CardFooter className="flex flex-col items-center gap-4 pt-4">
        <UploadActionsFooter
          isProcessing={store.isProcessing}
          allImagesProcessed={allImagesProcessed}
          showDownloadButton={showDownloadButton}
          imagesCount={store.images.length}
          successfulImagesCount={successfulImages.length}
          onEnhanceImages={handleEnhanceImages}
          onDownload={handleDownload}
          onStartNewSession={handleStartNewSession}
          onSelectImages={() => {
            const inputElement = document.querySelector('input[type="file"]');
            if (inputElement instanceof HTMLElement) {
              inputElement.click();
            }
          }}
        />
      </CardFooter>
    </Card>
  );
}
