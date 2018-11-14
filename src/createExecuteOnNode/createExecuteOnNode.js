import { fork as forkChildProcess } from "child_process"
import path from "path"
import { uneval } from "@dmail/uneval"
import { createChildExecArgv } from "./createChildExecArgv.js"
import { anyOf } from "../outcome/index.js"
import { createPlatformController } from "./createPlatformController.js"

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

const launchNode = async ({ cancellation, localRoot, remoteRoot, compileInto }) => {
  const execArgv = await createChildExecArgv({ cancellation })
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

  const sendToChild = (type, data) => {
    const source = uneval(data, { showFunctionBody: true })
    child.send({
      type,
      data: source,
    })
  }

  const errorReceived = (settle) => {
    return addChildMessageListener(({ type, data }) => {
      if (type === "error") {
        settle(data)
      }
    })
  }

  const closedWithFailureCode = (settle) => {
    const crashedListener = (code) => {
      if (code !== 0 && code !== null) {
        settle(createClosedWithFailureCodeError(code))
      }
    }
    child.on("close", crashedListener)
    return () => child.removeListener("close", crashedListener)
  }

  const errored = anyOf(errorReceived, closedWithFailureCode)

  const closed = (settle) => {
    const closedListener = (code) => {
      if (code === 0 || code === null) {
        settle()
      }
    }
    child.on("close", closedListener)
    return () => child.removeListener("close", closedListener)
  }

  const done = (settle) => {
    return addChildMessageListener(({ type, data }) => {
      if (type === "done") {
        settle(data)
      }
    })
  }

  const close = () => {
    child.kill("SIGINT")
  }

  const closeForce = () => {
    child.kill()
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
  }

  return {
    errored,
    closed,
    done,
    close,
    closeForce,
    executeFile,
  }
}

export const createExecuteOnNode = ({
  cancellation,
  localRoot,
  remoteRoot,
  compileInto,
  hotreload,
  hotreloadSSERoot,
  verbose,
}) => {
  return createPlatformController({
    cancellation,
    platformTypeForLog: "node",
    hotreload,
    hotreloadSSERoot,
    verbose,
    launchPlatform: () => launchNode({ cancellation, localRoot, remoteRoot, compileInto }),
  })
}
