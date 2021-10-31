import { fork } from "node:child_process"
import { uneval } from "@jsenv/uneval"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import {
  urlToFileSystemPath,
  resolveUrl,
  assertFilePresence,
} from "@jsenv/filesystem"

import { Abort } from "@jsenv/core/src/abort/main.js"
import { raceCallbacks } from "@jsenv/core/src/abort/callback_race.js"
import { createSignal } from "@jsenv/core/src/signal/signal.js"
import { nodeSupportsDynamicImport } from "../runtime/node-feature-detect/nodeSupportsDynamicImport.js"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { require } from "../require.js"
import { createChildProcessOptions } from "./createChildProcessOptions.js"
import {
  processOptionsFromExecArgv,
  execArgvFromProcessOptions,
} from "./processOptions.js"

const nodeControllableFileUrl = resolveUrl(
  "./src/internal/node-launcher/nodeControllableFile.mjs",
  jsenvCoreDirectoryUrl,
)

// https://nodejs.org/api/process.html#process_signal_events
const SIGINT_SIGNAL_NUMBER = 2
const SIGABORT_SIGNAL_NUMBER = 6
const SIGTERM_SIGNAL_NUMBER = 15
const SIGINT_EXIT_CODE = 128 + SIGINT_SIGNAL_NUMBER
const SIGABORT_EXIT_CODE = 128 + SIGABORT_SIGNAL_NUMBER
const SIGTERM_EXIT_CODE = 128 + SIGTERM_SIGNAL_NUMBER
// http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472
const GRACEFUL_STOP_SIGNAL = "SIGTERM"
const STOP_SIGNAL = "SIGKILL"
// it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL
const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL"

