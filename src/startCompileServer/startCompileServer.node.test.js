import path from "path"
import "./global-fetch.js"
import { startCompileServer } from "./startCompileServer.js"
import { fork } from "child_process"

startCompileServer({
  rootLocation: `${path.resolve(__dirname, "../../../")}`,
}).then(({ url, close }) => {
  const file = path.resolve(__dirname, "./index.js")
  const child = fork(file, {
    execArgv: [
      // allow vscode to debug else you got port already used
      "--inspect-brk=9225",
    ],
    env: {
      location: url.href,
      entry: "./src/__test__/test.js",
    },
    silent: true,
  })
  child.on("close", () => {
    close()
  })
})
