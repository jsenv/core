import { createBrowserRuntime } from "./internal/runtime/createBrowserRuntime/createBrowserRuntime.js"

window.__browserRuntime__ = {
  create: createBrowserRuntime,
}
