import { fork as forkChildProcess } from "child_process"
import path from "path"
import { uneval } from "@dmail/uneval"
import { createChildExecArgv } from "./createChildExecArgv.js"
import { createPlatformController } from "../platform-controller/createPlatformController.js"

const root = path.resolve(__dirname, "../../../")
const nodeClientFile = `${root}/dist/src/createExecuteOnNode/client.js`

const createClosedWithFailureCodeError = (code) => {
  if (code === 12) {
    return new Error(
      `child exited with 12: forked child wanted to use a non available port for debug`,
    )
  }
  return new Error(`child exited with ${code}`)
}

const launchNode = async ({ cancellationToken, localRoot, remoteRoot, compileInto }) => {
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

  const errorReceived = new Promise((resolve) => {
    addChildMessageListener(({ type, data }) => {
      if (type === "error") {
        resolve(data)
      }
    })
  })

  const closedWithFailureCode = new Promise((resolve) => {
    child.on("close", (code) => {
      if (code !== 0 && code !== null) {
        resolve(createClosedWithFailureCodeError(code))
      }
    })
  })

  const errored = Promise.race([errorReceived, closedWithFailureCode])

  const closed = new Promise((resolve) => {
    child.on("close", (code) => {
      if (code === 0 || code === null) {
        resolve()
      }
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

  const executeFile = (file, { instrument, setup, teardown }) => {
    sendToChild("execute", {
      localRoot,
      remoteRoot,
      compileInto,

      file,
      instrument,
      setup,
      teardown,
    })

    const done = new Promise((resolve) => {
      addChildMessageListener(({ type, data }) => {
        if (type === "done") {
          // ensure done is not settled to early
          resolve(data)
        }
      })
    })

    return { done }
  }

  return {
    errored,
    closed,
    close,
    closeForce,
    executeFile,
  }
}

export const createExecuteOnNode = ({
  cancellationToken,
  localRoot,
  remoteRoot,
  compileInto,
  hotreload,
  hotreloadSSERoot,
  verbose,
}) => {
  return createPlatformController({
    cancellationToken,
    platformTypeForLog: "node",
    hotreload,
    hotreloadSSERoot,
    verbose,
    launchPlatform: () => launchNode({ cancellationToken, localRoot, remoteRoot, compileInto }),
  })
}
