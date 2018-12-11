import { fork as forkChildProcess } from "child_process"
import { uneval } from "@dmail/uneval"
import { localRoot } from "../localRoot.js"
import { getCompileMapLocal } from "../getCompileMapLocal.js"
import { createChildExecArgv } from "./createChildExecArgv.js"

const nodeClientFile = `${localRoot}/dist/src/createExecuteOnNode/client.js`

const createClosedWithFailureCodeError = (code) => {
  if (code === 12) {
    return new Error(
      `child exited with 12: forked child wanted to use a non available port for debug`,
    )
  }
  return new Error(`child exited with ${code}`)
}

export const launchNode = async ({ cancellationToken, localRoot, remoteRoot, compileInto }) => {
  const execArgv = await createChildExecArgv({ cancellationToken })

  const child = forkChildProcess(nodeClientFile, { execArgv })

  const addChildMessageListener = (callback) => {
    const messageListener = ({ type, data }) => {
      callback({ type, data: eval(`(${data})`) })
    }
    child.on("message", messageListener)
    return () => {
      child.removeListener("message", messageListener)
    }
  }

  const opened = Promise.resolve()

  const closed = new Promise((resolve, reject) => {
    let lastError
    addChildMessageListener(({ type, data }) => {
      if (type === "error") {
        lastError = remoteErrorToLocalError(data)
      }
    })

    child.on("close", (code) => {
      if (code === 0 || code === null) {
        resolve()
        return
      }

      if (lastError) {
        reject(lastError)
        return
      }

      reject(createClosedWithFailureCodeError(code))
    })
  })

  const close = () => {
    child.kill("SIGINT")
  }

  const closeForce = () => {
    child.kill()
  }

  const sendToChild = (type, data) => {
    const source = uneval(data, { showFunctionBody: true })
    child.send({
      type,
      data: source,
    })
  }

  const fileToExecuted = (file, { instrument, setup, teardown }) => {
    const compileMapLocalURL = getCompileMapLocal({ localRoot, compileInto })
    // eslint-disable-next-line import/no-dynamic-require
    const compileMap = require(compileMapLocalURL)
    sendToChild("execute", {
      compileMap,
      localRoot,
      remoteRoot,
      compileInto,

      file,
      instrument,
      setup,
      teardown,
    })

    const executed = new Promise((resolve, reject) => {
      addChildMessageListener(({ type, data }) => {
        if (type === "execute-resolve") {
          resolve(data)
          return
        }
        if (type === "execute-reject") {
          reject(data)
          return
        }
      })
    })

    return executed
  }

  return {
    opened,
    closed,
    close,
    closeForce,
    fileToExecuted,
  }
}

const remoteErrorToLocalError = ({ message, stack }) => {
  const localError = new Error(message)
  localError.stack = stack
  return localError
}
