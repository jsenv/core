import { startCompileServer } from "../startCompileServer/startCompileServer.js"
import path from "path"
import { startChromiumClient } from "./startChromiumClient.js"

startCompileServer({
  url: "http://127.0.0.1:9656",
  rootLocation: path.resolve(__dirname, "../../../"),
}).then((server) => {
  const cleanAll = false

  return startChromiumClient({ server, headless: false }).then((chromiumClient) => {
    chromiumClient
      .execute({
        file: `${server.compileURL}src/__test__/file.test.js`,
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
