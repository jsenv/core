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
