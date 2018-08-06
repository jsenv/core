import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openNodeClient } from "./openNodeClient.js"

const rootLocation = path.resolve(__dirname, "../../../")
openCompileServer({
  url: "http://127.0.0.1:8765",
  rootLocation,
  sourceMap: "comment",
  sourceURL: false,
}).then((server) => {
  const cleanAll = false

  return openNodeClient({
    server,
    detached: false,
    rootLocation,
  }).then((nodeClient) => {
    nodeClient
      .execute({
        file: `${server.compileURL}src/__test__/file.js`,
        autoClean: cleanAll,
      })
      .then(
        (value) => {
          if (cleanAll) {
            server.close()
            nodeClient.close()
          }
          console.log("execution done with", value)
        },
        (reason) => {
          if (cleanAll) {
            server.close()
            nodeClient.close()
          }
          console.error("execution crashed with", reason)
        },
      )
  })
})
