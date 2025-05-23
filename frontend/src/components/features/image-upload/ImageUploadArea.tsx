"use client";

import { useCallback, useMemo } from "react";
import { useImageUploadStore } from "@/lib/store/imageUploadStore"; // Already imported
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
import { MAX_IMAGES } from "./constants";
import { DropzoneUI, ImageThumbnailsGrid, UploadActionsFooter } from "./ui";
import { useImageDownloader } from "@/hooks/useImageDownloader";

export function ImageUploadArea() {
  const images = useImageUploadStore((state) => state.images);
  const processingQueue = useImageUploadStore((state) => state.processingQueue);
  const isProcessing = useImageUploadStore((state) => state.isProcessing);
  const error = useImageUploadStore((state) => state.error);
  const selectedImageId = useImageUploadStore((state) => state.selectedImageId);
  const isDownloadingFiles = useImageUploadStore(
    (state) => state.isDownloading
  ); // Get from store

  const addImages = useImageUploadStore((state) => state.addImages);
  const removeImage = useImageUploadStore((state) => state.removeImage);
  const selectImage = useImageUploadStore((state) => state.selectImage);
  const resetState = useImageUploadStore((state) => state.resetState);
  const setError = useImageUploadStore((state) => state.setError);
  const processNextImage = useImageUploadStore(
    (state) => state.processNextImage
  );
  const setState = useImageUploadStore.setState;

  const activeProcessors = useMemo(() => {
    return images
      .filter((img) => img.isUploading || img.isEnhancing)
      .map((img) => img.id);
  }, [images]);

  const handleEnhanceImages = useCallback(() => {
    if (images.length === 0) {
      toast.error("Error", {
        description: "Please select at least one image to process.",
      });
      return;
    }

    if (processingQueue.length > 0) {
      setState({
        isProcessingQueue: true,
        isProcessing: true,
      });
      processNextImage();
      toast.success("Processing Started", {
        description: `Starting to process ${images.length} ${images.length === 1 ? "image" : "images"}.`,
      });
    }
  }, [images, processingQueue, setState, processNextImage]);

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

        setError(message);
        toast.error("Upload Error", { description: message });
        return;
      }

      if (acceptedFiles.length > 0) {
        const currentCount = images.length;
        const newCount = currentCount + acceptedFiles.length;

        if (newCount > MAX_IMAGES) {
          const canAdd = MAX_IMAGES - currentCount;
          if (canAdd <= 0) {
            toast.error("Limit Reached", {
              description: `You can only upload a maximum of ${MAX_IMAGES} images.`,
            });
            return;
          }
          const limitedFiles = acceptedFiles.slice(0, canAdd);
          addImages(limitedFiles);
          toast.warning("Limit Reached", {
            description: `Added ${canAdd} images. You've reached the maximum of ${MAX_IMAGES} images.`,
          });
        } else {
          addImages(acceptedFiles);
          const fileCount = acceptedFiles.length;
          toast.success("Images Added", {
            description: `${fileCount} ${fileCount === 1 ? "image" : "images"} added.`,
          });
        }
      }
    },
    [images, addImages, setError]
  );

  const handleRemoveAll = useCallback(() => {
    resetState();
    toast.info("All images removed");
  }, [resetState]);

  const allImagesProcessed = useMemo(
    () =>
      images.length > 0 &&
      images.every(
        (img) => img.enhancedImageUrl || img.error || img.pollingError
      ),
    [images]
  );

  const successfulImages = useMemo(
    () =>
      images.filter(
        (img) => img.enhancedImageUrl && !img.error && !img.pollingError
      ),
    [images]
  );

  const showDownloadButton = useMemo(
    () => allImagesProcessed && successfulImages.length > 0,
    [allImagesProcessed, successfulImages]
  );

  const handleStartNewSession = useCallback(() => {
    resetState();
    toast.info("Ready for new images");
  }, [resetState]);

  const {
    // isDownloading is no longer returned by the hook
    downloadSingleImage,
    downloadMultipleImagesAsZip,
  } = useImageDownloader();

  const handleDownload = useCallback(async () => {
    if (successfulImages.length === 0) return;

    if (successfulImages.length === 1) {
      const image = successfulImages[0];
      if (image.enhancedImageUrl) {
        const fileName =
          image.file.name.replace(/\.[^/.]+$/, "") + "-enhanced.jpg";
        await downloadSingleImage(image.enhancedImageUrl, fileName);
      }
    } else {
      const imagesToDownload = successfulImages
        .filter((img) => img.enhancedImageUrl)
        .map((img) => ({
          url: img.enhancedImageUrl as string,
          name: img.file.name.replace(/\.[^/.]+$/, "") + "-enhanced.jpg",
        }));
      await downloadMultipleImagesAsZip(imagesToDownload);
    }
  }, [successfulImages, downloadSingleImage, downloadMultipleImagesAsZip]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Enhance Image Quality</CardTitle>
        <CardDescription>
          Upload up to {MAX_IMAGES} images to enhance their quality!
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
        {!isProcessing && !allImagesProcessed && (
          <DropzoneUI onDrop={onDrop} error={error} />
        )}

        {/* Image Thumbnails Grid */}
        <ImageThumbnailsGrid
          images={images}
          selectedImageId={selectedImageId}
          isProcessing={isProcessing}
          allImagesProcessed={allImagesProcessed}
          onSelectImage={selectImage}
          onRemoveImage={removeImage}
          onRemoveAll={handleRemoveAll}
        />

        {/* Selected Image Comparison */}
        <SelectedImageCompare />
      </CardContent>

      <CardFooter className="flex flex-col items-center gap-4 pt-4">
        <UploadActionsFooter
          isProcessing={isProcessing}
          allImagesProcessed={allImagesProcessed}
          showDownloadButton={showDownloadButton}
          isDownloading={isDownloadingFiles}
          imagesCount={images.length}
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
