import { fork as forkChildProcess } from "child_process"
import { uneval } from "@dmail/uneval"
import { localRoot } from "../localRoot.js"
import { createChildExecArgv } from "./createChildExecArgv.js"

const nodeClientFile = `${localRoot}/dist/src/launchNode/client.js`

export const launchNode = async ({
  cancellationToken,
  localRoot,
  remoteRoot,
  compileInto,
  // mirror to be implemented
  // si mirror est false faut spawn differement le child je crois
  // mirrorConsole,
}) => {
  // theorically listening 'data' on stdout + stderr should do the trick
  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }

  const execArgv = await createChildExecArgv({ cancellationToken })

  const child = forkChildProcess(nodeClientFile, { execArgv })

  const errored = new Promise((resolve) => {
    // https://nodejs.org/api/child_process.html#child_process_event_error
    const errorEventRegistration = registerChildEvent(child, "error", (error) => {
      errorEventRegistration.unregister()
      exitErrorRegistration.unregister()
      resolve(error)
    })

    // process.exit(1) from child
    const exitErrorRegistration = registerChildEvent(child, "exit", (code) => {
      if (code !== 0 && code !== null) {
        errorEventRegistration.unregister()
        exitErrorRegistration.unregister()
        resolve(createExitWithFailureCodeError(code))
      }
    })
  })

  // https://nodejs.org/api/child_process.html#child_process_event_disconnect
  const disconnected = new Promise((resolve) => {
    const disconnectRegistration = registerChildEvent(child, "disconnect", () => {
      disconnectRegistration.unregister()
      resolve()
    })
  })

  const stop = () => {
    child.kill("SIGINT")
  }

  const stopForce = () => {
    child.kill()
  }

  const fileToExecuted = async (file, options) => {
    const execute = () =>
      new Promise((resolve) => {
        const executResultRegistration = registerChildMessage(child, "execute-result", (value) => {
          executResultRegistration.unregister()
          resolve(value)
        })

        sendToChild(child, "execute", {
          localRoot,
          remoteRoot,
          compileInto,

          file,
          options,
        })
      })

    const { status, statusData, ...rest } = await execute()
    if (status === "rejected") {
      return {
        status,
        statusData: errorToLocalError(statusData, { file, localRoot }),
        ...rest,
      }
    }
    return { status, statusData, ...rest }
  }

  return {
    options: { execArgv },
    errored,
    disconnected,
    stop,
    stopForce,
    fileToExecuted,
    registerConsoleCallback,
  }
}

const sendToChild = (child, type, data) => {
  const source = uneval(data, { showFunctionBody: true })
  child.send({
    type,
    data: source,
  })
}

const registerChildMessage = (child, type, callback) => {
  return registerChildEvent(child, "message", (message) => {
    if (message.type === type) {
      callback(eval(`(${message.data})`))
    }
  })
}

const registerChildEvent = (child, type, callback) => {
  child.on(type, callback)

  const unregister = () => {
    child.removeListener(type, callback)
  }

  const registration = {
    unregister,
  }
  return registration
}

const createExitWithFailureCodeError = (code) => {
  if (code === 12) {
    return new Error(
      `child exited with 12: forked child wanted to use a non available port for debug`,
    )
  }
  return new Error(`child exited with ${code}`)
}

const errorToLocalError = (error, { file, localRoot }) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    const localError = new Error(error.message.replace(file, `${localRoot}/${file}`))
    return localError
  }

  if (error && typeof error === "object") {
    const localError = new Error(error.message)
    localError.stack = error.stack
    return localError
  }

  return error
}
