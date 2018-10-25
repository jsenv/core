// also have ot write a test for cancel
// to ensure it cancels what's hapenning and resolve when its done

import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { createExecuteOnChromium } from "./createExecuteOnChromium.js"

// System.import('http://127.0.0.1:9656/compiled/src/__test__/file.js')

const root = path.resolve(__dirname, "../../../")
const into = "build"

// retester
openCompileServer({
  root,
  into,
  protocol: "http",
  ip: "127.0.0.1",
  port: 9656,
  instrument: false, // apparently it breaks sourcempa, to be tested
}).then((server) => {
  const cleanAll = false

  const { execute } = createExecuteOnChromium({
    remoteRoot: server.origin,
    remoteCompileDestination: into,
    headless: false,
  })

  return execute({
    file: `src/__test__/file.test.js`,
    autoClose: cleanAll,
  }).then(({ promise, close }) => {
    promise.then(
      (value) => {
        if (cleanAll) {
          close()
          server.close()
        }
        console.log("execution done with", value)
      },
      (reason) => {
        if (cleanAll) {
          close()
          server.close()
        }
        console.error("execution error", reason)
      },
    )
  })
})
