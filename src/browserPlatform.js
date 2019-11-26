import { createBrowserPlatform } from "./internal/platform/createBrowserPlatform/createBrowserPlatform.js"

window.__browserPlatform__ = {
  create: createBrowserPlatform,
}
