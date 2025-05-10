import {
  PollingProvider,
  PollingStatusResponse,
  ImageResult,
  PollingStatus,
} from "./PollingProvider";

interface FalStatusResponse {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  // Fal.ai có thể trả về các trường khác tùy thuộc vào model và trạng thái
  // Ví dụ: response_url, logs, error, etc.
  response_url?: string; // Thường có khi status là IN_PROGRESS hoặc COMPLETED
  [key: string]: any; // Cho phép các trường khác
}

export class FalPollingProvider implements PollingProvider {
  public async checkStatus(
    statusUrl: string,
    apiKey: string
  ): Promise<PollingStatusResponse> {
    if (!apiKey) {
      console.error("Fal API key is missing.");
      return { status: "FAILED", error: "Fal API key is missing." };
    }

    try {
      const response = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        console.error(`Fal API error (${response.status}):`, errorData);
        return { status: "FAILED", error: errorData };
      }

      const falResponse: FalStatusResponse = await response.json();

      let pollingStatus: PollingStatus;
      switch (falResponse.status) {
        case "IN_QUEUE":
          pollingStatus = "IN_QUEUE";
          break;
        case "IN_PROGRESS":
          pollingStatus = "IN_PROGRESS";
          break;
        case "COMPLETED":
          pollingStatus = "COMPLETED";
          break;
        default:
          // Nếu Fal.ai trả về một trạng thái không mong đợi
          console.warn("Unknown status from Fal.ai:", falResponse.status);
          // Coi như đang xử lý để tiếp tục poll, hoặc có thể coi là FAILED tùy logic
          pollingStatus = "IN_PROGRESS";
      }

      // Trả về toàn bộ falResponse trong data để getResult có thể sử dụng
      return { status: pollingStatus, data: falResponse };
    } catch (error) {
      console.error("Error checking Fal status:", error);
      return {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  public async getResult(
    responseData: any,
    apiKey: string
  ): Promise<ImageResult> {
    // responseData ở đây là falResponse từ checkStatus (kết quả của việc gọi status_url)
    const falInitialStatusResponse = responseData as FalStatusResponse;

    if (
      !falInitialStatusResponse ||
      typeof falInitialStatusResponse !== "object"
    ) {
      throw new Error("Invalid initial status response data for getResult");
    }

    // Theo phản hồi của bạn, khi status là COMPLETED, falInitialStatusResponse.response_url
    // là URL cần được fetch để lấy URL ảnh thực sự.
    if (
      falInitialStatusResponse.response_url &&
      typeof falInitialStatusResponse.response_url === "string"
    ) {
      const finalResultUrl = falInitialStatusResponse.response_url;
      console.log(
        `[FalPollingProvider] Status COMPLETED. Fetching final result from: ${finalResultUrl}`
      );

      if (!apiKey) {
        // Điều này không nên xảy ra nếu API route truyền apiKey vào
        console.error(
          "[FalPollingProvider] API key is missing in getResult, cannot fetch final result URL."
        );
        throw new Error(
          "API key missing, cannot fetch final result from Fal.ai."
        );
      }

      try {
        const finalResponse = await fetch(finalResultUrl, {
          method: "GET",
          headers: {
            Authorization: `Key ${apiKey}`,
            Accept: "application/json", // Yêu cầu JSON response
          },
        });

        if (!finalResponse.ok) {
          const errorText = await finalResponse.text();
          console.error(
            `[FalPollingProvider] Error fetching final result from ${finalResultUrl} (status ${finalResponse.status}):`,
            errorText
          );
          throw new Error(
            `Failed to fetch final result from Fal.ai: ${finalResponse.status} - ${errorText}`
          );
        }

        const finalResultData = await finalResponse.json();
        console.log(
          `[FalPollingProvider] Received final result data:`,
          JSON.stringify(finalResultData, null, 2)
        );

        // Dựa trên ví dụ của bạn: {"image":{"url":"..."}}
        if (
          finalResultData &&
          finalResultData.image &&
          typeof finalResultData.image.url === "string"
        ) {
          return { imageUrl: finalResultData.image.url };
        } else {
          console.error(
            "[FalPollingProvider] Could not extract direct image URL from final Fal.ai response. Expected format like { image: { url: '...' } }.",
            finalResultData
          );
          throw new Error(
            "Direct image URL not found in the final Fal.ai response structure."
          );
        }
      } catch (error) {
        console.error(
          `[FalPollingProvider] Exception while fetching or parsing final result from ${finalResultUrl}:`,
          error
        );
        throw error; // Ném lại lỗi để API route xử lý
      }
    } else {
      // Fallback hoặc lỗi nếu response_url không có khi COMPLETED
      // Dựa trên logic cũ, nhưng điều này có thể không còn phù hợp.
      console.warn(
        "[FalPollingProvider] COMPLETED status but no response_url found in initial status data. Attempting direct extraction (legacy).",
        falInitialStatusResponse
      );
      let imageUrl: string | undefined;
      if (
        falInitialStatusResponse.images &&
        Array.isArray(falInitialStatusResponse.images) &&
        falInitialStatusResponse.images.length > 0 &&
        falInitialStatusResponse.images[0].url
      ) {
        imageUrl = falInitialStatusResponse.images[0].url;
      } else if (falInitialStatusResponse.image_url) {
        imageUrl = falInitialStatusResponse.image_url;
      } else if (
        falInitialStatusResponse.output &&
        typeof falInitialStatusResponse.output === "string" &&
        falInitialStatusResponse.output.startsWith("http")
      ) {
        imageUrl = falInitialStatusResponse.output;
      }

      if (imageUrl) {
        console.log(
          "[FalPollingProvider] Extracted imageUrl via legacy method:",
          imageUrl
        );
        return { imageUrl };
      }

      console.error(
        "[FalPollingProvider] Could not extract image URL. Status was COMPLETED, but response_url was missing or direct extraction failed.",
        falInitialStatusResponse
      );
      throw new Error(
        "Image URL not found in Fal response after completion (response_url missing or invalid)."
      );
    }
  }

  public getPollingInterval(): number {
    return 3000; // 1 giây
  }

  public getMaxPollingDuration(): number {
    return 300000; // 5 phút
  }
}
