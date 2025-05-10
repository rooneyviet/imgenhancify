import { NextRequest, NextResponse } from "next/server";
import {
  PollingProvider,
  ImageResult,
} from "@/services/polling/PollingProvider";
import { FalPollingProvider } from "@/services/polling/FalPollingProvider";

// Một "factory" đơn giản để lấy provider
function getPollingProvider(providerNameLower: string): PollingProvider | null {
  // Nhận param đã lowercase
  switch (
    providerNameLower // Sử dụng trực tiếp
  ) {
    case "fal.ai":
      return new FalPollingProvider();
    // Thêm các case khác cho các provider trong tương lai
    // case 'anotherprovider':
    //   return new AnotherPollingProvider();
    default:
      return null;
  }
}

interface PollImageStatusRequestBody {
  providerName: string;
  statusUrl: string;
  apiKeyName?: string; // Tên biến môi trường chứa API key
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PollImageStatusRequestBody;
    const { providerName, statusUrl, apiKeyName } = body; // apiKeyName thường là undefined từ client hiện tại

    // Log giá trị nhận được
    console.log(
      `[API /api/poll-image-status] Received: providerName="${providerName}", statusUrl="${statusUrl}", apiKeyName="${apiKeyName}"`
    );

    if (!providerName || !statusUrl) {
      console.error(
        "[API /api/poll-image-status] Missing providerName or statusUrl in request body."
      );
      return NextResponse.json(
        { error: "Missing providerName or statusUrl" },
        { status: 400 }
      );
    }

    const lowerCaseProviderName = providerName.toLowerCase();
    console.log(
      `[API /api/poll-image-status] Using lowerCaseProviderName: "${lowerCaseProviderName}"`
    );

    const provider = getPollingProvider(lowerCaseProviderName); // Truyền providerName đã được lowercase
    if (!provider) {
      console.error(
        `[API /api/poll-image-status] Unsupported provider: "${providerName}" (resolved to "${lowerCaseProviderName}").`
      );
      return NextResponse.json(
        { error: `Unsupported provider: ${providerName}` },
        { status: 400 }
      );
    }
    console.log(
      `[API /api/poll-image-status] Successfully got PollingProvider for: "${lowerCaseProviderName}".`
    );

    let apiKey: string | undefined;

    if (lowerCaseProviderName === "fal.ai") {
      apiKey = process.env.FAL_API_KEY;
      console.log(
        `[API /api/poll-image-status] Provider is "fal.ai". FAL_API_KEY from env: ${apiKey ? "found (" + apiKey.substring(0, 5) + "...)" : "NOT FOUND"}`
      );
      if (!apiKey) {
        console.error(
          '[API /api/poll-image-status] CRITICAL: FAL_API_KEY is not configured or not accessible in environment variables for "fal.ai" provider.'
        );
        return NextResponse.json(
          { error: "FAL_API_KEY is not configured for the server." },
          { status: 500 }
        );
      }
    } else if (apiKeyName) {
      // Dành cho các provider khác yêu cầu apiKeyName cụ thể
      apiKey = process.env[apiKeyName];
      console.log(
        `[API /api/poll-image-status] Provider is "${lowerCaseProviderName}". API key from env."${apiKeyName}": ${apiKey ? "found" : "NOT FOUND"}`
      );
      if (!apiKey) {
        console.error(
          `[API /api/poll-image-status] CRITICAL: API key specified by env variable "${apiKeyName}" for provider "${providerName}" is not configured.`
        );
        return NextResponse.json(
          {
            error: `API key (env var: ${apiKeyName}) for provider ${providerName} not configured.`,
          },
          { status: 500 }
        );
      }
    } else {
      // Trường hợp provider không phải 'fal.ai' và client không gửi 'apiKeyName'
      // Điều này không nên xảy ra nếu client luôn gửi providerName là 'fal.ai' từ ImageEnhancementFactory
      console.error(
        `[API /api/poll-image-status] API key information is missing for provider "${providerName}". It's not "fal.ai" and no "apiKeyName" was provided in the request. This indicates a potential logic issue in how providerName is determined or passed.`
      );
      return NextResponse.json(
        {
          error: `API key configuration missing for provider: ${providerName}. If not "fal.ai", "apiKeyName" must be specified in the request body, or the provider is not correctly identified as "fal.ai".`,
        },
        { status: 400 }
      );
    }

