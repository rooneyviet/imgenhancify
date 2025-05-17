"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ImageThumbnail } from "../ImageThumbnail";
import { useImageUploadStore } from "@/lib/store/imageUploadStore";

// Use the store's type for ImageData
type ImageData = ReturnType<typeof useImageUploadStore.getState>["images"][0];

interface ImageThumbnailsGridProps {
  images: ImageData[];
  selectedImageId: string | null;
  isProcessing: boolean;
  allImagesProcessed: boolean;
  onSelectImage: (id: string) => void;
  onRemoveImage: (id: string) => void;
  onRemoveAll: () => void;
}

export function ImageThumbnailsGrid({
  images,
  selectedImageId,
  isProcessing,
  allImagesProcessed,
  onSelectImage,
  onRemoveImage,
  onRemoveAll,
}: ImageThumbnailsGridProps) {
  if (images.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">
          Images ({images.length}){isProcessing && " - Processing..."}
        </h3>
        {/* Only show Remove All button if not all images processed */}
        {!allImagesProcessed && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRemoveAll}
            className="text-xs"
          >
            <X className="w-3 h-3 mr-1" /> Remove All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {images.map((image) => (
          <ImageThumbnail
            key={image.id}
            image={image}
            isSelected={image.id === selectedImageId}
            onClick={() => onSelectImage(image.id)}
            onRemove={() => onRemoveImage(image.id)}
            isProcessing={isProcessing}
          />
        ))}
      </div>
    </div>
  );
}
