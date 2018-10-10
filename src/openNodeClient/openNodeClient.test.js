import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openNodeClient } from "./openNodeClient.js"

const root = path.resolve(__dirname, "../../../")

openCompileServer({
  root,
  url: "http://127.0.0.1:8765",
  sourceMap: "comment",
  sourceURL: false,
  instrument: false,
}).then((server) => {
  return openNodeClient({
    compileURL: server.compileURL,
    remoteRoot: "http://127.0.0.1:8765",
    localRoot: root,
    detached: true,
  }).then((nodeClient) => {
    nodeClient
      .execute({
        file: `src/__test__/file.js`,
      })
      .then(({ promise, close }) => {
        promise.then(
          (value) => {
            close()
            server.close()
            console.log("execution done with", value)
          },
          (reason) => {
            console.error("execution crashed with", reason)
          },
        )
      })
  })
})
