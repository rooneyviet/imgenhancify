FROM runpod/worker-comfyui:5.0.0-base
 
WORKDIR /comfyui
# Install custom nodes using comfy-cli
RUN comfy node install comfyui-easy-use comfyui-florence2 comfyui-custom-scripts comfyui-impact-pack rgthree-comfy comfyui-florence2 was-node-suite-comfyui cg-use-everywhere comfyui-image-saver comfyui-tooling-nodes
 
RUN cd /comfyui/custom_nodes && \
    git clone https://github.com/ssitu/ComfyUI_UltimateSDUpscale --recursive