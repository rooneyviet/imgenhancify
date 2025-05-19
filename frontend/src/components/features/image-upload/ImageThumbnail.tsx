"use client";

import Image from "next/image";
import { Loader2, X, Check, AlertCircle } from "lucide-react";
import { ImageItem } from "@/lib/store/imageUploadStore";

interface ImageThumbnailProps {
  image: ImageItem;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
  isProcessing: boolean;
}

export function ImageThumbnail({
  image,
  isSelected,
  onClick,
  onRemove,
  isProcessing,
}: ImageThumbnailProps) {
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
    !image.error &&
    !image.pollingError &&
    !image.isEnhancing &&
    !image.isPolling &&
    !image.enhancedImageUrl;

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
          className="absolute top-1 right-1 bg-red-300 rounded-full p-1 z-10 hover:bg-red-800 transition-colors"
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
