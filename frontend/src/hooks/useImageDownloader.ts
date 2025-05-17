import { toast } from "sonner";
import JSZip from "jszip";

/**
 * Custom hook for downloading images, either individually or as a zip archive
 */
export const useImageDownloader = () => {
  /**
   * Downloads a single image from a URL
   * @param imageUrl URL of the image to download
   * @param imageName Filename to use for the downloaded image
   */
  const downloadSingleImage = async (imageUrl: string, imageName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Create a download link
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = imageName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Image downloaded successfully");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
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
    try {
      const zip = new JSZip();

      // Add each image to the zip
      const promises = images.map(async (image) => {
        const response = await fetch(image.url);
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
    }
  };

  return {
    downloadSingleImage,
    downloadMultipleImagesAsZip,
  };
};
