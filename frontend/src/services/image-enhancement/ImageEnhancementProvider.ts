export interface EnhancementRequest {
  imageUrl: string;
  // Add other parameters common to all providers if any
  // e.g., upscalingFactor, specific model requests, etc.
}

export interface EnhancementResponse {
  // This will likely be provider-specific, but we can define common fields
  requestId?: string; // For async providers
  enhancedImageUrl?: string; // For sync providers or after polling
  status: string; // e.g., 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'
  error?: string;
  providerRawResponse?: any; // To store the original response from the provider
}

export interface ImageEnhancementProvider {
  enhanceImage(request: EnhancementRequest): Promise<EnhancementResponse>;
}
