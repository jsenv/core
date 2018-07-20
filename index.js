// https://github.com/jsenv/core/blob/master/src/api/api.js
// https://github.com/ModuleLoader/system-register-loader/blob/master/src/system-register-loader.js

// pour le coverage
// https://github.com/jsenv/core/blob/master/more/test/playground/coverage/run.js
// https://github.com/jsenv/core/blob/master/more/to-externalize/module-cover/index.js

import { openCompileServer } from "./src/openCompileServer/openCompileServer.js"
import { openNodeClient } from "./src/openNodeClient/openNodeClient.js"

export const createExecuteOnNode = ({ location }) => {
  return openCompileServer({
    rootLocation: location,
  }).then((server) => {
    const execute = ({ file }) => {
      return openNodeClient({ server }).then((nodeClient) => {
        nodeClient.execute({
          file: `${server.compileURL}/${file}`,
        })
      })
    }

    return { execute }
  })
}
