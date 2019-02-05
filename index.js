// belong to core
export { startCompileServer } from "./src/server-compile/index.js"

// belong to core
export { launchAndExecute } from "./src/launchAndExecute/index.js"

// I would say methods (used inside dependent scripts) belong to core
export { execute, format, test, cover } from "./src/script/index.js"

// to be removed because used internally by test and cover
export { executePlan } from "./src/executePlan/index.js"

// to be removed because used internally only by cover
export { executionPlanResultToCoverageMap } from "./src/executionPlanResultToCoverageMap/index.js"

// may be moved to jsenv/browser-server
export { startBrowserServer } from "./src/server-browser/index.js"

// must be moved later to jsenv/chromium-launcher
export { launchChromium } from "./src/launchChromium/index.js"

// must be moved later to jsenv/node-launcher
export { launchNode } from "./src/launchNode/index.js"
