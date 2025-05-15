"""
Modal ComfyUI API - Serverless API for ComfyUI workflows

This module implements a serverless API for ComfyUI using Modal.com.
It allows users to submit ComfyUI workflows dynamically and retrieve results via polling.
"""

import json
import subprocess
import uuid
import os
import base64
import logging
import traceback
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import modal

# Define the Modal Image
image = (
    modal.Image.debian_slim(
        python_version="3.11"
    )
    .apt_install("git")  # Install git to clone ComfyUI
    .pip_install("fastapi[standard]")  # Install web dependencies
    .pip_install("comfy-cli")  # Install comfy-cli
    .run_commands(
        "comfy --skip-prompt install --fast-deps --nvidia"  # Install ComfyUI and its dependencies
    )
)

# Install custom nodes via comfy-cli
image = (
    image.run_commands("comfy node install --fast-deps comfyui-custom-scripts")
    .run_commands("comfy node install --fast-deps comfyui-impact-pack")
    .run_commands("comfy node install --fast-deps rgthree-comfy")
    .run_commands("comfy node install --fast-deps was-node-suite-comfyui")
    .run_commands("comfy node install --fast-deps cg-use-everywhere")
    .run_commands("comfy node install --fast-deps comfyui-image-saver")
    .run_commands("comfy node install --fast-deps comfyui-tooling-nodes")
    .run_commands("comfy node install --fast-deps comfyui-supir")
)

# Install UltimateSDUpscale via git clone
image = image.run_commands(
    "mkdir -p /root/comfy/ComfyUI/custom_nodes && "
    "git clone https://github.com/ssitu/ComfyUI_UltimateSDUpscale --recursive "
    "/root/comfy/ComfyUI/custom_nodes/ComfyUI_UltimateSDUpscale"
)

# Setup volume for model caching
CACHE_DIR = "/cache"
vol = modal.Volume.from_name("comfyui-models-cache", create_if_missing=True)

# Define models to download
MODELS_TO_DOWNLOAD: List[Tuple[str, str, str]] = [
    # VAE models
    ("black-forest-labs/FLUX.1-dev", "ae.safetensors", "vae"),
    
    # Upscale models
    ("datasets/Kizi-Art/Upscale", "4x-UltraSharp.pth", "upscale_models"),
    ("FacehugmanIII/4x_foolhardy_Remacri", "4x_foolhardy_Remacri.pth", "upscale_models"),
    
    # UNET models
    ("black-forest-labs/FLUX.1-dev", "flux1-dev.safetensors", "unet"),
    
    # CLIP models
    ("comfyanonymous/flux_text_encoders", "t5xxl_fp8_e4m3fn.safetensors", "clip"),
    ("comfyanonymous/flux_text_encoders", "clip_l.safetensors", "clip"),
    
    # Checkpoints
    ("AiWise/Juggernaut-XL-V9-GE-RDPhoto2-Lightning_4S", "juggernautXL_v9Rdphoto2Lightning.safetensors", "checkpoints"),
    ("camenduru/SUPIR", "SUPIR-v0Q.ckpt", "checkpoints"),
]

# Helper function to download models
def download_model(
    download_details: Tuple[str, str, str], cache_dir: str, token: str
):
    """Downloads a model using hf_hub_download and creates a symlink."""
    from huggingface_hub import hf_hub_download

    repo_id, filename, dest_subfolder = download_details
    custom_filename = None
    if "|" in filename:
        filename, custom_filename = filename.split("|")

    # Determine the actual filename on disk
    dl_filename = custom_filename if custom_filename else filename.split("/")[-1]
    # Construct the destination path within ComfyUI models directory
    dest_path = f"/root/comfy/ComfyUI/models/{dest_subfolder}/{dl_filename}"
    # Construct the symlink source path within the cache
    symlink_src_path = Path(cache_dir) / "hf" / repo_id / filename

    # Check if symlink already exists
    if Path(dest_path).exists():
        print(f"Symlink already exists for {dl_filename}, skipping download.")
        return

    print(f"Downloading {repo_id}/{filename}...")
    try:
        downloaded_path_obj = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            local_dir=Path(cache_dir) / "hf" / repo_id,
            local_dir_use_symlinks=False,
            token=token,
            cache_dir=cache_dir,
        )
        downloaded_path = str(downloaded_path_obj)
        print(f"Downloaded to: {downloaded_path}")

        # Ensure the destination directory exists
        Path(dest_path).parent.mkdir(parents=True, exist_ok=True)

        # Create the symlink
        print(f"Creating symlink from {downloaded_path} to {dest_path}")
        subprocess.run(
            f"ln -sfn {downloaded_path} {dest_path}",
            shell=True,
            check=True,
        )
        print(f"Symlink created for {dl_filename}")
    except Exception as e:
        logger.error(f"Error downloading/linking {repo_id}/{filename}: {str(e)}")
        logger.debug(f"Detailed error: {traceback.format_exc()}")

