import { jsenvCoreDirectoryUrl } from "../../jsenvCoreDirectoryUrl.js"

const sourceRelativeUrl =
  "./src/internal/browser-launcher/browser_system/jsenv-browser-system.js"
const buildRelativeUrl = "./jsenv_browser_system.js"
const buildUrl = new URL(
  "./dist/jsenv_browser_system.js",
  jsenvCoreDirectoryUrl,
)

export const browserSystemFileInfo = {
  sourceRelativeUrl,
  buildRelativeUrl,
  buildUrl,
}
