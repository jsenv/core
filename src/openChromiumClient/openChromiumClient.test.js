import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openChromiumClient } from "./openChromiumClient.js"

// System.import('http://127.0.0.1:9656/compiled/src/__test__/file.js')

const root = path.resolve(__dirname, "../../../")
const into = "build"

// retester
openCompileServer({
  root,
  into,
  url: "http://127.0.0.1:9656",
  instrument: false, // apparently it breaks sourcempa, to be tested
}).then((server) => {
  const cleanAll = false

  return openChromiumClient({
    remoteRoot: server.url.toString().slice(0, -1),
    remoteCompileDestination: into,
    headless: false,
  }).then((chromiumClient) => {
    chromiumClient
      .execute({
        file: `src/__test__/file.test.js`,
        autoClose: cleanAll,
      })
      .then(({ promise, close }) => {
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
})
