# ---
# deploy: true
# cmd: ["modal", "serve", "06_gpu_and_ml/comfyui/comfyapp.py"]
# ---

# # Run Flux on ComfyUI as an API

# In this example, we show you how to turn a [ComfyUI](https://github.com/comfyanonymous/ComfyUI) workflow into a scalable API endpoint.

# ## Quickstart

# To run this simple text-to-image [Flux Schnell workflow](https://github.com/modal-labs/modal-examples/blob/main/06_gpu_and_ml/comfyui/workflow_api.json) as an API:

# 1. Deploy ComfyUI behind a web endpoint:

# ```bash
# modal deploy 06_gpu_and_ml/comfyui/comfyapp.py
# ```

# 2. In another terminal, run inference:

# ```bash
# python 06_gpu_and_ml/comfyui/comfyclient.py --modal-workspace $(modal profile current) --prompt "Surreal dreamscape with floating islands, upside-down waterfalls, and impossible geometric structures, all bathed in a soft, ethereal light"
# ```

# ![example comfyui image](./flux_gen_image.jpeg)

# The first inference will take ~1m since the container needs to launch the ComfyUI server and load Flux into memory. Successive calls on a warm container should take a few seconds.

# ## Installing ComfyUI

# We use [comfy-cli](https://github.com/Comfy-Org/comfy-cli) to install ComfyUI and its dependencies.

import json
import subprocess
import uuid
import os 
import base64 
from pathlib import Path
from typing import Dict, List, Tuple
import random

import modal

image = ( 
    modal.Image.debian_slim( 
        python_version="3.11"
    )
    .apt_install("git")  # install git to clone ComfyUI
    .pip_install("fastapi[standard]==0.115.4")  # install web dependencies
    .pip_install("comfy-cli==1.3.8")  # install comfy-cli
    .run_commands(  # use comfy-cli to install ComfyUI and its dependencies
        "comfy --skip-prompt install --fast-deps --nvidia --version 0.3.10"
    )
)

# ## Downloading custom nodes

# We'll also use `comfy-cli` to download custom nodes, in this case the popular [WAS Node Suite](https://github.com/WASasquatch/was-node-suite-comfyui).

# Use the [ComfyUI Registry](https://registry.comfy.org/) to find the specific custom node name to use with this command.

image = (
    image.run_commands(
        "comfy node install --fast-deps was-node-suite-comfyui@1.0.2"
    )
    .run_commands(
        "comfy node install --fast-deps comfyui_essentials@1.1.0"
    )
    .run_commands(
        "comfy node install --fast-deps rgthree-comfy@1.0.0"
    )
    .run_commands(
        "comfy node install --fast-deps x-flux-comfyui@1.0.0"
    )
    .run_commands(
        "comfy node install --fast-deps comfyui-easy-use@1.2.9",
    )
    # Add .run_commands(...) calls for any other custom nodes you want to download
)

# We'll also add our own custom node that patches core ComfyUI so that we can use Modal's [memory snapshot](https://modal.com/docs/guide/memory-snapshot) feature to speed up cold starts (more on that on [running as an API](https://modal.com/docs/examples/comfyapp#running-comfyui-as-an-api)).
image = image.add_local_dir(
    local_path=Path(__file__).parent / "memory_snapshot_helper",
    remote_path="/root/comfy/ComfyUI/custom_nodes/memory_snapshot_helper",
    copy=True,
)
# See [this post](https://modal.com/blog/comfyui-custom-nodes) for more examples
# on how to install popular custom nodes like ComfyUI Impact Pack and ComfyUI IPAdapter Plus.

# ## Downloading models

# `comfy-cli` also supports downloading models, but we've found it's faster to use
# [`hf_hub_download`](https://huggingface.co/docs/huggingface_hub/en/guides/download#download-a-single-file)
# directly by:

# 1. Enabling [faster downloads](https://huggingface.co/docs/huggingface_hub/en/guides/download#faster-downloads)
# 2. Mounting the cache directory to a [Volume](https://modal.com/docs/guide/volumes)

# By persisting the cache to a Volume, you avoid re-downloading the models every time you rebuild your image.


