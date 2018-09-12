import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openChromiumClient } from "./openChromiumClient.js"

openCompileServer({
  url: "http://127.0.0.1:9656",
  rootLocation: path.resolve(__dirname, "../../../"),
  instrument: true,
}).then((server) => {
  const cleanAll = false

  return openChromiumClient({ server, headless: false }).then((chromiumClient) => {
    chromiumClient
      .execute({
        file: `src/__test__/file.test.js`,
        autoClean: cleanAll,
        collectCoverage: true,
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
