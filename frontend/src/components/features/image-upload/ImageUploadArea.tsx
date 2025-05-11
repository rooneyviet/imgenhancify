"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone-esm";
import { useImageUploadStore } from "@/lib/store/imageUploadStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { SelectedImageCompare } from "./ImageCompareResult";
import { ImageProcessor } from "./ImageProcessor";
import { ImageThumbnail } from "./ImageThumbnail";
import { ImagePollingManager } from "./ImagePollingManager";
import { acceptedFileTypes, MAX_IMAGES } from "./constants";

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: true,
    maxFiles: MAX_IMAGES,
  });

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

  // Start a new session by resetting the state
  const handleStartNewSession = () => {
    store.resetState();
    toast.info("Ready for new images");
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
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-md cursor-pointer mb-4
            ${isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/70"}
            ${store.error ? "border-destructive" : ""}
            transition-colors duration-200 ease-in-out`}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p className="text-primary">Drop the images here...</p>
            ) : (
              <div className="text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-12 h-12 mx-auto mb-4 text-gray-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338 0 4.5 4.5 0 0 1-1.41 8.775H6.75Z"
                  />
                </svg>
                <p className="mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-primary">
                    Click to upload
                  </span>{" "}
                  or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  Multiple images (up to {MAX_IMAGES}) - JPEG, PNG, WEBP, GIF
                </p>
              </div>
            )}
          </div>
        )}

        {/* Global Error Display */}
        {store.error && (
          <p className="mb-4 text-sm text-destructive text-center">
            {store.error}
          </p>
        )}

        {/* Image Thumbnails Grid */}
        {store.images.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">
                Images ({store.images.length})
                {store.isProcessing && " - Processing..."}
              </h3>
              {/* Only show Remove All button if not all images processed */}
              {!allImagesProcessed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveAll}
                  className="text-xs"
                >
                  <X className="w-3 h-3 mr-1" /> Remove All
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {store.images.map((image) => (
                <ImageThumbnail
                  key={image.id}
                  image={image}
                  isSelected={image.id === store.selectedImageId}
                  onClick={() => store.selectImage(image.id)}
                  onRemove={() => store.removeImage(image.id)}
                  isProcessing={store.isProcessing}
                />
              ))}
            </div>
          </div>
        )}

        {/* Selected Image Comparison */}
        <SelectedImageCompare />
      </CardContent>

      <CardFooter className="flex flex-col items-center gap-4 pt-4">
        {!store.isProcessing && (
          <>
            {/* Show "Start New Session" button if all images are processed */}
            {allImagesProcessed ? (
              <Button
                onClick={handleStartNewSession}
                className="w-full max-w-xs cursor-pointer"
              >
                Start New Session
              </Button>
            ) : (
              <>
                {/* Show "Select Images" button if no images are selected */}
                {store.images.length === 0 ? (
                  <Button
                    onClick={() => {
                      const inputElement =
                        document.querySelector('input[type="file"]');
                      if (inputElement instanceof HTMLElement) {
                        inputElement.click();
                      }
                    }}
                    className="w-full max-w-xs cursor-pointer"
                  >
                    Select Images to Start
                  </Button>
                ) : (
                  /* Show "Enhance Images" button if images are selected but not yet processing */
                  <Button
                    onClick={handleEnhanceImages}
                    className="w-full max-w-xs cursor-pointer"
                  >
                    Enhance {store.images.length > 1 ? "Images" : "Image"}
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {/* Show processing status when active */}
        {store.isProcessing && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing images...</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