# --- Helper function to download models ---
def download_model(
    download_details: Tuple[str, str, str], cache_dir: str, token: str
):
    """Downloads a model using hf_hub_download and creates a symlink."""
    from huggingface_hub import hf_hub_download

    repo_id, filename, dest_subfolder = download_details
    custom_filename = None
    if "|" in filename:
        filename, custom_filename = filename.split("|")

    # Determine the actual filename on disk (could be custom or from URL)
    dl_filename = custom_filename if custom_filename else filename.split("/")[-1]
    # Construct the destination path within ComfyUI models directory
    dest_path = f"/root/comfy/ComfyUI/models/{dest_subfolder}/{dl_filename}"
    # Construct the symlink source path within the cache
    symlink_src_path = Path(cache_dir) / "hf" / repo_id / filename # Simplified path assumption

    # Check if symlink already exists
    if Path(dest_path).exists():
        print(f"Symlink already exists for {dl_filename}, skipping download.")
        return

    print(f"Downloading {repo_id}/{filename}...")
    try:
        downloaded_path_obj = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=Path(cache_dir) / "hf" / repo_id, # Download to specific repo folder
            local_dir_use_symlinks=False, # Avoid symlinks within cache
            token=token,
            cache_dir=cache_dir, # Use the main cache dir for HF logic
        )
        downloaded_path = str(downloaded_path_obj) # Convert Path object to string
        print(f"Downloaded to: {downloaded_path}")

        # Ensure the destination directory exists
        Path(dest_path).parent.mkdir(parents=True, exist_ok=True)

        # Create the symlink - Use the actual downloaded path as source
        print(f"Creating symlink from {downloaded_path} to {dest_path}")
        subprocess.run(
            f"ln -sfn {downloaded_path} {dest_path}", # Use -f to overwrite if broken, -n to treat symlink dest as normal file if it is a symlink to dir
            shell=True,
            check=True,
        )
        print(f"Symlink created for {dl_filename}")
    except Exception as e:
        print(f"Error downloading/linking {repo_id}/{filename}: {e}")


