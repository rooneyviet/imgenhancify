"use client";

import { useCallback } from "react";
import { useDropzone, FileRejection, Accept } from "react-dropzone-esm";
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
    error,
    isUploading,
    isEnhancing,
    enhancedImageUrl,
    falRequestId,
    setSelectedFile,
    setError,
    setIsUploading,
    setIsEnhancing,
    setEnhancedImageUrl,
    setFalRequestId,
    resetState,
  } = useImageUploadStore();

  const handleEnhanceImage = async () => {
    if (!selectedFile) {
      toast.error("Lỗi", { description: "Vui lòng chọn một ảnh để xử lý." });
      return;
    }

    setIsUploading(true);
    setError(null);
    setEnhancedImageUrl(null);
    setFalRequestId(null);

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
      // const providerDeleteUrl = uploadResult.provider_delete_url; // For future use if needed

      toast.success("Thành công", { description: "Ảnh gốc đã được tải lên." });
      setIsUploading(false);
      setIsEnhancing(true);

      // Step 2: Enhance image
      try {
        if (!uploadedImageUrl) {
          // This check is a safeguard, should have been caught by the check above
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

        if (enhanceResult.enhancedUrl) {
          setEnhancedImageUrl(enhanceResult.enhancedUrl);
          toast.success("Thành công", {
            description: "Ảnh đã được xử lý thành công!",
          });
        } else if (enhanceResult.request_id) {
          setFalRequestId(enhanceResult.request_id);
          console.log("Fal.ai Request ID:", enhanceResult.request_id);
          toast.info("Đang xử lý", {
            description:
              "Ảnh của bạn đang được xử lý. Kết quả sẽ có sau ít phút.",
          });
        } else {
          // If no enhancedUrl and no request_id, it's an unexpected success response
          toast.warning("Thông báo", {
            description:
              "Không nhận được kết quả xử lý hoặc ID yêu cầu từ API.",
          });
        }
      } catch (enhanceError: any) {
        // Catch errors specifically from the enhance step
        console.error("Lỗi trong quá trình enhance ảnh:", enhanceError);
        setError(enhanceError.message || "Lỗi khi xử lý ảnh.");
        toast.error("Lỗi Enhance", {
          description: enhanceError.message || "Lỗi khi xử lý ảnh.",
        });
      } finally {
        setIsEnhancing(false); // Always set enhancing to false after this block

        // Step 3: Delete original image from ImgBB, regardless of enhance success/failure
        // if (uploadedImageUrl) {
        //   try {
        //     const deleteResponse = await fetch("/api/delete-image", {
        //       method: "POST",
        //       headers: { "Content-Type": "application/json" },
        //       body: JSON.stringify({ image_url: uploadedImageUrl }),
        //     });
        //     if (!deleteResponse.ok) {
        //       const errorData = await deleteResponse.json().catch(() => ({}));
        //       console.error(
        //         "Lỗi xóa ảnh gốc:",
        //         errorData.error || "Unknown error"
        //       );
        //       toast.warning("Cảnh báo Xóa", {
        //         description:
        //           "Không thể xóa ảnh gốc trên server trung gian. " +
        //           (errorData.error || ""),
        //       });
        //     } else {
        //       console.log("Ảnh gốc đã được xóa khỏi ImgBB.");
        //     }
        //   } catch (deleteError: any) {
        //     console.error("Lỗi gọi API xóa ảnh:", deleteError);
        //     toast.warning("Cảnh báo Xóa", {
        //       description:
        //         "Lỗi khi cố gắng xóa ảnh gốc: " + deleteError.message,
        //     });
        //   }
        // }
        // After all operations, if there's a result (enhanced or request ID),
        // we might want to clear selectedFile/previewUrl for the next upload.
        // resetState() handles this, so the "Tải Lên Ảnh Khác" button will do this.
      }
    } catch (e: any) {
      // Catch errors from upload step or other general errors
      console.error("Lỗi tổng thể trong quá trình xử lý ảnh:", e);
      setError(e.message || "Đã có lỗi xảy ra.");
      toast.error("Lỗi Tổng Thể", {
        description: e.message || "Đã có lỗi xảy ra trong quá trình xử lý.",
      });
      setIsUploading(false); // Ensure uploading is false if it fails here
      setIsEnhancing(false); // Ensure enhancing is also false
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      resetState(); // Reset all relevant states including error, results
      // setEnhancedImageUrl(null); // Handled by resetState
      // setFalRequestId(null);   // Handled by resetState
      // setError(null);          // Handled by resetState

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
        setError(message);
        toast.error("Lỗi Upload", { description: message });
        return;
      }

      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    [setSelectedFile, setError, resetState] // Removed setEnhancedImageUrl, setFalRequestId as resetState handles them
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
        {/* Dropzone: Show if no image is being processed or displayed */}
        {!isUploading && !isEnhancing && !enhancedImageUrl && !falRequestId && (
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-md cursor-pointer
              ${isDragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/70"}
              ${error ? "border-destructive" : ""}
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

        {error && !isUploading && !isEnhancing && (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        )}

        {(isUploading || isEnhancing) && (
          <div className="flex flex-col items-center justify-center mt-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              {isUploading
                ? "Đang tải ảnh lên..."
                : "Đang xử lý ảnh, vui lòng chờ..."}
            </p>
          </div>
        )}

        {enhancedImageUrl && !isEnhancing && (
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

        {falRequestId && !isEnhancing && !enhancedImageUrl && (
          <div className="mt-6 text-center p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">
              Yêu Cầu Đang Được Xử Lý
            </h3>
            <p className="text-sm text-blue-600">
              Ảnh của bạn đang được AI xử lý. Quá trình này có thể mất vài phút.
            </p>
            <p className="text-xs text-blue-500 mt-1">
              Request ID: {falRequestId}
            </p>
            <p className="text-sm text-blue-600 mt-2">
              Chúng tôi sẽ thông báo cho bạn khi hoàn tất (chức năng này sẽ được
              cập nhật sau).
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-4 pt-4">
        {/* Primary Action Button Area */}
        {!isUploading && !isEnhancing && (
          <>
            {selectedFile && !enhancedImageUrl && !falRequestId && !error && (
              <Button
                onClick={handleEnhanceImage}
                className="w-full max-w-xs cursor-pointer"
              >
                Enhance Image
              </Button>
            )}

            {/* Button to start over or select a new image */}
            {(enhancedImageUrl || falRequestId || error || !selectedFile) && (
              <Button
                onClick={() => {
                  if (
                    !selectedFile &&
                    !error &&
                    !enhancedImageUrl &&
                    !falRequestId
                  ) {
                    // If no file is selected and no error/result, try to trigger file input
                    const inputElement =
                      document.querySelector('input[type="file"]');
                    if (inputElement instanceof HTMLElement) {
                      inputElement.click();
                      return; // Don't reset state yet, let user pick a file
                    }
                  }
                  resetState();
                }}
                variant="outline"
                className="w-full max-w-xs cursor-pointer"
              >
                {enhancedImageUrl || falRequestId || error
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
