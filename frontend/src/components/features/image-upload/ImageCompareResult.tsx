"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Dynamically import ReactCompareImage to ensure it's client-side only
const DynamicReactCompareImage = dynamic(() => import("react-compare-image"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-64 text-muted-foreground">
      Đang tải trình so sánh...
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
  if (!originalImageUrl || !enhancedImageUrl) {
    return null; // Don't render if either image is missing
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2 text-center">So Sánh Ảnh</h3>
      <div className="relative w-full max-w-2xl mx-auto border rounded-md">
        <DynamicReactCompareImage
          leftImage={originalImageUrl}
          rightImage={enhancedImageUrl}
          leftImageLabel="Ảnh Gốc"
          rightImageLabel="Ảnh Đã Xử Lý"
          sliderLineWidth={2}
          handleSize={40}
        />
      </div>
      <div className="text-center mt-4">
        <Button
          onClick={() => {
            toast.info("Thông báo", {
              description:
                "Chức năng tải xuống ảnh đã xử lý sẽ sớm được cập nhật.",
            });
          }}
          className="cursor-pointer"
        >
          Tải Xuống Ảnh Đã Xử Lý
        </Button>
      </div>
    </div>
  );
}