# --- Model definitions ---
# Tuple format: (repo_id, filename_or_filename|custom_name, destination_subfolder)
MODELS_TO_DOWNLOAD: List[Tuple[str, str, str]] = [
    # UNET_MODELS
    #("black-forest-labs/FLUX.1-dev", "flux1-dev.safetensors", "unet"),
    #("city96/FLUX.1-dev-gguf", "flux1-dev-Q8_0.gguf", "unet"),
    #("black-forest-labs/FLUX.1-Fill-dev", "flux1-fill-dev.safetensors", "unet"),
    # LORA_MODELS
    ("SebastianBodza/Flux_Aquarell_Watercolor_v2", "lora.safetensors|Flux_Aquarell_Watercolor_v2.safetensors", "loras"),
    ("XLabs-AI/flux-RealismLora", "lora.safetensors|XLabs-AI-flux-RealismLora.safetensors", "loras"),
    ("comfyanonymous/flux_RealismLora_converted_comfyui", "flux_realism_lora.safetensors", "loras"),
    ("XLabs-AI/flux-lora-collection", "anime_lora_comfy_converted.safetensors", "loras"),
    ("XLabs-AI/flux-lora-collection", "art_lora_comfy_converted.safetensors", "loras"),
    ("XLabs-AI/flux-lora-collection", "disney_lora_comfy_converted.safetensors", "loras"),
    ("XLabs-AI/flux-lora-collection", "mjv6_lora_comfy_converted.safetensors", "loras"),
    ("XLabs-AI/flux-lora-collection", "realism_lora_comfy_converted.safetensors", "loras"),
    ("XLabs-AI/flux-lora-collection", "scenery_lora_comfy_converted.safetensors", "loras"),
    ("enhanceaiteam/Flux-Uncensored-V2", "lora.safetensors|strangerzonehf-Flux-Super-Realism-LoRA.safetensors", "loras"), # Note: filename mismatch in original script? Using provided name.
    ("alvdansen/frosting_lane_flux", "flux_dev_frostinglane_araminta_k.safetensors", "loras"),
    ("Shakker-Labs/FLUX.1-dev-LoRA-Logo-Design", "FLUX-dev-lora-Logo-Design.safetensors", "loras"),
    ("strangerzonehf/Flux-Super-Realism-LoRA", "super-realism.safetensors", "loras"),
    ("strangerzonehf/Flux-Animeo-v1-LoRA", "Animeo.safetensors|strangerzonehf-Flux-Animeo-v1-LoRA.safetensors", "loras"),
    ("brushpenbob/flux-midjourney-anime", "FLUX_MidJourney_Anime.safetensors|brushpenbob-FLUX_MidJourney_Anime.safetensors", "loras"),
    ("prithivMLmods/Canopus-LoRA-Flux-Anime", "Canopus-Anime-Character-Art-FluxDev-LoRA.safetensors|Canopus-Anime-Character-Art-FluxDev-LoRA.safetensors", "loras"),
    ("aleksa-codes/flux-ghibsky-illustration", "lora.safetensors|aleksa-codes-flux-ghibsky-illustration.safetensors", "loras"),
    # VAE_MODELS
    #("black-forest-labs/FLUX.1-dev", "vae/diffusion_pytorch_model.safetensors", "vae"),
    #("black-forest-labs/FLUX.1-dev", "ae.safetensors", "vae"),
    # CLIP_MODELS
    #("comfyanonymous/flux_text_encoders", "t5xxl_fp16.safetensors", "clip"),
    #("comfyanonymous/flux_text_encoders", "clip_l.safetensors", "clip"),
    #("openai/clip-vit-large-patch14", "model.safetensors|clip-vit-large-patch14.safetensors", "clip"),
    # CONTROLNET_MODELS
    #("Shakker-Labs/FLUX.1-dev-ControlNet-Union-Pro", "diffusion_pytorch_model.safetensors|FLUX-1-dev-ControlNet-Union-Pro.safetensors", "controlnet"),
    #("jasperai/Flux.1-dev-Controlnet-Upscaler", "diffusion_pytorch_model.safetensors|Flux-1-dev-Controlnet-Upscaler.safetensors", "controlnet"),
    #("XLabs-AI/flux-controlnet-depth-v3", "flux-depth-controlnet-v3.safetensors", "controlnet"),
    #("XLabs-AI/flux-controlnet-canny-v3", "flux-canny-controlnet-v3.safetensors", "controlnet"),
    #("alimama-creative/FLUX.1-dev-Controlnet-Inpainting-Beta", "diffusion_pytorch_model.safetensors|FLUX-1-dev-Controlnet-Inpainting-Beta.safetensors", "controlnet"),
    # Example Checkpoint (add others if needed)
    # ("runwayml/stable-diffusion-v1-5", "v1-5-pruned-emaonly.ckpt", "checkpoints"),
    # Example Flux Schnell model from original comfyapp.py (if still needed)
    #("Comfy-Org/flux1-schnell", "flux1-schnell-fp8.safetensors", "checkpoints"),
    ("Comfy-Org/flux1-dev", "flux1-dev-fp8.safetensors", "checkpoints"),
]

CACHE_DIR = "/cache"
vol = modal.Volume.from_name("hf-hub-cache", create_if_missing=True)

# --- Function to run during image build ---
def download_all_models_during_build():
    """Iterates through MODELS_TO_DOWNLOAD and calls download_model."""
    token = os.environ.get("HF_TOKEN")
    if not token:
        print("Warning: HF_TOKEN secret not found. Downloads might fail for private models.")
    # Ensure the main cache directory exists before downloads start
    Path(CACHE_DIR).mkdir(parents=True, exist_ok=True)
    for model_details in MODELS_TO_DOWNLOAD:
        download_model(model_details, CACHE_DIR, token)

# --- Updated Image Build ---
image = (
    # install huggingface_hub with hf_transfer support to speed up downloads
    image.pip_install("huggingface_hub[hf_transfer]==0.30.0")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    # Run the download function during the image build
    .run_function(
        download_all_models_during_build, # Pass the regular function here
        # Pass secrets and volumes to the build function
        secrets=[modal.Secret.from_name("huggingface-secret")],
        volumes={CACHE_DIR: vol},
        timeout=1800, # Increase timeout for potentially long downloads
    )
)

