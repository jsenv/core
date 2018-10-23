// https://github.com/jsenv/core/blob/master/src/api/api.js
// https://github.com/ModuleLoader/system-register-loader/blob/master/src/system-register-loader.js

// pour le coverage
// https://github.com/jsenv/core/blob/master/more/test/playground/coverage/run.js
// https://github.com/jsenv/core/blob/master/more/to-externalize/module-cover/index.js

export { open as serverCompileOpen } from "./src/server-compile/index.js"
export { open as serverBrowserOpen } from "./src/server-browser/index.js"
export { jsCreateCompileHooks } from "./src/jsCreateCompileHooks/index.js"
export { jsCreateCompileService } from "./src/jsCreateCompileService/index.js"
export { createJSCompileServiceForProject } from "./src/createJSCompileServiceForProject.js"
