// https://github.com/jsenv/core/blob/master/src/api/api.js
// https://github.com/ModuleLoader/system-register-loader/blob/master/src/system-register-loader.js

// pour le coverage
// https://github.com/jsenv/core/blob/master/more/test/playground/coverage/run.js
// https://github.com/jsenv/core/blob/master/more/to-externalize/module-cover/index.js

import { openCompileServer } from "./src/openCompileServer/openCompileServer.js"
import { openNodeClient } from "./src/openNodeClient/openNodeClient.js"
import { openChromiumClient } from "./src/openChromiumClient/openChromiumClient.js"

export const createModuleRunner = ({ location }) => {
  // if there is already a compileServer running for that location
  // they will work as long as the code which created them run in the same terminal
  // if two terminal spawns a server trying to compile a given project they will concurrently
  // read/write filesystem.
  // To fix that we could:
  // - update enqueueCallByArgs so that, somehow, it can queue calls from different terminals
  // - save somewhere the port used for that specific project and reuse when existing
  // save used port is the easiest solution but we'll ignore this issue for now
  // and assume noone will try to open two server for the same location
  return openCompileServer({
    rootLocation: location,
  }).then((server) => {
    const runInsideNode = ({ file }) => {
      return openNodeClient({ server }).then((nodeClient) => {
        return nodeClient.execute({
          file: `${server.compileURL}/${file}`,
        })
      })
    }

    const runInsideChromium = ({ file, headless = true }) => {
      return openChromiumClient({
        server,
        headless,
      }).then((chromiumClient) => {
        return chromiumClient.execute({
          file: `${server.compileURL}/${file}`,
        })
      })
    }

    return { runInsideNode, runInsideChromium }
  })
}
