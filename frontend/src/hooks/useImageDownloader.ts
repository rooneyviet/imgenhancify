import { toast } from "sonner";
import JSZip from "jszip";
import { useImageUploadStore } from "@/lib/store/imageUploadStore";

/**
 * Custom hook for downloading images, either individually or as a zip archive
 */
export const useImageDownloader = () => {
  const setIsDownloading = useImageUploadStore(
    (state) => state.setIsDownloading
  );

  /**
   * Downloads a single image from a URL
   * @param imageUrl URL of the image to download
   * @param imageName Filename to use for the downloaded image
   */
  const downloadSingleImage = async (imageUrl: string, imageName: string) => {
    setIsDownloading(true);
    try {
      // Use the API route to proxy the download
      const proxyUrl = `/api/download-image?url=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(imageName)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error during download." }));
        console.error(
          "Error downloading image via proxy:",
          response.status,
          errorData
        );
        toast.error(
          `Failed to download image: ${errorData.error || response.statusText}`
        );
        setIsDownloading(false);
        return;
      }

      const blob = await response.blob();

      // Create a download link
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = imageName; // The server will set Content-Disposition, but this is a fallback
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Image downloaded successfully");
    } catch (error) {
      console.error("Error downloading image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to download image: ${errorMessage}`);
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Downloads multiple images as a zip file
   * @param images Array of image objects with url and name properties
   * @param zipName Optional name for the zip file (defaults to "enhanced-images.zip")
   */
  const downloadMultipleImagesAsZip = async (
    images: Array<{ url: string; name: string }>,
    zipName: string = "enhanced-images.zip"
  ) => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();

      // Add each image to the zip
      const promises = images.map(async (image) => {
        // Use the API route to proxy the download for each image in the zip
        const proxyUrl = `/api/download-image?url=${encodeURIComponent(image.url)}&name=${encodeURIComponent(image.name)}`;
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          // Log error and skip this image, or throw to fail the whole zip
          console.error(
            `Failed to fetch image ${image.name} for zip: ${response.status}`
          );
          toast.error(`Skipping ${image.name}: Download failed`);
          return; // Skip this image
        }
        const blob = await response.blob();
        zip.file(image.name, blob);
      });

      // Wait for all images to be added to the zip
      await Promise.all(promises);

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create a download link
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Images downloaded successfully");
    } catch (error) {
      console.error("Error creating zip file:", error);
      toast.error("Failed to download images");
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    downloadSingleImage,
    downloadMultipleImagesAsZip,
  };
};
