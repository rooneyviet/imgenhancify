export type PollingStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface PollingStatusResponse {
  status: PollingStatus;
  data?: any; // Dữ liệu trả về từ provider, có thể là any hoặc một kiểu cụ thể hơn
  error?: any; // Thông tin lỗi nếu có
}

export interface ImageResult {
  imageUrl: string;
  // Có thể thêm các trường khác nếu cần, ví dụ: metadata, thumbnailUrls, etc.
}

export interface PollingProvider {
  /**
   * Gửi request đến statusUrl để kiểm tra trạng thái của tác vụ.
   * @param statusUrl URL để kiểm tra trạng thái.
   * @param apiKey API key để xác thực với provider.
   * @returns Promise chứa PollingStatusResponse.
   */
  checkStatus(
    statusUrl: string,
    apiKey: string
  ): Promise<PollingStatusResponse>;

  /**
   * Trích xuất thông tin kết quả ảnh từ dữ liệu mà checkStatus trả về khi status là COMPLETED.
   * @param responseData Dữ liệu trả về từ checkStatus khi hoàn thành.
   * @param apiKey API key cần thiết để có thể fetch thêm dữ liệu nếu cần (ví dụ: gọi response_url của Fal.ai).
   * @returns Promise chứa ImageResult.
   */
  getResult(responseData: any, apiKey: string): Promise<ImageResult>;

  /**
   * Trả về khoảng thời gian (ms) giữa các lần poll.
   * @returns Khoảng thời gian polling.
   */
  getPollingInterval(): number;

  /**
   * Trả về thời gian polling tối đa (ms).
   * @returns Thời gian polling tối đa.
   */
  getMaxPollingDuration(): number;
}
