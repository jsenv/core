// belong to core
export { startCompileServer } from "./src/compile-server/index.js"
export { launchAndExecute } from "./src/launchAndExecute/index.js"
export { readProjectImportMap } from "./src/import-map/readProjectImportMap.js"

// could be moved to jsenv/jsenv-execution
export { execute } from "./src/execution/execute.js"

// could be moved to jsenv/jsenv-testing
export { test } from "./src/testing/test.js"

// could be moved inside jsenv/jsenv-testing
export { cover } from "./src/coverage/cover.js"
export {
  DEFAULT_COVER_DESCRIPTION as jsenvCoverDescription,
} from "./src/coverage/cover-constant.js"
export { createInstrumentPlugin } from "./src/coverage/createInstrumentPlugin.js"

// could be moved to jsenv/jsenv-bundling
export {
  serveBrowserGlobalBundle,
  generateNodeCommonJsBundle,
  generateGlobalBundle,
  generateCommonJsBundle,
  generateSystemJsBundle,
} from "./src/bundling/index.js"

// should be moved to jsenv/jsenv-exploring-server
export { startExploringServer } from "./src/exploring-server/index.js"
