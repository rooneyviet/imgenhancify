/**
 * ComfyUI workflow for image enhancement
 * This workflow is used by the RunpodComfyUIProvider
 */

import { COMFYUI_WORKFLOW_2 } from "./comfyui-workflow-2";

/**
 * Create a workflow with the specified image and seed
 * @param imageBase64 Base64 encoded image
 * @param seed Random seed for the workflow
 * @returns Workflow with the image and seed set
 */
export function createWorkflow(imageBase64: string, seed: number): any {
  // Create a deep copy of the workflow to avoid modifying the original
  const workflow = JSON.parse(JSON.stringify(COMFYUI_WORKFLOW_2));

  // Set the dynamic parts
  workflow.input.workflow["97"].inputs.image = imageBase64;
  workflow.input.workflow["79"].inputs.seed = seed;

  return workflow;
}
