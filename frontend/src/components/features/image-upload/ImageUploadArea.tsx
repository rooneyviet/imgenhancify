"use client";

import { useCallback } from "react";
// Removed ReactCompareImage import, it's now in ImageCompareResult.tsx
import { useDropzone, FileRejection, Accept } from "react-dropzone-esm";
import { useImagePolling } from "@/hooks/useImagePolling"; // Import new hook
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
import Image from "next/image";
import { Loader2 } from "lucide-react";
// No longer explicitly needed here
import { ImageCompareResult } from "./ImageCompareResult"; // Import the new component

const acceptedFileTypes: Accept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

export function ImageUploadArea() {
  const {
    selectedFile,
    previewUrl, // This is our originalImageUrl
    error,
    isUploading,
    isEnhancing,
    isPolling, // state from store, will be driven by the hook
    enhancedImageUrl,
    falRequestId,
    pollingStatusUrl,
    // pollingProviderName, // Not directly used here, hook handles it
    setSelectedFile,
    setError,
    setIsUploading,
    setIsEnhancing,
    // setIsPolling, // Managed by hook/store actions
    setEnhancedImageUrl,
    setFalRequestId,
    // setPollingInfo, // Managed by hook/store actions
    resetState,
    pollingError,
  } = useImageUploadStore();

  const { initiatePolling } = useImagePolling();

  const handleEnhanceImage = async () => {
    if (!selectedFile) {
      toast.error("Error", {
        description: "Please select an image to process.",
      });
      return;
    }

    setIsUploading(true);
    setError(null); // Clear general error
    setEnhancedImageUrl(null);
    setFalRequestId(null);
    useImageUploadStore.getState().setPollingError(null); // Reset polling error explicitly
    useImageUploadStore.getState().setIsPolling(false); // Ensure polling is stopped before starting a new one

    let uploadedImageUrl: string | null = null;

    try {
      // Step 1: Upload image
      const formData = new FormData();
      formData.append("file", selectedFile);

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
        console.error("API response does not have imageUrl:", uploadResult);
        throw new Error("Did not receive image URL from upload API.");
      }
      uploadedImageUrl = uploadResult.imageUrl;
      console.log("Uploaded image URL:", uploadedImageUrl);

      toast.success("Success", {
        description: "Original image has been uploaded.",
      });
      setIsUploading(false);
      setIsEnhancing(true);

      // Step 2: Enhance image
      try {
        if (!uploadedImageUrl) {
          throw new Error(
            "uploadedImageUrl is invalid before calling enhance."
          );
        }
        const enhanceResponse = await fetch("/api/enhance-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: uploadedImageUrl }),
        });

        if (!enhanceResponse.ok) {
          const errorData = await enhanceResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error || "Image processing failed. Please try again."
          );
        }

        const enhanceResult = await enhanceResponse.json();
        console.log("Enhance API Result:", enhanceResult);

        if (enhanceResult.enhancedUrl) {
          setEnhancedImageUrl(enhanceResult.enhancedUrl);
          toast.success("Success", {
            description: "Image processed successfully!",
          });
          setIsEnhancing(false);
        } else if (enhanceResult.status_url && enhanceResult.provider_name) {
          setFalRequestId(enhanceResult.request_id || null);
          initiatePolling(
            enhanceResult.status_url,
            enhanceResult.provider_name
          );
          setIsEnhancing(false);
          toast.info("Processing", {
            description:
              "Your image has been sent for processing. The system will automatically check the status.",
          });
        } else if (
          enhanceResult.request_id &&
          enhanceResult.status === "IN_QUEUE" &&
          enhanceResult.status_url
        ) {
          setFalRequestId(enhanceResult.request_id);
          initiatePolling(enhanceResult.status_url, "fal");
          setIsEnhancing(false);
          toast.info("Processing", {
            description:
              "Your image is being sent for processing (Fal). The system will automatically check the status.",
          });
        } else {
          toast.warning("Notification", {
            description:
              enhanceResult.error ||
              "Did not receive necessary information to track or processing result from API.",
          });
          setIsEnhancing(false);
        }
      } catch (enhanceError: any) {
        console.error("Error during image enhancement:", enhanceError);
        setError(enhanceError.message || "Error processing image.");
        toast.error("Enhance Error", {
          description: enhanceError.message || "Error processing image.",
        });
        setIsEnhancing(false); // Ensure enhancing is false on error
      }
    } catch (e: any) {
      console.error("Overall error during image processing:", e);
      setError(e.message || "An error occurred.");
      toast.error("Overall Error", {
        description: e.message || "An error occurred during processing.",
      });
      setIsUploading(false);
      setIsEnhancing(false);
      useImageUploadStore.getState().setIsPolling(false);
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      resetState(); // This should clear all relevant states including pollingError, enhancedImageUrl etc.

      if (fileRejections.length > 0) {
        const firstRejection = fileRejections[0];
        let message = "An error occurred while uploading the file.";
        if (firstRejection.errors.some((e) => e.code === "too-many-files")) {
          message = "Only a single image is allowed to be uploaded.";
        } else if (
          firstRejection.errors.some((e) => e.code === "file-invalid-type")
        ) {
          message = "Invalid file. Please select an image file.";
        }
        setError(message); // Set general error
        toast.error("Upload Error", { description: message });
        return;
      }

      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    [setSelectedFile, setError, resetState]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: false,
    maxFiles: 1,
  });

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Enhance Image Quality</CardTitle>
        <CardDescription>
          Upload your image to improve its quality using AI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Dropzone: Show if not in any processing state and no final/pending result */}
        {!isUploading &&
          !isEnhancing &&
          !isPolling &&
          !enhancedImageUrl &&
          !pollingStatusUrl && ( // Also check pollingStatusUrl to hide dropzone if a process was started
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-md cursor-pointer
              ${isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/70"}
              ${error && !previewUrl ? "border-destructive" : ""}
              transition-colors duration-200 ease-in-out`}
            >
              <input {...getInputProps()} />
              {previewUrl && selectedFile ? (
                <div className="relative w-full h-64">
                  <Image
                    src={previewUrl}
                    alt={`Preview of ${selectedFile.name}`}
                    layout="fill"
                    objectFit="contain"
                    className="rounded-md"
                  />
                </div>
              ) : isDragActive ? (
                <p className="text-primary">Drop the image here...</p>
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
                    Single image only (JPEG, PNG, WEBP, GIF)
                  </p>
                </div>
              )}
            </div>
          )}

        {/* General Error display: Show if there's a general error and not actively processing AND no polling error */}
        {error &&
          !isUploading &&
          !isEnhancing &&
          !isPolling &&
          !pollingError && ( // Ensure pollingError is also not present
            <p className="mt-4 text-sm text-destructive text-center">{error}</p>
          )}

        {/* Polling Error display: Show if there's a polling error and not actively polling */}
        {pollingError &&
          !isPolling && ( // isPolling check might be redundant if pollingError implies !isPolling
            <p className="mt-4 text-sm text-destructive text-center">
              {pollingError}
            </p>
          )}

        {/* Loading/Processing Indicators */}
        {(isUploading || isEnhancing || isPolling) && (
          <div className="flex flex-col items-center justify-center mt-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              {isUploading
                ? "Uploading image..."
                : isEnhancing
                  ? "Sending processing request..."
                  : isPolling
                    ? "Checking processing result..."
                    : "Processing..."}
            </p>
          </div>
        )}

        {/* Display ImageCompareResult if conditions are met */}
        {previewUrl &&
          enhancedImageUrl &&
          !isUploading &&
          !isEnhancing &&
          !isPolling && (
            <ImageCompareResult
              originalImageUrl={previewUrl}
              enhancedImageUrl={enhancedImageUrl}
            />
          )}

        {/* Fallback Enhanced Image Display (if only enhanced is available and not comparing) */}
        {enhancedImageUrl &&
          !previewUrl && // Only show if original is not available (so compare won't show)
          !isEnhancing &&
          !isPolling && (
            <div className="mt-6 text-center">
              <h3 className="text-lg font-semibold mb-2">Processed Image:</h3>
              <div className="relative w-full max-w-md mx-auto h-auto aspect-video border rounded-md overflow-hidden">
                <Image
                  src={enhancedImageUrl}
                  alt="Processed image"
                  layout="fill"
                  objectFit="contain"
                />
              </div>
              <Button
                onClick={() => {
                  toast.info("Notification", {
                    description: "Download function will be updated soon.",
                  });
                }}
                className="mt-4 cursor-pointer"
              >
                Download Image
              </Button>
            </div>
          )}

        {/* Pending Polling Info Display: Show if pollingStatusUrl exists, not actively polling, and no final image yet AND no polling error, AND NOT showing compare image */}
        {pollingStatusUrl &&
          !isPolling &&
          !enhancedImageUrl && // Still check this, as polling might complete but we want to show compare
          !pollingError &&
          !(previewUrl && enhancedImageUrl) && ( // Hide if compare image is shown
            <div className="mt-6 text-center p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="text-lg font-semibold text-yellow-700 mb-2">
                Request Sent
              </h3>
              <p className="text-sm text-yellow-600">
                Your image has been sent for processing. If the page is
                reloaded, you may need to do it again.
              </p>
              {falRequestId && (
                <p className="text-xs text-yellow-500 mt-1">
                  Request ID: {falRequestId}
                </p>
              )}
              <p className="text-sm text-yellow-600 mt-2">
                Status: Waiting for processing.
              </p>
              <Button
                onClick={() => {
                  useImageUploadStore.getState().setPollingError(null); // Clear previous polling error
                  useImageUploadStore.getState().setIsPolling(true); // This will re-enable the useQuery via store change
                }}
                variant="link"
                className="mt-2"
              >
                Try checking again
              </Button>
            </div>
          )}
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-4 pt-4">
        {/* Primary Action Button Area: Show if not in any active processing state */}
        {!isUploading && !isEnhancing && !isPolling && (
          <>
            {/* Enhance Button: Show if a file is selected, no results yet, and no pending polling, and no errors */}
            {/* Enhance Button: Show if a file is selected, no results yet, and no pending polling, and no errors */}
            {selectedFile &&
              !enhancedImageUrl && // Only show if no enhanced image yet (ReactCompareImage will handle display if present)
              !pollingStatusUrl &&
              !error && // No general error
              !pollingError && ( // No polling error
                <Button
                  onClick={handleEnhanceImage}
                  className="w-full max-w-xs cursor-pointer"
                >
                  Enhance Image
                </Button>
              )}

            {/* Button to start over or select a new image */}
            {/* Show this button if:
                - There's an enhanced image (meaning a comparison might be shown or was shown)
                - A polling process was initiated (even if it errored)
                - There's a general error
                - There's a polling error
                - No file is selected (initial state)
            */}
            {(previewUrl && enhancedImageUrl) || // If comparison is shown
              pollingStatusUrl || // If a process was started
              error || // If there was a general error
              pollingError || // If there was a polling error
              !selectedFile || // Initial state or after reset
              (selectedFile &&
                !enhancedImageUrl &&
                !pollingStatusUrl && ( // File selected, but not yet enhanced (allows to change mind)
                  <Button
                    onClick={() => {
                      // If in a clean state (no file, no errors, no results), and we want to select a file
                      if (
                        !selectedFile &&
                        !error &&
                        !pollingError &&
                        !enhancedImageUrl &&
                        !pollingStatusUrl
                      ) {
                        const inputElement =
                          document.querySelector('input[type="file"]');
                        if (inputElement instanceof HTMLElement) {
                          inputElement.click();
                          return; // Prevent resetState if just opening file dialog
                        }
                      }
                      resetState(); // Otherwise, reset everything to clear comparison, errors, etc.
                    }}
                    variant="outline"
                    className="w-full max-w-xs cursor-pointer"
                  >
                    {(previewUrl && enhancedImageUrl) ||
                    pollingStatusUrl ||
                    error ||
                    pollingError
                      ? "Upload Another Image"
                      : "Select Image to Start"}
                  </Button>
                ))}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
