// https://github.com/jsenv/core/blob/master/src/api/api.js
// https://github.com/ModuleLoader/system-register-loader/blob/master/src/system-register-loader.js

// pour le coverage
// https://github.com/jsenv/core/blob/master/more/test/playground/coverage/run.js
// https://github.com/jsenv/core/blob/master/more/to-externalize/module-cover/index.js

export { jsCreateCompileServiceForProject } from "./src/jsCreateCompileServiceForProject.js"

export { open as serverCompileOpen } from "./src/server-compile/index.js"
export { open as serverBrowserOpen } from "./src/server-browser/index.js"
export { executeOnNode } from "./src/createExecuteOnNode/executeOnNode.js"
export { createExecuteOnNode } from "./src/createExecuteOnNode/createExecuteOnNode.js"
export { createExecuteOnChromium } from "./src/createExecuteOnChromium/createExecuteOnChromium.js"

export { createCancel } from "./src/cancel/index.js"

export {
  testDescriptorToCoverageMapForProject,
} from "./src/coverageMap/testDescriptorToCoverageMapForProject.js"
