import path from "path"
import "./global-fetch.js"
import { startCompileServer } from "./startCompileServer.js"
import { fork } from "child_process"
import { createSignal } from "@dmail/signal"

const createExecuteFileOnNode = ({ serverURL }) => {
  const indexFile = path.resolve(__dirname, "./index.js")

  const execute = (file) => {
    const ended = createSignal()
    const crashed = createSignal()

    const child = fork(indexFile, {
      execArgv: [
        // allow vscode to debug else you got port already used
        "--inspect-brk=9225",
      ],
      env: {
        location: String(serverURL),
        entry: file,
      },
      silent: true,
    })

    child.on("close", (code) => {
      if (code === 0) {
        ended.emit()
      } else {
        crashed.emit()
      }
    })

    return { ended, crashed }
  }

  return { execute }
}

startCompileServer({ rootLocation: path.resolve(__dirname, "../../../") }).then(
  ({ url, close }) => {
    const { execute } = createExecuteFileOnNode({ serverURL: url })

    const execution = execute("./src/__test__/test.js")
    execution.ended.listen(close)
  },
)
