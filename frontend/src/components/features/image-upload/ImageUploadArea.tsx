"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone, FileRejection, Accept } from "react-dropzone-esm";
import { useImageUploadStore, ImageItem } from "@/lib/store/imageUploadStore";
import { useImagePolling } from "@/hooks/useImagePolling";
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
import Image from "next/image";
import { Loader2, X, Check, AlertCircle } from "lucide-react";
import { ImageCompareResult, SelectedImageCompare } from "./ImageCompareResult";

const acceptedFileTypes: Accept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

// Component to handle individual image processing
function ImageProcessor({ imageId }: { imageId: string }) {
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

// Thumbnail component for an individual image
function ImageThumbnail({
  image,
  isSelected,
  onClick,
  onRemove,
  isProcessing,
}: {
  image: ImageItem;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
  isProcessing: boolean;
}) {
  const getStatusIndicator = () => {
    if (image.isUploading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
          <span className="text-xs text-white ml-2">Uploading</span>
        </div>
      );
    }

    if (image.isPolling || image.isEnhancing) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
          <span className="text-xs text-white ml-2">Processing</span>
        </div>
      );
    }

    if (image.error || image.pollingError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
      );
    }

    if (image.enhancedImageUrl) {
      return (
        <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
          <Check className="w-4 h-4 text-white" />
        </div>
      );
    }

    return null;
  };

  // Determine if this image is selectable (only processed images are selectable)
  const isSelectable = image.enhancedImageUrl !== null;

  // Show remove button only if not processing and not yet enhanced
  const showRemoveButton =
    !isProcessing &&
    !image.isUploading &&
    !image.isEnhancing &&
    !image.isPolling &&
    !image.enhancedImageUrl; // Hide remove button after image is processed

  return (
    <div
      className={`relative w-24 h-24 border rounded-md overflow-hidden transition-all
        ${isSelectable && isSelected ? "ring-2 ring-primary" : ""}
        ${image.enhancedImageUrl ? "border-green-500 cursor-pointer" : "border-gray-200"}
        ${image.error || image.pollingError ? "border-red-500" : ""}
      `}
      onClick={isSelectable ? onClick : undefined}
      title={image.file.name}
    >
      {image.previewUrl && (
        <Image
          src={image.previewUrl}
          alt={image.file.name}
          layout="fill"
          objectFit="cover"
          className="rounded-md"
        />
      )}
      {getStatusIndicator()}

      {/* Remove button */}
      {showRemoveButton && (
        <button
          className="absolute top-1 right-1 bg-red-500 rounded-full p-1 z-10 hover:bg-red-600 transition-colors"
          onClick={(e) => {
            e.stopPropagation(); // Prevent triggering the parent onClick
            onRemove();
          }}
          title="Remove image"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      )}
    </div>
  );
}

// Component to handle polling for multiple images
function ImagePollingManager() {
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

// Individual polling handler component
function PollingHandler({ imageId }: { imageId: string }) {
  const { initiatePolling } = useImagePolling({ imageId });

  // This component doesn't render anything, it just sets up the polling
  return null;
}

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
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        const firstRejection = fileRejections[0];
        let message = "An error occurred while uploading the file.";

        if (firstRejection.errors.some((e) => e.code === "file-invalid-type")) {
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
        const MAX_IMAGES = 20;

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
    maxFiles: 20,
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
          Upload up to 20 images to improve their quality using AI.
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
                  Multiple images (up to 20) - JPEG, PNG, WEBP, GIF
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
