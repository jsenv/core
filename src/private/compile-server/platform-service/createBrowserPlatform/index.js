import { createBrowserPlatform } from "./create-browser-platform.js"

window.__browserPlatform__ = {
  create: createBrowserPlatform,
}
