import { create } from "zustand";

interface ImageUploadState {
  selectedFile: File | null;
  previewUrl: string | null;
  error: string | null;
  isUploading: boolean;
  isEnhancing: boolean;
  isPolling: boolean;
  enhancedImageUrl: string | null;
  falRequestId: string | null;
  pollingStatusUrl: string | null;
  pollingProviderName: string | null;
  pollingError: string | null; // New state for polling errors
  // originalImageUrl will be represented by previewUrl for simplicity,
  // as previewUrl holds the URL of the original image selected by the user.
  // If a distinct originalImageUrl is strictly needed for other purposes later,
  // it can be added. For now, previewUrl serves this role.

  setSelectedFile: (file: File | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setError: (error: string | null) => void;
  setIsUploading: (isUploading: boolean) => void;
  setIsEnhancing: (isEnhancing: boolean) => void;
  setIsPolling: (isPolling: boolean) => void;
  setEnhancedImageUrl: (url: string | null) => void;
  setFalRequestId: (id: string | null) => void;
  setPollingInfo: (info: {
    statusUrl: string | null;
    providerName: string | null;
  }) => void;
  setPollingError: (error: string | null) => void; // New setter
  resetState: () => void;
  startPolling: (statusUrl: string, providerName: string) => void; // Action to initiate polling related states
}

export const useImageUploadStore = create<ImageUploadState>((set, get) => ({
  selectedFile: null,
  previewUrl: null,
  error: null,
  isUploading: false,
  isEnhancing: false,
  isPolling: false,
  enhancedImageUrl: null,
  falRequestId: null,
  pollingStatusUrl: null,
  pollingProviderName: null,
  pollingError: null,
  setSelectedFile: (file) => {
    set({
      selectedFile: file,
      pollingError: null,
      enhancedImageUrl: null,
      error: null,
    }); // Reset errors and enhanced image on new file
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        set({ previewUrl: reader.result as string }); // This is our originalImageUrl
      };
      reader.readAsDataURL(file);
    } else {
      set({ previewUrl: null });
    }
  },
  setPreviewUrl: (url) => set({ previewUrl: url }),
  setError: (error) =>
    set({ error, isUploading: false, isEnhancing: false, isPolling: false }),
  setIsUploading: (isUploading) => set({ isUploading, error: null }),
  setIsEnhancing: (isEnhancing) => set({ isEnhancing, error: null }),
  setIsPolling: (isPolling) => set({ isPolling, pollingError: null }), // Reset pollingError when starting/stopping polling
  setEnhancedImageUrl: (url) =>
    set({ enhancedImageUrl: url, isPolling: false, pollingError: null }),
  setFalRequestId: (id) => set({ falRequestId: id }),
  setPollingInfo: (info) =>
    set({
      pollingStatusUrl: info.statusUrl,
      pollingProviderName: info.providerName,
      isPolling: !!info.statusUrl, // Start polling if statusUrl is set
      pollingError: null, // Reset error when new polling info is set
    }),
  setPollingError: (pollingError) => set({ pollingError, isPolling: false }), // New setter implementation
  resetState: () =>
    set({
      selectedFile: null,
      previewUrl: null,
      error: null,
      isUploading: false,
      isEnhancing: false,
      isPolling: false,
      enhancedImageUrl: null,
      falRequestId: null,
      pollingStatusUrl: null,
      pollingProviderName: null,
      pollingError: null,
    }),
  startPolling: (statusUrl: string, providerName: string) => {
    set({
      pollingStatusUrl: statusUrl,
      pollingProviderName: providerName,
      isPolling: true,
      pollingError: null,
      enhancedImageUrl: null, // Clear previous enhanced image
      error: null, // Clear general errors
    });
  },
}));
