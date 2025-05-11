"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect } from "react";

// Dynamically import ReactCompareImage to ensure it's client-side only
const DynamicReactCompareImage = dynamic(() => import("react-compare-image"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-64 text-muted-foreground">
      Loading comparator...
    </div>
  ),
});

interface ImageCompareResultProps {
  originalImageUrl: string | null;
  enhancedImageUrl: string | null;
}

export function ImageCompareResult({
  originalImageUrl,
  enhancedImageUrl,
}: ImageCompareResultProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && typeof TouchEvent === "undefined") {
      // @ts-ignore
      window.TouchEvent = class TouchEvent extends UIEvent {
        constructor(type: string, eventInitDict?: TouchEventInit) {
          super(type, eventInitDict);
        }
      };
    }
  }, []);

  if (!originalImageUrl || !enhancedImageUrl) {
    return null; // Don't render if either image is missing
  }

  // Ensure this component only renders on the client-side
  if (typeof window === "undefined") {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2 text-center">Compare Images</h3>
      <div className="relative w-full max-w-2xl mx-auto border rounded-md">
        <DynamicReactCompareImage
          leftImage={originalImageUrl}
          rightImage={enhancedImageUrl}
          leftImageLabel="Original Image"
          rightImageLabel="Processed Image"
          sliderLineWidth={2}
          handleSize={40}
        />
      </div>
      <div className="text-center mt-4">
        <Button
          onClick={() => {
            toast.info("Notification", {
              description:
                "The download function for processed images will be updated soon.",
            });
          }}
          className="cursor-pointer"
        >
          Download Processed Image
        </Button>
      </div>
    </div>
  );
}
