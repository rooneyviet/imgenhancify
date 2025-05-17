MODELS_TO_DOWNLOAD: List[Tuple[str, str, str]] = [
    # VAE models
    ("black-forest-labs/FLUX.1-dev", "ae.safetensors", "vae"),
    
    # Upscale models
    ("Kizi-Art/Upscale", "4x-UltraSharp.pth", "upscale_models"),
    ("FacehugmanIII/4x_foolhardy_Remacri", "4x_foolhardy_Remacri.pth", "upscale_models"),
    ("Akumetsu971/SD_Anime_Futuristic_Armor", "4x_NMKD-Siax_200k.pth", "upscale_models"),
    # UNET models
    ("black-forest-labs/FLUX.1-dev", "flux1-dev.safetensors", "unet"),
    
    # CLIP models
    ("comfyanonymous/flux_text_encoders", "t5xxl_fp8_e4m3fn.safetensors", "clip"),
    ("comfyanonymous/flux_text_encoders", "clip_l.safetensors", "clip"),
    
    # Checkpoints
    ("AiWise/Juggernaut-XL-V9-GE-RDPhoto2-Lightning_4S", "juggernautXL_v9Rdphoto2Lightning.safetensors", "checkpoints"),
    ("camenduru/SUPIR", "SUPIR-v0Q.ckpt", "checkpoints"),
]