    // Nếu đến đây, apiKey phải có giá trị
    console.log(
      `[API /api/poll-image-status] API key obtained successfully for provider "${providerName}".`
    );

    const maxDuration = provider.getMaxPollingDuration();
    const interval = provider.getPollingInterval();
    let elapsedTime = 0;

    while (elapsedTime < maxDuration) {
      const startTime = Date.now();
      console.log(
        `[API /api/poll-image-status] Polling ${statusUrl} for provider ${lowerCaseProviderName}... Attempt after ${elapsedTime}ms`
      );
      const statusResponse = await provider.checkStatus(statusUrl, apiKey);

      // Log chi tiết response từ provider.checkStatus
      console.log(
        `[API /api/poll-image-status] Status response from provider (${lowerCaseProviderName}):`,
        JSON.stringify(statusResponse, null, 2)
      );

      if (statusResponse.status === "COMPLETED") {
        if (!statusResponse.data) {
          console.error(
            "Polling COMPLETED but no data received from provider.checkStatus"
          );
          return NextResponse.json(
            { error: "Polling completed but no data received from provider" },
            { status: 500 }
          );
        }
        try {
          // Truyền apiKey vào getResult
          const imageResult: ImageResult = await provider.getResult(
            statusResponse.data,
            apiKey // apiKey đã được lấy ở trên và phải có giá trị ở đây
          );
          return NextResponse.json(imageResult, { status: 200 });
        } catch (error) {
          console.error("Error processing result from provider:", error);
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to process result from provider";
          return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
      } else if (statusResponse.status === "FAILED") {
        console.error(
          "Polling failed for URL:",
          statusUrl,
          "Error:",
          statusResponse.error
        );
        return NextResponse.json(
          {
            error: "Processing failed by the provider",
            details: statusResponse.error,
          },
          { status: 500 }
        );
      } else if (
        statusResponse.status === "IN_QUEUE" ||
        statusResponse.status === "IN_PROGRESS"
      ) {
        // Continue polling
        elapsedTime += Date.now() - startTime; // Thời gian thực tế của request vừa rồi
        const timeToWait = Math.max(0, interval - (Date.now() - startTime)); // Thời gian chờ còn lại cho đủ interval

        if (elapsedTime + timeToWait >= maxDuration) {
          console.warn(
            `Polling timeout approaching for ${statusUrl}. Elapsed: ${elapsedTime}, Interval: ${interval}, Max: ${maxDuration}`
          );
          // Không break ngay, để vòng lặp tự kiểm tra ở lần tiếp theo
        }

        if (elapsedTime < maxDuration) {
          await new Promise((resolve) => setTimeout(resolve, timeToWait));
          elapsedTime += timeToWait; // Cộng thêm thời gian đã chờ
        } else {
          // Đã vượt quá thời gian ngay cả trước khi chờ
          console.error(
            `Polling timed out for ${statusUrl} after ${elapsedTime}ms.`
          );
          return NextResponse.json(
            { error: "Polling timed out" },
            { status: 408 }
          );
        }
      } else {
        // Trạng thái không xác định từ provider.checkStatus
        console.error(
          "Unknown status from provider.checkStatus:",
          statusResponse
        );
        return NextResponse.json(
          { error: "Unknown status from provider" },
          { status: 500 }
        );
      }
    }

    // Nếu vòng lặp kết thúc do timeout
    console.error(`Polling timed out for ${statusUrl} after ${elapsedTime}ms.`);
    return NextResponse.json({ error: "Polling timed out" }, { status: 408 });
  } catch (error) {
    console.error("Error in poll-image-status API route:", error);
    if (error instanceof SyntaxError) {
      // Lỗi parse JSON
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