# Function to download all models during build
def download_all_models_during_build():
    """Iterates through MODELS_TO_DOWNLOAD and calls download_model."""
    token = os.environ.get("HUGGINGFACE_ACCESS_TOKEN")
    if not token:
        logger.warning("HUGGINGFACE_ACCESS_TOKEN secret not found. Downloads might fail for private models.")
    
    # Ensure the main cache directory exists before downloads start
    try:
        Path(CACHE_DIR).mkdir(parents=True, exist_ok=True)
        logger.info(f"Cache directory created/verified at {CACHE_DIR}")
        
        for model_details in MODELS_TO_DOWNLOAD:
            try:
                download_model(model_details, CACHE_DIR, token)
            except Exception as e:
                logger.error(f"Failed to download model {model_details}: {str(e)}")
                logger.debug(f"Detailed error: {traceback.format_exc()}")
                # Continue with other models even if one fails
    except Exception as e:
        logger.error(f"Failed to create cache directory: {str(e)}")
        logger.debug(f"Detailed error: {traceback.format_exc()}")
        raise

# Update image to download models
image = (
    # Install huggingface_hub with hf_transfer support to speed up downloads
    image.pip_install("huggingface_hub[hf_transfer]")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    # Run the download function during the image build
    .run_function(
        download_all_models_during_build,
        # Pass secrets and volumes to the build function
        secrets=[modal.Secret.from_name("huggingface-secret")],
        volumes={CACHE_DIR: vol},
        timeout=1800,  # Increase timeout for potentially long downloads
    )
)

# Add memory snapshot helper for faster cold starts
image = image.add_local_dir(
    local_path=Path(__file__).parent / "memory_snapshot_helper",
    remote_path="/root/comfy/ComfyUI/custom_nodes/memory_snapshot_helper",
    copy=True,
)

# Define the Modal App
app = modal.App(name="comfyui-api", image=image)

# Define a class to handle ComfyUI operations
@app.cls(
    scaledown_window=5,  # 5 seconds container keep alive after it processes an input
    gpu="L4",  # Use L4 GPU for inference
    volumes={CACHE_DIR: vol},
    enable_memory_snapshot=True,  # Snapshot container state for faster cold starts
)
# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s - %(pathname)s:%(lineno)d'
)
logger = logging.getLogger("comfyui-api")

