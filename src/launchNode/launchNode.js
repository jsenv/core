import { fork as forkChildProcess } from "child_process"
import { uneval } from "@dmail/uneval"
import { localRoot } from "../localRoot.js"
import { getCompileMapLocal } from "../getCompileMapLocal.js"
import { createChildExecArgv } from "./createChildExecArgv.js"

const nodeClientFile = `${localRoot}/dist/src/launchNode/client.js`

export const launchNode = async ({ cancellationToken, localRoot, remoteRoot, compileInto }) => {
  const execArgv = await createChildExecArgv({ cancellationToken })

  const child = forkChildProcess(nodeClientFile, { execArgv })

  // https://nodejs.org/api/child_process.html#child_process_event_disconnect
  // il y a une subtilité entre disconnect et closed qu' il faut gérer
  // si on se retrouver disconnected
  // on ne pourra plus agir sur la plateforme
  const disconnected = new Promise((resolve) => {
    const disconnectRegistration = registerChildEvent(child, "disconnect", () => {
      disconnectRegistration.unregister()
      resolve()
    })
  })

  const errored = new Promise((resolve) => {
    // https://nodejs.org/api/child_process.html#child_process_event_error
    const errorEventRegistration = registerChildEvent(child, "error", (error) => {
      errorEventRegistration.unregister()
      errorMessageRegistration.unregister()
      exitErrorRegistration.unregister()
      resolve(error)
    })

    // uncaughException, unhandledRejection
    const errorMessageRegistration = registerChildMessage(child, "error", (error) => {
      errorEventRegistration.unregister()
      errorMessageRegistration.unregister()
      exitErrorRegistration.unregister()
      resolve(remoteErrorToLocalError(error))
    })

    // process.exit(1) from child
    const exitErrorRegistration = registerChildEvent(child, "exit", (code) => {
      if (code !== 0 && code !== null) {
        errorEventRegistration.unregister()
        errorMessageRegistration.unregister()
        exitErrorRegistration.unregister()
        resolve(createClosedWithFailureCodeError(code))
      }
    })
  })

  const closed = new Promise((resolve) => {
    const exitEventRegistration = registerChildEvent(child, "exit", (code) => {
      exitEventRegistration.unregister()
      resolve(code)
    })
  })

  const close = () => {
    child.kill("SIGINT")
  }

  const closeForce = () => {
    child.kill()
  }

  const fileToExecuted = (file, options) => {
    const compileMapLocalURL = getCompileMapLocal({ localRoot, compileInto })
    // eslint-disable-next-line import/no-dynamic-require
    const compileMap = require(compileMapLocalURL)
    sendToChild(child, "execute", {
      compileMap,
      localRoot,
      remoteRoot,
      compileInto,

      file,
      options,
    })

    const executed = new Promise((resolve, reject) => {
      // executed
      // should I call child.disconnect() at some point ?
      // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
      // I don't think so, the purpose is to keep control of the child

      const executResultRegistration = registerChildMessage(
        child,
        "execute-result",
        ({ failed, value }) => {
          executResultRegistration.unregister()
          if (failed) {
            reject(value)
          } else {
            resolve(value)
          }
        },
      )
    })

    return executed
  }

  return { disconnected, errored, close, closeForce, closed, fileToExecuted }
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

const createClosedWithFailureCodeError = (code) => {
  if (code === 12) {
    return new Error(
      `child exited with 12: forked child wanted to use a non available port for debug`,
    )
  }
  return new Error(`child exited with ${code}`)
}

const remoteErrorToLocalError = ({ message, stack }) => {
  const localError = new Error(message)
  localError.stack = stack
  return localError
}