# Lastly, copy the ComfyUI workflow JSON to the container.
image = image.add_local_file(
    Path(__file__).parent / "workflow_api1.json", "/root/workflow_api1.json"
)


# ## Running ComfyUI interactively

# Spin up an interactive ComfyUI server by wrapping the `comfy launch` command in a Modal Function
# and serving it as a [web server](https://modal.com/docs/guide/webhooks#non-asgi-web-servers).

app = modal.App(name="example-comfyui", image=image)


@app.function(
    max_containers=1,  # limit interactive session to 1 container
    gpu="L4",  # good starter GPU for inference
    volumes={"/cache": vol},  # mounts our cached models
)
@modal.concurrent(
    max_inputs=10
)  # required for UI startup process which runs several API calls concurrently
@modal.web_server(8000, startup_timeout=60)
def ui():
    subprocess.Popen("comfy launch -- --listen 0.0.0.0 --port 8000", shell=True)


# At this point you can run `modal serve 06_gpu_and_ml/comfyui/comfyapp.py` and open the UI in your browser for the classic ComfyUI experience.

# Remember to **close your UI tab** when you are done developing.
# This will close the connection with the container serving ComfyUI and you will stop being charged.

# ## Running ComfyUI as an API

# To run a workflow as an API:

# 1. Stand up a "headless" ComfyUI server in the background when the app starts.

# 2. Define an `infer` method that takes in a workflow path and runs the workflow on the ComfyUI server.

# 3. Create a web handler `api` as a web endpoint, so that we can run our workflow as a service and accept inputs from clients.

# We group all these steps into a single Modal `cls` object, which we'll call `ComfyUI`.


