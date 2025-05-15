# Modal ComfyUI API

A serverless API for ComfyUI workflows built on Modal.com. This API allows you to submit ComfyUI workflows dynamically and retrieve results via a polling mechanism.

## Table of Contents

- [API Usage](#api-usage)
  - [Submit Workflow Endpoint](#submit-workflow-endpoint)
  - [Status Endpoint](#status-endpoint)
- [Deployment](#deployment)
  - [Prerequisites](#prerequisites)
  - [Deployment Steps](#deployment-steps)
  - [Required Secrets](#required-secrets)
- [Environment Setup](#environment-setup)
  - [Pre-installed Custom Nodes](#pre-installed-custom-nodes)
  - [Pre-loaded Models](#pre-loaded-models)
- [Troubleshooting](#troubleshooting)
- [Example Usage](#example-usage)
  - [Submit Workflow Example](#submit-workflow-example)
  - [Poll Status Example](#poll-status-example)
- [References](#references)

## API Usage

### Submit Workflow Endpoint

This endpoint accepts a ComfyUI workflow in JSON format and starts processing it asynchronously.

- **Method**: `POST`
- **URL Path**: `/submit_workflow`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization`: Modal handles authentication by default
- **Request Body**:
  ```json
  {
    "workflow": {
      // Full ComfyUI workflow JSON
    }
  }
  ```
- **Success Response (202 Accepted)**:
  ```json
  {
    "id": "generated-call-id-123",
    "status": "RUNNING"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid workflow format or missing required fields
    ```json
    {
      "detail": "Invalid workflow format: must be a non-empty JSON object"
    }
    ```
  - `500 Internal Server Error`: Server-side error during workflow submission
    ```json
    {
      "detail": "Internal server error: [error details]"
    }
    ```

**Important Notes**:

- The workflow JSON must include at least one `SaveImage` node to capture the output.
- The API immediately returns a `call_id` that you can use to poll for results.

### Status Endpoint

This endpoint allows you to check the status of a submitted workflow and retrieve results when processing is complete.

- **Method**: `GET`
- **URL Path**: `/status`
- **Query Parameters**:
  - `call_id`: The unique ID returned by the submission endpoint
- **Headers**:
  - `Authorization`: Modal handles authentication by default
- **Success Responses**:
  - **Job Running (202 Accepted)**:
    ```json
    {
      "id": "generated-call-id-123",
      "status": "RUNNING"
    }
    ```
  - **Job Completed (200 OK)**:
    ```json
    {
      "id": "generated-call-id-123",
      "status": "COMPLETED",
      "output": {
        "images": [
          {
            "filename": "ComfyUI_00001_.png",
            "type": "base64",
            "data": "iVBORw0KGgoAAAANSUhEUg..."
          }
          // Potentially more images
        ]
      }
    }
    ```
  - **Job Failed (200 OK)**:
    ```json
    {
      "id": "generated-call-id-123",
      "status": "FAILED",
      "error": "Detailed error message from the ComfyUI execution or system."
    }
    ```
- **Error Responses**:
  - `400 Bad Request`: Invalid call_id format
    ```json
    {
      "detail": "Invalid call_id format"
    }
    ```
  - `404 Not Found`: Call ID not found or invalid
    ```json
    {
      "detail": "Call ID not found or invalid: [error details]"
    }
    ```
  - `500 Internal Server Error`: Server-side error during status retrieval
    ```json
    {
      "detail": "Internal server error: [error details]"
    }
    ```

## Deployment

### Prerequisites

- [Modal CLI](https://modal.com/docs/guide/cli-reference) installed and configured
- Modal account with appropriate permissions
- (Optional) Hugging Face account with access token for private models

### Deployment Steps

1. Clone this repository
2. Navigate to the project directory
3. Deploy the API to Modal:

```bash
modal deploy modal-comfyui/modal_comfyui_api.py
```

After deployment, Modal will provide a URL for your API endpoints.

### Required Secrets

The API uses the following Modal secrets:

- `huggingface-secret`: Contains the Hugging Face access token for downloading private models
  - Key: `HUGGINGFACE_ACCESS_TOKEN`
  - Value: Your Hugging Face access token

To create this secret in Modal:

```bash
modal secret create huggingface-secret HUGGINGFACE_ACCESS_TOKEN=your_token_here
```

## Environment Setup

The API runs in a containerized environment with ComfyUI and various dependencies pre-installed.

### Pre-installed Custom Nodes

The following custom nodes are pre-installed in the ComfyUI environment:

**Via `comfy node install`**:

- `comfyui-custom-scripts`
- `comfyui-impact-pack`
- `rgthree-comfy`
- `was-node-suite-comfyui`
- `cg-use-everywhere`
- `comfyui-image-saver`
- `comfyui-tooling-nodes`
- `comfyui-supir`

**Via `git clone`**:

- `ComfyUI_UltimateSDUpscale`: For high-quality image upscaling

### Pre-loaded Models

The following models are pre-downloaded and available in the environment:

**VAE Models**:

- `ae.safetensors` (from black-forest-labs/FLUX.1-dev)

**Upscale Models**:

- `4x-UltraSharp.pth` (from datasets/Kizi-Art/Upscale)
- `4x_foolhardy_Remacri.pth` (from FacehugmanIII/4x_foolhardy_Remacri)

**UNET Models**:

- `flux1-dev.safetensors` (from black-forest-labs/FLUX.1-dev)

**CLIP Models**:

- `t5xxl_fp8_e4m3fn.safetensors` (from comfyanonymous/flux_text_encoders)
- `clip_l.safetensors` (from comfyanonymous/flux_text_encoders)

**Checkpoints**:

- `juggernautXL_v9Rdphoto2Lightning.safetensors` (from AiWise/Juggernaut-XL-V9-GE-RDPhoto2-Lightning_4S)
- `SUPIR-v0Q.ckpt` (from camenduru/SUPIR)

## Troubleshooting

### Common Issues

1. **Workflow Submission Fails**:

   - Ensure your workflow JSON is valid and properly formatted
   - Check that your workflow includes at least one `SaveImage` node
   - Verify that all node references in your workflow are correct

2. **Model Loading Errors**:

   - If you're using custom models not pre-loaded in the environment, ensure they're publicly accessible or your Hugging Face token has access to them
   - Check the Modal logs for specific model loading errors

3. **Timeout Issues**:
   - Complex workflows may take longer to process. The system has a timeout of 1200 seconds (20 minutes)
   - Consider simplifying your workflow or breaking it into smaller parts

### Checking Logs

To view logs for debugging:

```bash
modal app logs comfyui-api
```

You can filter logs by function or endpoint:

```bash
modal app logs comfyui-api --function-name ComfyUIAPI.submit_workflow
```

## Example Usage

### Submit Workflow Example

Here's an example of submitting a workflow using `curl`:

```bash
curl -X POST "https://your-modal-app-url/submit_workflow" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "1": {
        "inputs": {
          "upscale_by": 2,
          "seed": ["26", 3],
          "steps": 30,
          "cfg": 1,
          "sampler_name": "euler",
          "scheduler": "simple",
          "denoise": 0.10000000000000002,
          "mode_type": "Linear",
          "tile_width": 512,
          "tile_height": 512,
          "mask_blur": 8,
          "tile_padding": 32,
          "seam_fix_mode": "None",
          "seam_fix_denoise": 1,
          "seam_fix_width": 64,
          "seam_fix_mask_blur": 8,
          "seam_fix_padding": 8,
          "force_uniform_tiles": true,
          "tiled_decode": false,
          "image": ["55", 0],
          "model": ["57", 0],
          "positive": ["4", 0],
          "negative": ["4", 0],
          "vae": ["51", 0],
          "upscale_model": ["7", 0]
        },
        "class_type": "UltimateSDUpscale",
        "_meta": {
          "title": "Ultimate SD Upscale"
        }
      },
      "4": {
        "inputs": {
          "clip_l": "",
          "t5xxl": "",
          "guidance": 3.5,
          "clip": ["50", 0]
        },
        "class_type": "CLIPTextEncodeFlux",
        "_meta": {
          "title": "MANUAL PROMPT"
        }
      },
      "7": {
        "inputs": {
          "model_name": "4x_foolhardy_Remacri.pth"
        },
        "class_type": "UpscaleModelLoader",
        "_meta": {
          "title": "Load Upscale Model"
        }
      },
      "26": {
        "inputs": {
          "seed": 523879142222960
        },
        "class_type": "Seed",
        "_meta": {
          "title": "Seed"
        }
      },
      "50": {
        "inputs": {
          "clip_name1": "clip_l.safetensors",
          "clip_name2": "t5xxl_fp8_e4m3fn.safetensors",
          "type": "flux",
          "device": "default"
        },
        "class_type": "DualCLIPLoader",
        "_meta": {
          "title": "DualCLIPLoader"
        }
      },
      "51": {
        "inputs": {
          "vae_name": "ae.safetensors"
        },
        "class_type": "VAELoader",
        "_meta": {
          "title": "Load VAE"
        }
      },
      "55": {
        "inputs": {
          "image": "YOUR_BASE64_ENCODED_IMAGE_HERE"
        },
        "class_type": "ETN_LoadImageBase64",
        "_meta": {
          "title": "Load Image (Base64)"
        }
      },
      "56": {
        "inputs": {
          "filename_prefix": "ComfyUI",
          "images": ["1", 0]
        },
        "class_type": "SaveImage",
        "_meta": {
          "title": "Save Image"
        }
      },
      "57": {
        "inputs": {
          "unet_name": "flux1-dev.safetensors",
          "weight_dtype": "fp8_e4m3fn"
        },
        "class_type": "UNETLoader",
        "_meta": {
          "title": "Load Diffusion Model"
        }
      }
    }
  }'
```

### Poll Status Example

Here's an example of polling for the status of a submitted workflow:

```bash
curl -X GET "https://your-modal-app-url/status?call_id=your-call-id-here"
```

## References

- [Modal Documentation](https://modal.com/docs/guide)
- [Modal Secrets Management](https://modal.com/docs/guide/secrets)
- [Modal Polling Solutions](https://modal.com/docs/guide/webhook-timeouts#polling-solutions)
- [ComfyUI GitHub Repository](https://github.com/comfyanonymous/ComfyUI)
- [ComfyUI Custom Nodes](https://github.com/comfyanonymous/ComfyUI/wiki/Custom-Nodes)
