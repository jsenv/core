import { startCompileServer } from "../startCompileServer/startCompileServer.js"
import { startNodeClient } from "./startNodeClient.js"
import path from "path"

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then((server) => {
  const cleanAll = true

  return startNodeClient({ server }).then((nodeClient) => {
    nodeClient
      .execute({
        file: `${server.cacheURL}src/__test__/file.js`,
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
