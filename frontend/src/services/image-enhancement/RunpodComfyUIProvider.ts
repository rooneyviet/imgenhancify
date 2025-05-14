import {
  ImageEnhancementProvider,
  EnhancementRequest,
  EnhancementResponse,
} from "./ImageEnhancementProvider";
import { createWorkflow } from "./workflows/comfyui-workflow";

export class RunpodComfyUIProvider implements ImageEnhancementProvider {
  private apiKey: string;
  private apiEndpoint: string;

  constructor() {
    this.apiKey = process.env.RUNPOD_API_KEY || "";
    this.apiEndpoint = process.env.RUNPOD_API_ENDPOINT || "";

    if (!this.apiKey || this.apiKey.trim() === "") {
      console.warn(
        "RunpodComfyUIProvider: RUNPOD_API_KEY is not configured. API calls will fail."
      );
    }

    if (!this.apiEndpoint || this.apiEndpoint.trim() === "") {
      console.warn(
        "RunpodComfyUIProvider: RUNPOD_API_ENDPOINT is not configured. API calls will fail."
      );
    }
  }

  async enhanceImage(
    request: EnhancementRequest
  ): Promise<EnhancementResponse> {
    console.log(
      "RunpodComfyUIProvider: enhanceImage called with:",
      request.imageUrl
    );

    if (!this.apiKey || this.apiKey.trim() === "") {
      return {
        status: "FAILED",
        error: "RUNPOD_API_KEY is not configured",
      };
    }

    if (!this.apiEndpoint || this.apiEndpoint.trim() === "") {
      return {
        status: "FAILED",
        error: "RUNPOD_API_ENDPOINT is not configured",
      };
    }

    try {
      // Fetch the image from the URL and convert to base64
      const imageBase64 = await this.fetchImageAsBase64(request.imageUrl);
      if (!imageBase64) {
        return {
          status: "FAILED",
          error: "Failed to fetch and convert image to base64",
        };
      }

      // Generate a random seed for the workflow
      const seed = Math.floor(Math.random() * 1000000000000000);

      // Construct the workflow payload
      const workflow = this.constructWorkflow(imageBase64, seed);

      // Make the API call to Runpod
      console.log(
        `RunpodComfyUIProvider: Calling Runpod API at ${this.apiEndpoint}/run`
      );

      const response = await fetch(`${this.apiEndpoint}/run`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(workflow),
      });

      const responseData = await response.json();
      console.log(
        "RunpodComfyUIProvider: Received response from Runpod:",
        responseData
      );

      if (!response.ok) {
        console.error(
          "RunpodComfyUIProvider: Runpod API call failed with status:",
          response.status,
          responseData
        );
        return {
          status: "FAILED",
          error: `Runpod API error (status ${response.status}): ${responseData?.error || "Unknown error"}`,
          providerRawResponse: responseData,
        };
      }

      // Return the response with the appropriate fields
      // Construct the status_url using the apiEndpoint and the responseData.id
      const status_url = `${this.apiEndpoint}/status/${responseData.id}`;

      return {
        requestId: responseData.id,
        status: responseData.status || "IN_QUEUE", // Default to IN_QUEUE if status is not present
        providerRawResponse: {
          ...responseData,
          status_url: status_url, // Add the constructed status_url
        },
      };
    } catch (error) {
      console.error("RunpodComfyUIProvider: Error calling Runpod API:", error);
      let errorMessage = "Unknown error during Runpod API call";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      return {
        status: "FAILED",
        error: `RunpodComfyUIProvider: ${errorMessage}`,
        providerRawResponse: error,
      };
    }
  }

  private async fetchImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch image from ${imageUrl}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");

      // Remove the data URL prefix if it exists
      const base64WithoutPrefix = base64.replace(
        /^data:image\/\w+;base64,/,
        ""
      );

      return base64WithoutPrefix;
    } catch (error) {
      console.error("Error fetching image as base64:", error);
      return null;
    }
  }

  private constructWorkflow(imageBase64: string, seed: number): any {
    // Use the external workflow creator function
    return createWorkflow(imageBase64, seed);
  }
}
