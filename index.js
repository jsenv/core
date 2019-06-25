// belong to core
export { startCompileServer } from "./src/compile-server/index.js"

// belong to core
export { launchAndExecute } from "./src/launchAndExecute/index.js"

// belong to core
export { execute } from "./src/execution/execute.js"

// belong to core
export { test } from "./src/testing/test.js"

// belong to core
export { cover } from "./src/coverage/cover.js"
export {
  DEFAULT_COVER_DESCRIPTION as jsenvCoverDescription,
} from "./src/coverage/cover-constant.js"

// belong to core (let's keep it in core because way easier to manage)
export {
  generateGlobalBundle,
  generateCommonJsBundle,
  generateSystemJsBundle,
} from "./src/bundling/index.js"

// may be moved to jsenv/browsing-server
export { startExploringServer } from "./src/exploring-server/index.js"

// must be moved later to jsenv/chromium-launcher
export { launchChromium } from "./src/chromium-launcher/index.js"

// must be moved later to jsenv/node-launcher
export { launchNode } from "./src/node-launcher/index.js"
