import { startCompileServer } from "../startCompileServer/startCompileServer.js"
import path from "path"
import { startChromiumClient } from "./startChromiumClient.js"

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then((server) => {
  const cleanAll = true

  return startChromiumClient({ server, headless: true }).then((chromiumClient) => {
    chromiumClient
      .execute({
        file: `${server.cacheURL}src/__test__/file.test.js`,
        autoClean: cleanAll,
      })
      .then(
        (value) => {
          if (cleanAll) {
            chromiumClient.close()
            server.close()
          }
          console.log("execution done with", value)
        },
        (error) => {
          if (cleanAll) {
            chromiumClient.close()
            server.close()
          }
          console.error("execution error", error)
        },
      )
  })
})
