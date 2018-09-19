import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openNodeClient } from "./openNodeClient.js"

const rootLocation = path.resolve(__dirname, "../../../")

openCompileServer({
  url: "http://127.0.0.1:8765",
  rootLocation,
  sourceMap: "comment",
  sourceURL: false,
  instrument: true,
}).then((server) => {
  const cleanAll = false

  return openNodeClient({
    compileURL: server.compileURL,
    remoteRoot: "http://127.0.0.1:8765",
    localRoot: rootLocation,
    detached: false, // true,
  }).then((nodeClient) => {
    nodeClient
      .execute({
        file: `src/__test__/file.js`,
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
            console.error("execution crashed with", reason)
          },
        )
      })
  })
})
