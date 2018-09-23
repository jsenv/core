// https://github.com/jsenv/core/blob/master/src/api/api.js
// https://github.com/ModuleLoader/system-register-loader/blob/master/src/system-register-loader.js

// pour le coverage
// https://github.com/jsenv/core/blob/master/more/test/playground/coverage/run.js
// https://github.com/jsenv/core/blob/master/more/to-externalize/module-cover/index.js

import { openChromiumClient } from "./src/openChromiumClient/openChromiumClient.js"
import { openCompileServer } from "./src/openCompileServer/openCompileServer.js"
import { openNodeClient } from "./src/openNodeClient/openNodeClient.js"
import { openBrowserServer } from "./src/openBrowserServer/openBrowserServer.js"
import { testProject, createCoverageFromTestReport } from "./src/coverFolder/coverFolder.js"
import { run } from "./src/run/run.js"

export { testProject, createCoverageFromTestReport }
export { openCompileServer }
export { openBrowserServer }
export { openChromiumClient }
export { run }

export const createModuleRunner = (params) => {
  // if there is already a compileServer running for that location
  // they will work as long as the code which created them run in the same terminal
  // if two terminal spawns a server trying to compile a given project they will concurrently
  // read/write filesystem.
  // To fix that we could:
  // - update createLock.js so that, somehow, it can lock calls from different terminals
  // - save somewhere the port used for that specific project and reuse when existing
  // save used port is the easiest solution but we'll ignore this issue for now
  // and assume noone will try to open two server for the same location

  return openCompileServer(params).then((server) => {
    const runInsideNode = ({ file, ...rest }) => {
      return openNodeClient({ server }).then((nodeClient) => {
        // we should return a way to close?
        return nodeClient.execute({
          file,
          ...rest,
        })
      })
    }

    const runInsideChromium = ({ file, headless = true, cover = false }) => {
      return openChromiumClient({
        compileURL: server.compileURL,
        headless,
      }).then((chromiumClient) => {
        return chromiumClient
          .execute({
            file,
            collectCoverage: cover,
          })
          .then(({ promise }) => promise)
      })
    }

    return { runInsideNode, runInsideChromium }
  })
}
