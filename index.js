// belong to core
export { startCompileServer } from "./src/compile-server/index.js"
export { launchAndExecute } from "./src/launchAndExecute/index.js"
export { readProjectImportMap } from "./src/import-map/readProjectImportMap.js"
export { generateGroupMap, browserScoreMap, nodeVersionScoreMap } from "./src/group-map/index.js"
export { resolveCompileId } from "./src/platform/compile-id-resolution.js"
export { resolveBrowserGroup } from "./src/browser-group-resolver/index.js"
export { resolveNodeGroup } from "./src/node-group-resolver/index.js"
export {
  transpiler,
  findAsyncPluginNameInbabelPluginMap,
} from "./src/compiled-js-service/transpiler.js"
export {
  getOrGenerateCompiledFile,
} from "./src/compiled-file-service/get-or-generate-compiled-file.js"

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

// should be moved to jsenv/jsenv-exploring-server
export { startExploringServer } from "./src/exploring-server/index.js"
