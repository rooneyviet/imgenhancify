import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

// Interface for individual image state
export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string | null;
  isUploading: boolean;
  isEnhancing: boolean;
  isPolling: boolean;
  enhancedImageUrl: string | null;
  falRequestId: string | null;
  pollingStatusUrl: string | null;
  pollingProviderName: string | null;
  pollingError: string | null;
  uploadedImageUrl: string | null; // URL of the uploaded image on the server
  error: string | null;
  inQueueSince: number | null; // Timestamp when the image entered IN_QUEUE status
}

interface ImageUploadState {
  images: ImageItem[];
  selectedImageId: string | null; // ID of the currently selected image for comparison view
  error: string | null; // Global error state
  isProcessing: boolean; // Flag to indicate if any image is being processed

  // Actions for multiple images
  addImages: (files: File[]) => void;
  removeImage: (id: string) => void;
  updateImage: (id: string, updates: Partial<Omit<ImageItem, "id">>) => void;
  selectImage: (id: string | null) => void;
  resetState: () => void;

  // Actions for processing queue
  processNextImage: () => void;
  isProcessingQueue: boolean;
  processingQueue: string[]; // IDs of images waiting to be processed

  // Legacy actions (modified to work with multiple images)
  setError: (error: string | null) => void;
  startPolling: (id: string, statusUrl: string, providerName: string) => void;
}

export const useImageUploadStore = create<ImageUploadState>((set, get) => ({
  images: [],
  selectedImageId: null,
  error: null,
  isProcessing: false,
  isProcessingQueue: false,
  processingQueue: [],

  addImages: (files) => {
    const MAX_IMAGES = 20;
    const currentImages = get().images;

    // Limit total number of images to MAX_IMAGES
    const availableSlots = MAX_IMAGES - currentImages.length;
    const filesToAdd = files.slice(0, availableSlots);

    if (filesToAdd.length === 0) return;

    const newImages = filesToAdd.map((file) => {
      const id = uuidv4();

      // Create preview URL
      let previewUrl: string | null = null;
      const reader = new FileReader();
      reader.onloadend = () => {
        // Update the image with the preview URL once it's ready
        get().updateImage(id, { previewUrl: reader.result as string });
      };
      reader.readAsDataURL(file);

      return {
        id,
        file,
        previewUrl,
        isUploading: false,
        isEnhancing: false,
        isPolling: false,
        enhancedImageUrl: null,
        falRequestId: null,
        pollingStatusUrl: null,
        pollingProviderName: null,
        pollingError: null,
        uploadedImageUrl: null,
        error: null,
        inQueueSince: null,
      };
    });

    const updatedImages = [...currentImages, ...newImages];
    const newIds = newImages.map((img) => img.id);

    set((state) => ({
      images: updatedImages,
      error: null,
      // If this is the first batch of images and none are selected yet, select the first one
      selectedImageId:
        state.selectedImageId === null && updatedImages.length > 0
          ? updatedImages[0].id
          : state.selectedImageId,
      // Add new images to processing queue but don't start processing yet
      processingQueue:
        state.processingQueue.length > 0
          ? [...state.processingQueue, ...newIds]
          : newIds,
      // Don't set isProcessingQueue to true - we'll set it when the user clicks "Enhance"
      isProcessingQueue: false,
    }));

    // Don't automatically start processing - wait for user to click "Enhance" button
  },

  removeImage: (id) => {
    const currentImages = get().images;
    const updatedImages = currentImages.filter((img) => img.id !== id);
    const currentSelectedId = get().selectedImageId;

    // Update selected image if the removed one was selected
    let newSelectedId = currentSelectedId;
    if (currentSelectedId === id) {
      newSelectedId = updatedImages.length > 0 ? updatedImages[0].id : null;
    }

    // Remove from processing queue if present
    const updatedQueue = get().processingQueue.filter(
      (queuedId) => queuedId !== id
    );

    set({
      images: updatedImages,
      selectedImageId: newSelectedId,
      processingQueue: updatedQueue,
      // Update isProcessing flag based on remaining images' states
      isProcessing: updatedImages.some(
        (img) => img.isUploading || img.isEnhancing || img.isPolling
      ),
      // Update isProcessingQueue flag
      isProcessingQueue: updatedQueue.length > 0,
    });
  },

  updateImage: (id, updates) => {
    set((state) => {
      // Check if this update includes setting an enhancedImageUrl
      const isSettingEnhancedUrl =
        updates.enhancedImageUrl !== undefined &&
        updates.enhancedImageUrl !== null;

      // Get the current image
      const currentImage = state.images.find((img) => img.id === id);

      // Check if this is the first image to get an enhancedImageUrl
      const isFirstProcessedImage =
        isSettingEnhancedUrl &&
        currentImage &&
        !currentImage.enhancedImageUrl &&
        !state.images.some((img) => img.enhancedImageUrl);

      return {
        images: state.images.map((img) =>
          img.id === id ? { ...img, ...updates } : img
        ),
        // If this is the first image to get an enhancedImageUrl, select it
        selectedImageId: isFirstProcessedImage ? id : state.selectedImageId,
        // Update global isProcessing flag based on all images
        isProcessing: state.images.some((img) =>
          img.id === id
            ? updates.isUploading || updates.isEnhancing || updates.isPolling
            : img.isUploading || img.isEnhancing || img.isPolling
        ),
      };
    });
  },

  selectImage: (id) => set({ selectedImageId: id }),

  setError: (error) => set({ error }),

  resetState: () =>
    set({
      images: [],
      selectedImageId: null,
      error: null,
      isProcessing: false,
      isProcessingQueue: false,
      processingQueue: [],
    }),

  startPolling: (id, statusUrl, providerName) => {
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id
          ? {
              ...img,
              pollingStatusUrl: statusUrl,
              pollingProviderName: providerName,
              isPolling: true,
              pollingError: null,
              error: null,
            }
          : img
      ),
      isProcessing: true,
    }));
  },

  processNextImage: () => {
    const state = get();
    const queue = state.processingQueue;

    if (queue.length === 0) {
      set({ isProcessingQueue: false });
      return;
    }

    const nextId = queue[0];
    const updatedQueue = queue.slice(1);

    // Find the image to process
    const imageToProcess = state.images.find((img) => img.id === nextId);
    if (!imageToProcess) {
      // If image not found (maybe was removed), process next
      set({ processingQueue: updatedQueue });
      get().processNextImage();
      return;
    }

    // Mark the image as uploading
    get().updateImage(nextId, { isUploading: true, error: null });

    set({
      processingQueue: updatedQueue,
      isProcessing: true,
    });
  },
}));
