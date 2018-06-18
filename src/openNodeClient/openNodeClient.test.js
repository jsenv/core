import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openNodeClient } from "./openNodeClient.js"
import path from "path"

openCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then((server) => {
  const cleanAll = true

  return openNodeClient({ server }).then((nodeClient) => {
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
