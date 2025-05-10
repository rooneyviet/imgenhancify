import { create } from "zustand";

interface ImageUploadState {
  selectedFile: File | null;
  previewUrl: string | null;
  error: string | null;
  isUploading: boolean;
  isEnhancing: boolean;
  enhancedImageUrl: string | null;
  falRequestId: string | null;
  setSelectedFile: (file: File | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setError: (error: string | null) => void;
  setIsUploading: (isUploading: boolean) => void;
  setIsEnhancing: (isEnhancing: boolean) => void;
  setEnhancedImageUrl: (url: string | null) => void;
  setFalRequestId: (id: string | null) => void;
  resetState: () => void;
}

export const useImageUploadStore = create<ImageUploadState>((set) => ({
  selectedFile: null,
  previewUrl: null,
  error: null,
  isUploading: false,
  isEnhancing: false,
  enhancedImageUrl: null,
  falRequestId: null,
  setSelectedFile: (file) => {
    set({ selectedFile: file });
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        set({ previewUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    } else {
      set({ previewUrl: null });
    }
  },
  setPreviewUrl: (url) => set({ previewUrl: url }),
  setError: (error) => set({ error }),
  setIsUploading: (isUploading) => set({ isUploading }),
  setIsEnhancing: (isEnhancing) => set({ isEnhancing }),
  setEnhancedImageUrl: (url) => set({ enhancedImageUrl: url }),
  setFalRequestId: (id) => set({ falRequestId: id }),
  resetState: () =>
    set({
      selectedFile: null,
      previewUrl: null,
      error: null,
      isUploading: false,
      isEnhancing: false,
      enhancedImageUrl: null,
      falRequestId: null,
    }),
}));
