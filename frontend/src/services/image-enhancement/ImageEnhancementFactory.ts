import { ImageEnhancementProvider } from "./ImageEnhancementProvider";
import { FalAIProvider } from "./FalAIProvider";
import { RunpodComfyUIProvider } from "./RunpodComfyUIProvider";
import { PollingProvider } from "../polling/PollingProvider";
import { FalPollingProvider } from "../polling/FalPollingProvider";
import { RunpodPollingProvider } from "../polling/RunpodPollingProvider";
// Import other providers here as they are added
// import { OtherProvider } from './OtherProvider';

export type ProviderType = "fal.ai" | "runpod" | "other_provider"; // Add more as needed

export class ImageEnhancementFactory {
  static determineProviderType(type?: ProviderType): ProviderType {
    return (type ||
      process.env.IMAGE_ENHANCEMENT_PROVIDER ||
      "fal.ai") as ProviderType;
  }

  static getProvider(type?: ProviderType): ImageEnhancementProvider {
    const providerType = ImageEnhancementFactory.determineProviderType(type);
    console.log(
      `ImageEnhancementFactory: Getting provider for type: ${providerType}`
    );

    switch (providerType) {
      case "fal.ai":
        return new FalAIProvider();
      case "runpod":
        return new RunpodComfyUIProvider();
      // case 'other_provider':
      //   return new OtherProvider();
      default:
        console.warn(
          `ImageEnhancementFactory: Unknown provider type "${providerType}". Defaulting to FalAIProvider.`
        );
        return new FalAIProvider(); // Default provider
    }
  }

  static getPollingProvider(type?: ProviderType): PollingProvider {
    const providerType = ImageEnhancementFactory.determineProviderType(type);
    console.log(
      `ImageEnhancementFactory: Getting polling provider for type: ${providerType}`
    );

    switch (providerType) {
      case "fal.ai":
        return new FalPollingProvider();
      case "runpod":
        return new RunpodPollingProvider();
      // case 'other_provider':
      //   return new OtherPollingProvider();
      default:
        console.warn(
          `ImageEnhancementFactory: Unknown polling provider type "${providerType}". Defaulting to FalPollingProvider.`
        );
        return new FalPollingProvider(); // Default provider
    }
  }
}
