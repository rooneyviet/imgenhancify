"use client";

import { useCallback } from "react"; // Removed useEffect as it's no longer used for polling here
import { useDropzone, FileRejection, Accept } from "react-dropzone-esm";
import { useImagePolling } from "@/hooks/useImagePolling"; // Import hook mới
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

const acceptedFileTypes: Accept = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

export function ImageUploadArea() {
  const {
    selectedFile,
    previewUrl,
    error, // General error
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
    pollingError, // Polling-specific error from store
  } = useImageUploadStore();

  const { initiatePolling } = useImagePolling();

  const handleEnhanceImage = async () => {
    if (!selectedFile) {
      toast.error("Lỗi", { description: "Vui lòng chọn một ảnh để xử lý." });
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
          errorData.error || "Upload ảnh gốc thất bại. Vui lòng thử lại."
        );
      }

      const uploadResult = await uploadResponse.json();
      if (!uploadResult.imageUrl) {
        console.error("API response không có imageUrl:", uploadResult);
        throw new Error("Không nhận được URL ảnh từ API upload.");
      }
      uploadedImageUrl = uploadResult.imageUrl;
      console.log("Uploaded image URL:", uploadedImageUrl);

      toast.success("Thành công", { description: "Ảnh gốc đã được tải lên." });
      setIsUploading(false);
      setIsEnhancing(true);

      // Step 2: Enhance image
      try {
        if (!uploadedImageUrl) {
          throw new Error(
            "uploadedImageUrl không hợp lệ trước khi gọi enhance."
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
            errorData.error || "Xử lý ảnh thất bại. Vui lòng thử lại."
          );
        }

        const enhanceResult = await enhanceResponse.json();
        console.log("Enhance API Result:", enhanceResult);

        if (enhanceResult.enhancedUrl) {
          setEnhancedImageUrl(enhanceResult.enhancedUrl);
          toast.success("Thành công", {
            description: "Ảnh đã được xử lý thành công!",
          });
          setIsEnhancing(false);
        } else if (enhanceResult.status_url && enhanceResult.provider_name) {
          setFalRequestId(enhanceResult.request_id || null);
          initiatePolling(
            enhanceResult.status_url,
            enhanceResult.provider_name
          );
          setIsEnhancing(false);
          toast.info("Đang xử lý", {
            description:
              "Ảnh của bạn đã được gửi đi xử lý. Hệ thống sẽ tự động kiểm tra trạng thái.",
          });
        } else if (
          enhanceResult.request_id &&
          enhanceResult.status === "IN_QUEUE" &&
          enhanceResult.status_url
        ) {
          setFalRequestId(enhanceResult.request_id);
          initiatePolling(enhanceResult.status_url, "fal");
          setIsEnhancing(false);
          toast.info("Đang xử lý", {
            description:
              "Ảnh của bạn đang được gửi đi xử lý (Fal). Hệ thống sẽ tự động kiểm tra trạng thái.",
          });
        } else {
          toast.warning("Thông báo", {
            description:
              enhanceResult.error ||
              "Không nhận được thông tin cần thiết để theo dõi hoặc kết quả xử lý từ API.",
          });
          setIsEnhancing(false);
        }
      } catch (enhanceError: any) {
        console.error("Lỗi trong quá trình enhance ảnh:", enhanceError);
        setError(enhanceError.message || "Lỗi khi xử lý ảnh.");
        toast.error("Lỗi Enhance", {
          description: enhanceError.message || "Lỗi khi xử lý ảnh.",
        });
        setIsEnhancing(false); // Ensure enhancing is false on error
      }
    } catch (e: any) {
      console.error("Lỗi tổng thể trong quá trình xử lý ảnh:", e);
      setError(e.message || "Đã có lỗi xảy ra.");
      toast.error("Lỗi Tổng Thể", {
        description: e.message || "Đã có lỗi xảy ra trong quá trình xử lý.",
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
        let message = "Có lỗi xảy ra khi tải file lên.";
        if (firstRejection.errors.some((e) => e.code === "too-many-files")) {
          message = "Chỉ được phép tải lên một ảnh duy nhất.";
        } else if (
          firstRejection.errors.some((e) => e.code === "file-invalid-type")
        ) {
          message = "File không hợp lệ. Vui lòng chọn một file ảnh.";
        }
        setError(message); // Set general error
        toast.error("Lỗi Upload", { description: message });
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
        <CardTitle>Tăng Cường Chất Lượng Ảnh</CardTitle>
        <CardDescription>
          Tải ảnh của bạn lên để cải thiện chất lượng bằng AI.
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
                    alt={`Xem trước ${selectedFile.name}`}
                    layout="fill"
                    objectFit="contain"
                    className="rounded-md"
                  />
                </div>
              ) : isDragActive ? (
                <p className="text-primary">Thả ảnh vào đây...</p>
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
                      Nhấp để tải lên
                    </span>{" "}
                    hoặc kéo thả
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Chỉ một ảnh (JPEG, PNG, WEBP, GIF)
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
                ? "Đang tải ảnh lên..."
                : isEnhancing
                  ? "Đang gửi yêu cầu xử lý..."
                  : isPolling
                    ? "Đang kiểm tra kết quả xử lý..."
                    : "Đang xử lý..."}
            </p>
          </div>
        )}

        {/* Enhanced Image Display: Show if URL exists and not in an active enhancing/polling state */}
        {enhancedImageUrl && !isEnhancing && !isPolling && (
          <div className="mt-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Ảnh Đã Xử Lý:</h3>
            <div className="relative w-full max-w-md mx-auto h-auto aspect-video border rounded-md overflow-hidden">
              <Image
                src={enhancedImageUrl}
                alt="Ảnh đã được xử lý"
                layout="fill"
                objectFit="contain"
              />
            </div>
            <Button
              onClick={() => {
                toast.info("Thông báo", {
                  description: "Chức năng tải xuống sẽ sớm được cập nhật.",
                });
              }}
              className="mt-4 cursor-pointer"
            >
              Tải Xuống Ảnh
            </Button>
          </div>
        )}

        {/* Pending Polling Info Display: Show if pollingStatusUrl exists, not actively polling, and no final image yet AND no polling error */}
        {pollingStatusUrl &&
          !isPolling &&
          !enhancedImageUrl &&
          !pollingError && (
            <div className="mt-6 text-center p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h3 className="text-lg font-semibold text-yellow-700 mb-2">
                Yêu Cầu Đã Được Gửi
              </h3>
              <p className="text-sm text-yellow-600">
                Ảnh của bạn đã được gửi đi xử lý. Nếu trang được tải lại, bạn có
                thể cần thực hiện lại.
              </p>
              {falRequestId && (
                <p className="text-xs text-yellow-500 mt-1">
                  Request ID: {falRequestId}
                </p>
              )}
              <p className="text-sm text-yellow-600 mt-2">
                Trạng thái: Đang chờ xử lý.
              </p>
              <Button
                onClick={() => {
                  useImageUploadStore.getState().setPollingError(null); // Clear previous polling error
                  useImageUploadStore.getState().setIsPolling(true); // This will re-enable the useQuery via store change
                }}
                variant="link"
                className="mt-2"
              >
                Thử kiểm tra lại
              </Button>
            </div>
          )}
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-4 pt-4">
        {/* Primary Action Button Area: Show if not in any active processing state */}
        {!isUploading && !isEnhancing && !isPolling && (
          <>
            {/* Enhance Button: Show if a file is selected, no results yet, and no pending polling, and no errors */}
            {selectedFile &&
              !enhancedImageUrl &&
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
            {(enhancedImageUrl ||
              pollingStatusUrl || // If a process was started (even if it errored later)
              error || // If there was a general error
              pollingError || // If there was a polling error
              !selectedFile) && ( // Initial state or after reset
              <Button
                onClick={() => {
                  // If in a clean state (no file, no errors, no results), trigger file input
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
                  resetState(); // Otherwise, reset everything
                }}
                variant="outline"
                className="w-full max-w-xs cursor-pointer"
              >
                {enhancedImageUrl || pollingStatusUrl || error || pollingError
                  ? "Tải Lên Ảnh Khác"
                  : "Chọn Ảnh Để Bắt Đầu"}
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
}