export const createControllableNodeProcess = async ({
  abortSignal = new AbortController().signal,
  logLevel,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  commandLineOptions = [],
  env,
  inheritProcessEnv = true,

  stdin = "pipe",
  stdout = "pipe",
  stderr = "pipe",
  logProcessCommand = false,
}) => {
  const logger = createLogger({ logLevel })
  const dynamicImportSupported = await nodeSupportsDynamicImport()
  if (!dynamicImportSupported) {
    throw new Error(`node does not support dynamic import`)
  }

  const childProcessOptions = await createChildProcessOptions({
    abortSignal,
    debugPort,
    debugMode,
    debugModeInheritBreak,
  })
  const processOptions = {
    ...childProcessOptions,
    ...processOptionsFromExecArgv(commandLineOptions),
  }
  const execArgv = execArgvFromProcessOptions(processOptions)

  if (env !== undefined && typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`)
  }

  await assertFilePresence(nodeControllableFileUrl)
  const envForChildProcess = {
    ...(inheritProcessEnv ? process.env : {}),
    ...env,
  }
  const childProcess = fork(urlToFileSystemPath(nodeControllableFileUrl), {
    execArgv,
    // silent: true
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: envForChildProcess,
  })

  logger.debug(
    createDetailedMessage(`fork child process pid ${childProcess.pid}`, {
      "execArgv": execArgv.join(`\n`),
      "custom env": JSON.stringify(env, null, "  "),
    }),
  )

  // if we passe stream, pipe them https://github.com/sindresorhus/execa/issues/81
  if (typeof stdin === "object") {
    stdin.pipe(childProcess.stdin)
  }
  if (typeof stdout === "object") {
    childProcess.stdout.pipe(stdout)
  }
  if (typeof stderr === "object") {
    childProcess.stderr.pipe(stderr)
  }
  if (logProcessCommand) {
    console.log(
      `${process.argv[0]} ${execArgv.join(" ")} ${urlToFileSystemPath(
        nodeControllableFileUrl,
      )}`,
    )
  }

  const childProcessReadyPromise = new Promise((resolve) => {
    onceProcessMessage(childProcess, "ready", resolve)
  })

  const outputSignal = createSignal()
  const removeOutputListener = installProcessOutputListener(
    childProcess,
    ({ type, text }) => {
      outputSignal.emit({ type, text })
    },
  )

  const errorSignal = createSignal()
  let killing = false
  const removeErrorListener = installProcessErrorListener(
    childProcess,
    (error) => {
      removeOutputListener()
      if (!childProcess.connected && error.code === "ERR_IPC_DISCONNECTED") {
        return
      }
      // on windows killProcessTree uses taskkill which seems to kill the process
      // with an exitCode of 1
      if (process.platform === "win32" && killing && error.exitCode === 1) {
        return
      }
      errorSignal.transmit(error)
    },
  )
  // keep listening process errors while child process is killed to catch
  // errors until it's actually disconnected
  // registerCleanupCallback(removeProcessErrorListener)

  // https://nodejs.org/api/child_process.html#child_process_event_disconnect
  const stoppedSignal = createSignal({
    once: true,
  })
  const cleanupStoppedRace = raceCallbacks(
    {
      disconnect: (cb) => {
        return onceProcessEvent(childProcess, "disconnect", cb)
      },
      exit: (cb) => {
        return onceProcessEvent(childProcess, "exit", (code, signal) => {
          cb({ code, signal })
        })
      },
    },
    (winner) => {
      const raceEffects = {
        disconnect: () => {
          removeErrorListener()
          stoppedSignal.emit()
        },
        exit: ({ code, signal }) => {
          removeErrorListener()
          stoppedSignal.emit({ code, signal })
        },
      }
      raceEffects[winner.name](winner.value)
    },
  )

  const killChildProcess = async ({ graceful, gracefulFailed }) => {
    if (stoppedSignal.emitted) {
      return
    }

    killing = true
    const signalToSend = graceful
      ? GRACEFUL_STOP_SIGNAL
      : gracefulFailed
      ? GRACEFUL_STOP_FAILED_SIGNAL
      : STOP_SIGNAL
    logger.debug(
      `send ${signalToSend} to child process with pid ${childProcess.pid}`,
    )

    await new Promise((resolve, reject) => {
      // see also https://github.com/sindresorhus/execa/issues/96
      const killProcessTree = require("tree-kill")
      killProcessTree(childProcess.pid, signalToSend, (error) => {
        if (!error) {
          resolve()
          return
        }

        if (isChildProcessAlreadyKilledError(error, { childProcess })) {
          resolve()
          return
        }

        // in case the child process did not disconnect at this point
        // something is keeping it alive and it cannot be propely killed
        cleanupStoppedRace()
        const killError = new Error(
          createDetailedMessage(
            `error while killing process ${childProcess.pid} tree with ${signalToSend}`,
            {
              ["error stack"]: error.stack,
            },
          ),
          { cause: error },
        )
        reject(killError)
      })
    })

    if (stoppedSignal.emitted) {
      return
    }

    await new Promise((resolve) => stoppedSignal.addCallback(resolve))
  }

  const stop = async ({ gracefulFailed } = {}) => {
    return killChildProcess({ graceful: false, gracefulFailed })
  }

  const gracefulStop = async () => {
    return killChildProcess({ graceful: true })
  }

  const requestActionOnChildProcess = ({
    abortSignal,
    actionType,
    actionParams,
  }) => {
    return new Promise(async (resolve, reject) => {
      Abort.throwIfAborted(abortSignal)
      await childProcessReadyPromise

      onceProcessMessage(childProcess, "action-result", ({ status, value }) => {
        if (status === "action-completed") {
          resolve(value)
        } else {
          reject(value)
        }
      })

      logger.debug(
        createDetailedMessage(`ask child process to perform an action`, {
          actionType,
          actionParams: JSON.stringify(actionParams, null, "  "),
        }),
      )

      try {
        Abort.throwIfAborted(abortSignal)
        await sendToProcess(childProcess, "action", {
          actionType,
          actionParams,
        })
      } catch (e) {
        if (abortSignal.aborted && e.name === "AbortError") {
          throw e
        }
        logger.error(
          createDetailedMessage(`error while sending message to child`, {
            ["error stack"]: e.stack,
          }),
        )
        throw e
      }
    })
  }

  return {
    execArgv,
    stoppedSignal,
    errorSignal,
    outputSignal,
    gracefulStop,
    stop,
    requestActionOnChildProcess,
  }
}

const sendToProcess = async (childProcess, type, data) => {
  const source = uneval(data, { functionAllowed: true })

  return new Promise((resolve, reject) => {
    childProcess.send({ type, data: source }, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

const installProcessOutputListener = (childProcess, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = (chunk) => {
    callback({ type: "log", text: String(chunk) })
  }
  childProcess.stdout.on("data", stdoutDataCallback)

  const stdErrorDataCallback = (chunk) => {
    callback({ type: "error", text: String(chunk) })
  }
  childProcess.stderr.on("data", stdErrorDataCallback)

  return () => {
    childProcess.stdout.removeListener("data", stdoutDataCallback)
    childProcess.stderr.removeListener("data", stdoutDataCallback)
  }
}

const installProcessErrorListener = (childProcess, callback) => {
  // https://nodejs.org/api/child_process.html#child_process_event_error
  const removeErrorListener = onceProcessMessage(
    childProcess,
    "error",
    (error) => {
      removeExitListener() // if an error occured we ignore the child process exitCode
      callback(error)
    },
  )
  // process.exit(1) in child process or process.exitCode = 1 + process.exit()
  // means there was an error even if we don't know exactly what.
  const removeExitListener = onceProcessEvent(childProcess, "exit", (code) => {
    if (
      code !== null &&
      code !== 0 &&
      code !== SIGINT_EXIT_CODE &&
      code !== SIGTERM_EXIT_CODE &&
      code !== SIGABORT_EXIT_CODE
    ) {
      removeErrorListener()
      callback(createExitWithFailureCodeError(code))
    }
  })
  return () => {
    removeErrorListener()
    removeExitListener()
  }
}

const createExitWithFailureCodeError = (code) => {
  if (code === 12) {
    return new Error(
      `child exited with 12: forked child wanted to use a non available port for debug`,
    )
  }
  const error = new Error(`child exited with ${code}`)
  error.exitCode = code
  return error
}

const onceProcessMessage = (childProcess, type, callback) => {
  const onmessage = (message) => {
    if (message.type === type) {
      childProcess.removeListener("message", onmessage)
      // eslint-disable-next-line no-eval
      callback(message.data ? eval(`(${message.data})`) : "")
    }
  }
  childProcess.on("message", onmessage)
  return () => {
    childProcess.removeListener("message", onmessage)
  }
}

const onceProcessEvent = (childProcess, type, callback) => {
  childProcess.once(type, callback)

  return () => {
    childProcess.removeListener(type, callback)
  }
}

const isChildProcessAlreadyKilledError = (error, { childProcess }) => {
  // on windows: process with pid cannot be found
  if (error.stack.includes(`The process "${childProcess.pid}" not found`)) {
    return true
  }

  // on windows: child process with a pid cannot be found
  if (
    error.stack.includes("Reason: There is no running instance of the task")
  ) {
    return true
  }

  // windows too
  if (error.stack.includes("The operation attempted is not supported")) {
    return true
  }

  return false
}
