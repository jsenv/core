import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openNodeClient } from "./openNodeClient.js"

openCompileServer({
  rootLocation: path.resolve(__dirname, "../../../"),
  sourceMap: "comment",
  sourceURL: true,
}).then((server) => {
  const cleanAll = true

  return openNodeClient({ server, detached: true }).then((nodeClient) => {
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