@modal.concurrent(max_inputs=5)  # Run 5 inputs per container
class ComfyUIAPI:
    port: int = 8000

    @modal.enter(snap=True)
    def launch_comfy_background(self):
        """Launch ComfyUI server in the background."""
        try:
            logger.info(f"Launching ComfyUI server on port {self.port}")
            cmd = f"comfy launch --background -- --port {self.port}"
            subprocess.run(cmd, shell=True, check=True)
            logger.info("ComfyUI server launched successfully")
        except subprocess.SubprocessError as e:
            logger.error(f"Failed to launch ComfyUI server: {str(e)}")
            logger.debug(f"Detailed error: {traceback.format_exc()}")
            raise RuntimeError(f"ComfyUI server launch failed: {str(e)}")

    @modal.enter(snap=False)
    def restore_snapshot(self):
        """Initialize GPU for ComfyUI after snapshot restore."""
        import requests
        
        try:
            logger.info("Initializing GPU after snapshot restore")
            response = requests.post(f"http://127.0.0.1:{self.port}/cuda/set_device")
            
            if response.status_code != 200:
                logger.error(f"Failed to set CUDA device: Status code {response.status_code}")
                logger.debug(f"Response content: {response.text}")
            else:
                logger.info("Successfully set CUDA device")
        except requests.RequestException as e:
            logger.error(f"Error initializing GPU: {str(e)}")
            logger.debug(f"Detailed error: {traceback.format_exc()}")
            # Don't raise here as we want to continue even if GPU init fails
            # The server health check will catch more serious issues

    def poll_server_health(self) -> Dict:
        """Check if the ComfyUI server is healthy."""
        import socket
        import urllib

        try:
            # Check if the server is up (response should be immediate)
            req = urllib.request.Request(f"http://127.0.0.1:{self.port}/system_stats")
            response = urllib.request.urlopen(req, timeout=5)
            response_data = response.read().decode('utf-8')
            logger.info("ComfyUI server is healthy")
            logger.debug(f"Health check response: {response_data}")
            return {"status": "healthy"}
        except (socket.timeout, urllib.error.URLError) as e:
            # If no response in 5 seconds, stop the container
            logger.error(f"Server health check failed: {str(e)}")
            logger.debug(f"Detailed error: {traceback.format_exc()}")
            modal.experimental.stop_fetching_inputs()

            # All queued inputs will be marked "Failed"
            raise RuntimeError(f"ComfyUI server is not healthy, stopping container: {str(e)}")

    @modal.method()
    def run_workflow(self, workflow_json: Dict) -> Dict:
        """Run a ComfyUI workflow and return the results."""
        # Generate a unique ID for this run
        run_id = str(uuid.uuid4())
        workflow_path = f"/tmp/{run_id}.json"
        logger.info(f"Starting workflow execution for run_id: {run_id}")
        
        try:
            # Validate workflow JSON
            if not isinstance(workflow_json, dict) or not workflow_json:
                error_msg = "Invalid workflow format: must be a non-empty JSON object"
                logger.error(f"Error for run_id {run_id}: {error_msg}")
                return {
                    "status": "FAILED",
                    "error": error_msg
                }
            
            # Check server health
            try:
                health_result = self.poll_server_health()
                logger.info(f"Server health check passed for run_id {run_id}: {health_result}")
            except Exception as e:
                error_msg = f"ComfyUI server is not healthy: {str(e)}"
                logger.error(f"Server health check failed for run_id {run_id}: {str(e)}")
                logger.debug(f"Detailed error: {traceback.format_exc()}")
                return {
                    "status": "FAILED",
                    "error": error_msg
                }

            # Save workflow to a temporary file
            try:
                with open(workflow_path, "w") as f:
                    json.dump(workflow_json, f)
                logger.info(f"Saved workflow to {workflow_path} for run_id {run_id}")
            except (IOError, OSError) as e:
                error_msg = f"Failed to save workflow to temporary file: {str(e)}"
                logger.error(f"Error for run_id {run_id}: {error_msg}")
                logger.debug(f"Detailed error: {traceback.format_exc()}")
                return {
                    "status": "FAILED",
                    "error": error_msg
                }

            # Run the workflow
            try:
                cmd = f"comfy run --workflow {workflow_path} --wait --timeout 1200 --verbose"
                logger.info(f"Executing command for run_id {run_id}: {cmd}")
                process = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
                logger.info(f"Workflow execution completed for run_id: {run_id}")
                logger.debug(f"Command output: {process.stdout}")
            except subprocess.CalledProcessError as e:
                error_msg = f"ComfyUI workflow execution failed with exit code {e.returncode}"
                logger.error(f"Error for run_id {run_id}: {error_msg}")
                logger.debug(f"Command output: {e.stdout}")
                logger.debug(f"Command error: {e.stderr}")
                logger.debug(f"Detailed error: {traceback.format_exc()}")
                return {
                    "status": "FAILED",
                    "error": error_msg,
                    "details": {
                        "stdout": e.stdout,
                        "stderr": e.stderr,
                        "exit_code": e.returncode
                    }
                }
            except Exception as e:
                error_msg = f"Failed to execute ComfyUI workflow: {str(e)}"
                logger.error(f"Error for run_id {run_id}: {error_msg}")
                logger.debug(f"Detailed error: {traceback.format_exc()}")
                return {
                    "status": "FAILED",
                    "error": error_msg
                }

            # Get output images
            output_dir = "/root/comfy/ComfyUI/output"
            images = []

            # Look for any SaveImage nodes in the workflow
            try:
                save_image_nodes = [
                    node for node_id, node in workflow_json.items()
                    if node.get("class_type") == "SaveImage"
                ]

                # If there are no SaveImage nodes, return an error
                if not save_image_nodes:
                    error_msg = "No SaveImage nodes found in workflow"
                    logger.error(f"Error for run_id {run_id}: {error_msg}")
                    return {
                        "status": "FAILED",
                        "error": error_msg
                    }

                # Process each SaveImage node
                for node in save_image_nodes:
                    file_prefix = node.get("inputs", {}).get("filename_prefix", "")
                    logger.info(f"Looking for images with prefix: {file_prefix} for run_id {run_id}")
                    
                    # Check if output directory exists
                    if not Path(output_dir).exists():
                        error_msg = f"Output directory {output_dir} does not exist"
                        logger.error(f"Error for run_id {run_id}: {error_msg}")
                        return {
                            "status": "FAILED",
                            "error": error_msg
                        }
                    
                    # Find all files with this prefix
                    found_images = False
                    for f in Path(output_dir).iterdir():
                        if f.name.startswith(file_prefix):
                            found_images = True
                            logger.info(f"Found output image: {f.name} for run_id {run_id}")
                            try:
                                # Read the file and encode it as base64
                                image_data = base64.b64encode(f.read_bytes()).decode("utf-8")
                                images.append({
                                    "filename": f.name,
                                    "type": "base64",
                                    "data": image_data
                                })
                            except (IOError, OSError) as e:
                                logger.warning(f"Failed to read image file {f.name} for run_id {run_id}: {str(e)}")
                                logger.debug(f"Detailed error: {traceback.format_exc()}")
                                # Continue with other images
                    
                    if not found_images:
                        logger.warning(f"No images found with prefix {file_prefix} for run_id {run_id}")
            
                # Check if we found any images
                if not images:
                    error_msg = "No output images found after workflow execution"
                    logger.error(f"Error for run_id {run_id}: {error_msg}")
                    return {
                        "status": "FAILED",
                        "error": error_msg
                    }
            except Exception as e:
                error_msg = f"Error processing output images: {str(e)}"
                logger.error(f"Error for run_id {run_id}: {error_msg}")
                logger.debug(f"Detailed error: {traceback.format_exc()}")
                return {
                    "status": "FAILED",
                    "error": error_msg
                }

            # Return the results
            logger.info(f"Successfully completed workflow for run_id: {run_id} with {len(images)} images")
            return {
                "status": "COMPLETED",
                "output": {
                    "images": images
                }
            }
        except Exception as e:
            # Log the error for any uncaught exceptions
            error_msg = f"Unexpected error during workflow execution: {str(e)}"
            logger.error(f"Error for run_id {run_id}: {error_msg}")
            logger.debug(f"Detailed error: {traceback.format_exc()}")
            
            # Return error information
            return {
                "status": "FAILED",
                "error": error_msg
            }

    @modal.fastapi_endpoint(method="GET", path="/health")
    async def health_check(self) -> Dict:
        """API endpoint to check if the service is healthy."""
        logger.info("Health check requested")
        
        try:
            # Check ComfyUI server health
            comfy_health = self.poll_server_health()
            
            # Return detailed health information
            return {
                "status": "healthy",
                "message": "ComfyUI API is running",
                "comfyui_server": comfy_health,
                "timestamp": str(logging.Formatter().converter())
            }
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            logger.debug(f"Detailed error: {traceback.format_exc()}")
            
            # Still return a response, but indicate the service is unhealthy
            return {
                "status": "unhealthy",
                "message": f"ComfyUI API is running but ComfyUI server is unhealthy: {str(e)}",
                "timestamp": str(logging.Formatter().converter())
            }

    @modal.fastapi_endpoint(method="POST", path="/submit_workflow")
    async def submit_workflow(self, request_data: Dict) -> Dict:
        """API endpoint to submit a workflow."""
        from fastapi import HTTPException
        
        try:
            # Validate request
            if not request_data:
                logger.error("Empty request body")
                raise HTTPException(status_code=400, detail="Request body cannot be empty")
                
            if "workflow" not in request_data:
                logger.error("Missing workflow in request body")
                raise HTTPException(status_code=400, detail="Missing workflow in request body")
            
            # Validate workflow structure (basic check)
            workflow = request_data["workflow"]
            if not isinstance(workflow, dict) or not workflow:
                logger.error("Invalid workflow format: must be a non-empty JSON object")
                raise HTTPException(status_code=400, detail="Invalid workflow format: must be a non-empty JSON object")
            
            # Check for SaveImage nodes
            save_image_nodes = [
                node for node_id, node in workflow.items()
                if node.get("class_type") == "SaveImage"
            ]
            
            if not save_image_nodes:
                logger.warning("No SaveImage nodes found in workflow. Output may be empty.")
            
            # Spawn the workflow execution as a separate function call
            logger.info("Spawning asynchronous workflow execution")
            call = self.run_workflow.spawn(workflow)
            call_id = call.object_id
            logger.info(f"Generated call_id: {call_id} for new workflow submission")
            
            # Return the call ID immediately
            return {
                "id": call_id,
                "status": "RUNNING"
            }
        except HTTPException:
            # Re-raise FastAPI exceptions
            raise
        except Exception as e:
            # Log unexpected errors
            logger.error(f"Unexpected error in submit_workflow: {str(e)}")
            logger.debug(f"Detailed error: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

    @modal.fastapi_endpoint(method="GET", path="/status/{call_id}")
    async def get_status(self, call_id: str) -> Dict:
        """API endpoint to get the status of a job."""
        from fastapi import HTTPException
        
        logger.info(f"Received status request for call_id: {call_id}")
        
        if not call_id or not isinstance(call_id, str):
            logger.error(f"Invalid call_id format: {call_id}")
            raise HTTPException(status_code=400, detail="Invalid call_id format")
        
        try:
            # Create a FunctionCall object from the call_id
            try:
                function_call = modal.functions.FunctionCall.from_id(call_id)
            except ValueError as e:
                logger.error(f"Invalid call_id format: {call_id}, error: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Invalid call_id format: {str(e)}")
            except Exception as e:
                logger.error(f"Error creating FunctionCall from call_id {call_id}: {str(e)}")
                logger.debug(f"Detailed error: {traceback.format_exc()}")
                raise HTTPException(status_code=404, detail=f"Call ID not found or invalid: {str(e)}")
            
            # Try to get the result with a timeout of 0 (non-blocking)
            try:
                result = function_call.get(timeout=0)
                # If we get here, the function has completed
                logger.info(f"Function completed for call_id: {call_id}")
                
                # Add the call_id to the result
                result["id"] = call_id
                
                # Log error details if status is FAILED
                if result.get("status") == "FAILED":
                    logger.error(f"Workflow execution failed for call_id {call_id}: {result.get('error', 'Unknown error')}")
                
                return result
            except TimeoutError:
                # Function is still running
                logger.info(f"Function still running for call_id: {call_id}")
                return {
                    "id": call_id,
                    "status": "RUNNING"
                }
            except modal.exception.ExecutionError as e:
                # Function execution failed with an exception
                logger.error(f"Function execution failed for call_id {call_id}: {str(e)}")
                logger.debug(f"Detailed error: {traceback.format_exc()}")
                return {
                    "id": call_id,
                    "status": "FAILED",
                    "error": f"Execution error: {str(e)}"
                }
        except HTTPException:
            # Re-raise FastAPI exceptions
            raise
        except Exception as e:
            # Error retrieving the function call (e.g., invalid call_id)
            logger.error(f"Error retrieving function call for call_id {call_id}: {str(e)}")
            logger.debug(f"Detailed error: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")