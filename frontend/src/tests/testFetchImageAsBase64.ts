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

// Function to test the fetchImageAsBase64 method
async function testFetchImageAsBase64() {
  console.log("Starting test for fetchImageAsBase64...");

  // Create an instance of the test class
  const provider = new TestRunpodComfyUIProvider();

  // Test with a valid image URL
  // Using a public test image from placeholder.com
  const testImageUrl =
    "https://fastly.picsum.photos/id/1/200/300.jpg?hmac=jH5bDkLr6Tgy3oAg5khKCHeunZMHq0ehBZr6vGifPLY";

  try {
    console.log(`Fetching image from: ${testImageUrl}`);
    const base64Result = await provider.testFetchImageAsBase64(testImageUrl);

    if (base64Result) {
      console.log("✅ Success! Image fetched and converted to base64.");
      console.log(`Base64 string length: ${base64Result.length}`);
      console.log(`First 50 characters: ${base64Result.substring(0, 50)}...`);

      // Verify it's a valid base64 string
      try {
        const buffer = Buffer.from(base64Result, "base64");
        console.log(
          `✅ Valid base64 string. Decoded length: ${buffer.length} bytes`
        );
      } catch (error) {
        console.error("❌ Invalid base64 string:", error);
      }
    } else {
      console.error("❌ Failed to fetch and convert image to base64");
    }
  } catch (error) {
    console.error("❌ Error during test:", error);
  }

  // Test with an invalid image URL
  const invalidImageUrl =
    "https://this-url-does-not-exist-123456789.com/image.jpg";

  try {
    console.log(`\nTesting with invalid URL: ${invalidImageUrl}`);
    const base64Result = await provider.testFetchImageAsBase64(invalidImageUrl);

    if (base64Result === null) {
      console.log("✅ Correctly returned null for invalid URL");
    } else {
      console.error("❌ Expected null for invalid URL but got a result");
    }
  } catch (error) {
    console.error("❌ Error during invalid URL test:", error);
  }
}

// Run the test
testFetchImageAsBase64()
  .then(() => console.log("Test completed"))
  .catch((error) => console.error("Test failed:", error));
