import { fork as forkChildProcess } from "child_process"
import { uneval } from "@dmail/uneval"
import { localRoot } from "../localRoot.js"
import { createChildExecArgv } from "./createChildExecArgv.js"

const nodeClientFile = `${localRoot}/dist/src/launchNode/client.js`

export const launchNode = async ({ cancellationToken, localRoot, remoteRoot, compileInto }) => {
  const execArgv = await createChildExecArgv({ cancellationToken })

  const child = forkChildProcess(nodeClientFile, {
    execArgv,
    // silent: true
    stdio: "pipe",
  })

  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  child.stdout.on("data", (chunk) => {
    const text = String(chunk)
    consoleCallbackArray.forEach((callback) => {
      callback({
        type: "log",
        text,
      })
    })
  })
  child.stderr.on("data", (chunk) => {
    const text = String(chunk)
    consoleCallbackArray.forEach((callback) => {
      callback({
        type: "error",
        text,
      })
    })
  })

  const errorCallbackArray = []
  const registerErrorCallback = (callback) => {
    errorCallbackArray.push(callback)
  }
  const emitError = (error) => {
    errorCallbackArray.forEach((callback) => {
      callback(error)
    })
  }
  // https://nodejs.org/api/child_process.html#child_process_event_error
  const errorEventRegistration = registerChildEvent(child, "error", (error) => {
    errorEventRegistration.unregister()
    exitErrorRegistration.unregister()
    emitError(error)
  })
  // process.exit(1) from child
  const exitErrorRegistration = registerChildEvent(child, "exit", (code) => {
    if (code !== 0 && code !== null) {
      errorEventRegistration.unregister()
      exitErrorRegistration.unregister()
      emitError(createExitWithFailureCodeError(code))
    }
  })

  // https://nodejs.org/api/child_process.html#child_process_event_disconnect
  const registerDisconnectCallback = (callback) => {
    registerChildEvent(child, "disconnect", callback)
  }

  const stop = () => {
    child.kill("SIGINT")
  }

  const stopForce = () => {
    child.kill()
  }

  const executeFile = async (file, options) => {
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

    const { status, coverageMap, error, namespace } = await execute()
    if (status === "rejected") {
      return {
        status,
        coverageMap,
        error: errorToLocalError(error, { file, localRoot }),
      }
    }
    return { status, coverageMap, namespace }
  }

  return {
    options: { execArgv },
    stop,
    stopForce,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
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
