import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openChromiumClient } from "./openChromiumClient.js"

// System.import('http://127.0.0.1:9656/compiled/src/__test__/file.js')

// retester
openCompileServer({
  url: "http://127.0.0.1:9656",
  rootLocation: path.resolve(__dirname, "../../../"),
  instrument: false, // apparently it breaks sourcempa, to be tested
}).then((server) => {
  const cleanAll = false

  return openChromiumClient({
    server,
    compileURL: server.compileURL,
    headless: false,
  }).then((chromiumClient) => {
    chromiumClient
      .execute({
        file: `src/__test__/file.test.js`,
        autoClose: cleanAll,
        collectCoverage: true,
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
