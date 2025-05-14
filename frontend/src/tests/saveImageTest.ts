import { RunpodComfyUIProvider } from "../services/image-enhancement/RunpodComfyUIProvider";
import * as fs from "fs";
import * as path from "path";

// Create a test class that extends RunpodComfyUIProvider and exposes the private method
class TestRunpodComfyUIProvider extends RunpodComfyUIProvider {
  // Expose the private method for testing
  public async testFetchImageAsBase64(
    imageUrl: string
  ): Promise<string | null> {
    // @ts-ignore - Access private method
    return this.fetchImageAsBase64(imageUrl);
  }
}

/**
 * Test that fetches an image, converts it to base64, and saves the decoded image
 * Usage: npm run test:save-image -- "https://your-image-url.com/image.jpg" "output.jpg"
 */
async function saveImageTest() {
  // Get the image URL and output filename from command line arguments
  const imageUrl = process.argv[2];
  const outputFilename = process.argv[3] || "output-image.jpg";

  if (!imageUrl) {
    console.error("❌ Please provide an image URL as an argument");
    console.log(
      'Usage: npm run test:save-image -- "https://your-image-url.com/image.jpg" "output.jpg"'
    );
    process.exit(1);
  }

  console.log(`🔍 Testing fetchImageAsBase64 with URL: ${imageUrl}`);
  console.log(`💾 Output will be saved to: ${outputFilename}`);

  // Create an instance of the test class
  const provider = new TestRunpodComfyUIProvider();

  try {
    console.log("⏳ Fetching and converting image to base64...");
    const startTime = Date.now();

    const base64Result = await provider.testFetchImageAsBase64(imageUrl);

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (base64Result) {
      console.log("✅ Success! Image fetched and converted to base64.");
      console.log(`⏱️ Duration: ${duration}ms`);
      console.log(`📊 Base64 string length: ${base64Result.length} characters`);

      // Verify it's a valid base64 string and save to a file
      try {
        const buffer = Buffer.from(base64Result, "base64");
        console.log(
          `✅ Valid base64 string. Decoded length: ${buffer.length} bytes`
        );

        // Create the output directory if it doesn't exist
        const outputDir = path.dirname(outputFilename);
        if (outputDir !== "." && !fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save the decoded image
        fs.writeFileSync(outputFilename, buffer);
        console.log(`💾 Decoded image saved to ${outputFilename}`);

        // Also save the base64 string to a text file for inspection
        const base64Filename = `${path.basename(outputFilename, path.extname(outputFilename))}-base64.txt`;
        fs.writeFileSync(base64Filename, base64Result);
        console.log(`💾 Base64 string saved to ${base64Filename}`);
      } catch (error) {
        console.error("❌ Invalid base64 string or error saving file:", error);
      }
    } else {
      console.error("❌ Failed to fetch and convert image to base64");
    }
  } catch (error) {
    console.error("❌ Error during test:", error);
  }
}

// Run the test
saveImageTest()
  .then(() => console.log("🏁 Test completed"))
  .catch((error) => console.error("❌ Test failed:", error));
