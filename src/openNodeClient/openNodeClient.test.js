import path from "path"
import { openCompileServer } from "../openCompileServer/openCompileServer.js"
import { openNodeClient } from "./openNodeClient.js"

const root = path.resolve(__dirname, "../../../")
const into = "build"
const watch = true

openCompileServer({
  root,
  into,
  url: "http://127.0.0.1:8760",
  sourceMap: "comment",
  sourceURL: false,
  instrument: false,
  watch,
  watchPredicate: () => true,
}).then((server) => {
  return openNodeClient({
    localRoot: root,
    remoteRoot: server.url.toString().slice(0, -1),
    remoteCompileDestination: into,
    detached: true,
  }).then((nodeClient) => {
    nodeClient
      .execute({
        file: `src/__test__/file.js`,
        hotreload: watch,
      })
      .then(({ promise, cancel }) => {
        promise.then(
          (value) => {
            if (watch === false) {
              cancel()
              server.close()
            }
            console.log("execution done with", value)
          },
          (reason) => {
            console.error("execution crashed with", reason)
          },
        )
      })
  })
})
