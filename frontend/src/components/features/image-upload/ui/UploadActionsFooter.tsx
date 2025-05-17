"use client";

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface UploadActionsFooterProps {
  isProcessing: boolean;
  allImagesProcessed: boolean;
  showDownloadButton: boolean;
  imagesCount: number;
  successfulImagesCount: number;
  onEnhanceImages: () => void;
  onDownload: () => void;
  onStartNewSession: () => void;
  onSelectImages: () => void;
}

export function UploadActionsFooter({
  isProcessing,
  allImagesProcessed,
  showDownloadButton,
  imagesCount,
  successfulImagesCount,
  onEnhanceImages,
  onDownload,
  onStartNewSession,
  onSelectImages,
}: UploadActionsFooterProps) {
  return (
    <>
      {!isProcessing && (
        <>
          {/* Show "Start New Session" button if all images are processed */}
          {allImagesProcessed ? (
            <div className="flex flex-col w-full items-center gap-3">
              {/* Show Download button if there are successful images */}
              {showDownloadButton && (
                <Button
                  onClick={onDownload}
                  variant="outline"
                  className="w-full max-w-xs cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download {successfulImagesCount > 1 ? "Images" : "Image"}
                </Button>
              )}
              <Button
                onClick={onStartNewSession}
                className="w-full max-w-xs cursor-pointer"
              >
                Start New Session
              </Button>
            </div>
          ) : (
            <>
              {/* Show "Select Images" button if no images are selected */}
              {imagesCount === 0 ? (
                <Button
                  onClick={onSelectImages}
                  className="w-full max-w-xs cursor-pointer"
                >
                  Select Images to Start
                </Button>
              ) : (
                /* Show "Enhance Images" button if images are selected but not yet processing */
                <Button
                  onClick={onEnhanceImages}
                  className="w-full max-w-xs cursor-pointer"
                >
                  Enhance {imagesCount > 1 ? "Images" : "Image"}
                </Button>
              )}
            </>
          )}
        </>
      )}

      {/* Show processing status when active */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing images...</span>
        </div>
      )}
    </>
  );
}
