import "./global-fetch.js"
import { fork } from "child_process"
import { createSignal } from "@dmail/signal"
import path from "path"
import { URL } from "url"

export const createExecuteFileOnNode = ({ serverURL }) => {
  const indexFile = path.resolve(__dirname, "./index.js")

  const execute = (file) => {
    const ended = createSignal()
    const crashed = createSignal()
    const entry = String(new URL(file, serverURL))

    const child = fork(indexFile, {
      execArgv: [
        // allow vscode to debug else you got port already used
        "--inspect-brk=9225",
      ],
      env: {
        entry,
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
