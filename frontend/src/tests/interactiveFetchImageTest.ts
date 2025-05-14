import { RunpodComfyUIProvider } from "../services/image-enhancement/RunpodComfyUIProvider";

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
 * Interactive test for fetchImageAsBase64 method
 * Usage: npm run test:fetch-image-interactive -- "https://your-image-url.com/image.jpg"
 */
async function interactiveFetchImageTest() {
  // Get the image URL from command line arguments
  const imageUrl = process.argv[2];

  if (!imageUrl) {
    console.error("❌ Please provide an image URL as an argument");
    console.log(
      'Usage: npm run test:fetch-image-interactive -- "https://your-image-url.com/image.jpg"'
    );
    process.exit(1);
  }

  console.log(`🔍 Testing fetchImageAsBase64 with URL: ${imageUrl}`);

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
      console.log(
        `🔍 First 50 characters: ${base64Result.substring(0, 50)}...`
      );

      // Verify it's a valid base64 string
      try {
        const buffer = Buffer.from(base64Result, "base64");
        console.log(
          `✅ Valid base64 string. Decoded length: ${buffer.length} bytes`
        );

        // Save to a file for inspection if needed
        // Uncomment the following lines if you want to save the decoded image
        /*
        const fs = require('fs');
        fs.writeFileSync('decoded-image.bin', buffer);
        console.log('💾 Decoded image saved to decoded-image.bin');
        */
      } catch (error) {
        console.error("❌ Invalid base64 string:", error);
      }
    } else {
      console.error("❌ Failed to fetch and convert image to base64");
    }
  } catch (error) {
    console.error("❌ Error during test:", error);
  }
}

// Run the test
interactiveFetchImageTest()
  .then(() => console.log("🏁 Test completed"))
  .catch((error) => console.error("❌ Test failed:", error));
