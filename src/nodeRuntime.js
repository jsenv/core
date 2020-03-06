import { createNodeRuntime } from "./internal/runtime/createNodeRuntime/createNodeRuntime.js"

export const nodeRuntime = {
  create: createNodeRuntime,
}