@app.cls(
    scaledown_window=5,  # 5 seconds container keep alive after it processes an input
    gpu="L40S",
    #cpu=8,
    #memory=24576, # 24 GB
    volumes={"/cache": vol},
    enable_memory_snapshot=True,  # snapshot container state for faster cold starts
)
@modal.concurrent(max_inputs=5)  # run 5 inputs per container
class ComfyUI:
    port: int = 8000

    @modal.enter(snap=True)
    def launch_comfy_background(self):
        cmd = f"comfy launch --background -- --port {self.port}"
        subprocess.run(cmd, shell=True, check=True)

    @modal.enter(snap=False)
    def restore_snapshot(self):
        # initialize GPU for ComfyUI after snapshot restore
        # note: requires patching core ComfyUI, see the memory_snapshot_helper directory for more details
        import requests

        response = requests.post(f"http://127.0.0.1:{self.port}/cuda/set_device")
        if response.status_code != 200:
            print("Failed to set CUDA device")
        else:
            print("Successfully set CUDA device")

    @modal.method()
    def infer(self, workflow_path: str = "/root/workflow_api1.json"):
        # sometimes the ComfyUI server stops responding (we think because of memory leaks), so this makes sure it's still up
        self.poll_server_health()

        # runs the comfy run --workflow command as a subprocess
        cmd = f"comfy run --workflow {workflow_path} --wait --timeout 1200 --verbose"
        subprocess.run(cmd, shell=True, check=True)

        # completed workflows write output images to this directory
        output_dir = "/root/comfy/ComfyUI/output"

        # looks up the name of the output image file based on the workflow
        workflow = json.loads(Path(workflow_path).read_text())
        file_prefix = [
            node.get("inputs")
            for node in workflow.values()
            if node.get("class_type") == "SaveImage"
        ][0]["filename_prefix"]

        # returns the image as bytes
        for f in Path(output_dir).iterdir():
            if f.name.startswith(file_prefix):
                return f.read_bytes()

    @modal.fastapi_endpoint(method="POST")
    def api(self, item: Dict):
        from fastapi.responses import JSONResponse # Thay đổi import

        workflow_data = json.loads(
            (Path(__file__).parent / "workflow_api1.json").read_text()
        )

        # Define default values by reading from the loaded workflow
        defaults = {
            "prompt": workflow_data["6"]["inputs"]["text"],
            "seed": workflow_data["25"]["inputs"]["noise_seed"], # Node 25 for seed
            "numberOfImagesOutput": workflow_data["5"]["inputs"]["batch_size"],
            "width": workflow_data["5"]["inputs"]["width"],
            "height": workflow_data["5"]["inputs"]["height"],
            "loraName": workflow_data["60"]["inputs"]["lora_name"],
            "guidance": workflow_data["67"]["inputs"]["guidance"],
            "sampler_name": workflow_data["16"]["inputs"]["sampler_name"],
            "sgm_uniform": workflow_data["17"]["inputs"]["scheduler"], # Node 17 for scheduler
            "steps": workflow_data["17"]["inputs"]["steps"],
        }

        # Update workflow with values from the request, using defaults if not provided
        workflow_data["6"]["inputs"]["text"] = item.get("prompt", defaults["prompt"])
        workflow_data["25"]["inputs"]["noise_seed"] = item.get("seed", defaults["seed"]) # Update seed in node 25
        workflow_data["5"]["inputs"]["batch_size"] = item.get("numberOfImagesOutput", defaults["numberOfImagesOutput"])
        workflow_data["5"]["inputs"]["width"] = item.get("width", defaults["width"])
        workflow_data["5"]["inputs"]["height"] = item.get("height", defaults["height"])
        workflow_data["60"]["inputs"]["lora_name"] = item.get("loraName", defaults["loraName"])
        workflow_data["67"]["inputs"]["guidance"] = item.get("guidance", defaults["guidance"])
        workflow_data["16"]["inputs"]["sampler_name"] = item.get("sampler_name", defaults["sampler_name"])
        workflow_data["17"]["inputs"]["scheduler"] = item.get("sgm_uniform", defaults["sgm_uniform"]) # Update scheduler in node 17
        workflow_data["17"]["inputs"]["steps"] = item.get("steps", defaults["steps"])

        # give the output image a unique id per client request
        client_id = uuid.uuid4().hex
        workflow_data["9"]["inputs"]["filename_prefix"] = client_id

        # save this updated workflow to a new file
        new_workflow_file = f"{client_id}.json"
        # Ensure the directory for the new workflow file exists (writing to root in this case)
        Path(new_workflow_file).parent.mkdir(parents=True, exist_ok=True)
        json.dump(workflow_data, Path(new_workflow_file).open("w"))

        # run inference on the currently running container
        img_bytes = self.infer.local(new_workflow_file)

        # Mã hóa ảnh thành base64
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        # Tạo dữ liệu response
        response_data = {"output_url": img_base64}
        # Trả về JSON response
        return JSONResponse(content=response_data)

    def poll_server_health(self) -> Dict:
        import socket
        import urllib

        try:
            # check if the server is up (response should be immediate)
            req = urllib.request.Request(f"http://127.0.0.1:{self.port}/system_stats")
            urllib.request.urlopen(req, timeout=5)
            print("ComfyUI server is healthy")
        except (socket.timeout, urllib.error.URLError) as e:
            # if no response in 5 seconds, stop the container
            print(f"Server health check failed: {str(e)}")
            modal.experimental.stop_fetching_inputs()

            # all queued inputs will be marked "Failed", so you need to catch these errors in your client and then retry
            raise Exception("ComfyUI server is not healthy, stopping container")


# This serves the `workflow_api1.json` in this repo. When deploying your own workflows, make sure you select the "Export (API)" option in the ComfyUI menu:

# ![comfyui menu](./comfyui_menu.jpeg)

# ## More resources
# - [Alternative approach](https://modal.com/blog/comfyui-mem-snapshots) for deploying ComfyUI with memory snapshots
# - Run a ComfyUI workflow as a [Python script](https://modal.com/blog/comfyui-prototype-to-production)

# - When to use [A1111 vs ComfyUI](https://modal.com/blog/a1111-vs-comfyui)

# - Understand tradeoffs of parallel processing strategies when
# [scaling ComfyUI](https://modal.com/blog/scaling-comfyui)