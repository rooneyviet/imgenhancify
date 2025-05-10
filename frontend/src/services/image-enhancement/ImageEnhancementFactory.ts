import { ImageEnhancementProvider } from "./ImageEnhancementProvider";
import { FalAIProvider } from "./FalAIProvider";
// Import other providers here as they are added
// import { OtherProvider } from './OtherProvider';

export type ProviderType = "fal.ai" | "other_provider"; // Add more as needed

export class ImageEnhancementFactory {
  static getProvider(type?: ProviderType): ImageEnhancementProvider {
    const providerType =
      type || process.env.IMAGE_ENHANCEMENT_PROVIDER || "fal.ai";
    console.log(
      `ImageEnhancementFactory: Getting provider for type: ${providerType}`
    );

    switch (providerType) {
      case "fal.ai":
        return new FalAIProvider();
      // case 'other_provider':
      //   return new OtherProvider();
      default:
        console.warn(
          `ImageEnhancementFactory: Unknown provider type "${providerType}". Defaulting to FalAIProvider.`
        );
        return new FalAIProvider(); // Default provider
    }
  }
}
