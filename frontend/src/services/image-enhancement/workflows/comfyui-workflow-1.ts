/**
 * ComfyUI workflow for image enhancement
 * This workflow is used by the RunpodComfyUIProvider
 */

export const COMFYUI_WORKFLOW_1 = {
  input: {
    workflow: {
      "1": {
        inputs: {
          upscale_by: 2,
          seed: ["26", 3],
          steps: 30,
          cfg: 1,
          sampler_name: "euler",
          scheduler: "simple",
          denoise: 0.10000000000000002,
          mode_type: "Linear",
          tile_width: 512,
          tile_height: 512,
          mask_blur: 8,
          tile_padding: 32,
          seam_fix_mode: "None",
          seam_fix_denoise: 1,
          seam_fix_width: 64,
          seam_fix_mask_blur: 8,
          seam_fix_padding: 8,
          force_uniform_tiles: true,
          tiled_decode: false,
          image: ["55", 0],
          model: ["57", 0],
          positive: ["4", 0],
          negative: ["4", 0],
          vae: ["51", 0],
          upscale_model: ["7", 0],
        },
        class_type: "UltimateSDUpscale",
        _meta: {
          title: "Ultimate SD Upscale",
        },
      },
      "4": {
        inputs: {
          clip_l: "",
          t5xxl: "",
          guidance: 3.5,
          clip: ["50", 0],
        },
        class_type: "CLIPTextEncodeFlux",
        _meta: {
          title: "MANUAL PROMPT",
        },
      },
      "7": {
        inputs: {
          model_name: "4x_foolhardy_Remacri.pth",
        },
        class_type: "UpscaleModelLoader",
        _meta: {
          title: "Load Upscale Model",
        },
      },
      "26": {
        inputs: {
          seed: 523879142222960,
        },
        class_type: "Seed",
        _meta: {
          title: "Seed",
        },
      },
      "50": {
        inputs: {
          clip_name1: "clip_l.safetensors",
          clip_name2: "t5xxl_fp8_e4m3fn.safetensors",
          type: "flux",
          device: "default",
        },
        class_type: "DualCLIPLoader",
        _meta: {
          title: "DualCLIPLoader",
        },
      },
      "51": {
        inputs: {
          vae_name: "ae.safetensors",
        },
        class_type: "VAELoader",
        _meta: {
          title: "Load VAE",
        },
      },
      "55": {
        inputs: {
          image: "", // Will be replaced with base64 image
        },
        class_type: "ETN_LoadImageBase64",
        _meta: {
          title: "Load Image (Base64)",
        },
      },
      "56": {
        inputs: {
          filename_prefix: "ComfyUI",
          images: ["1", 0],
        },
        class_type: "SaveImage",
        _meta: {
          title: "Save Image",
        },
      },
      "57": {
        inputs: {
          unet_name: "flux1-dev.safetensors",
          weight_dtype: "fp8_e4m3fn",
        },
        class_type: "UNETLoader",
        _meta: {
          title: "Load Diffusion Model",
        },
      },
    },
  },
};
