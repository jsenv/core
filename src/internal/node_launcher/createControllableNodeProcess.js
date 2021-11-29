import { fork } from "node:child_process"
import { uneval } from "@jsenv/uneval"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import { urlToFileSystemPath, assertFilePresence } from "@jsenv/filesystem"
import {
  Abort,
  raceCallbacks,
  createCallbackList,
  createCallbackListNotifiedOnce,
} from "@jsenv/abort"

import { nodeSupportsDynamicImport } from "../node_feature_detection/nodeSupportsDynamicImport.js"
import { createChildProcessOptions } from "./createChildProcessOptions.js"
import {
  processOptionsFromExecArgv,
  execArgvFromProcessOptions,
} from "./processOptions.js"
import { killProcessTree } from "./kill_process_tree.js"

const NODE_CONTROLLABLE_FILE_URL = new URL(
  "../node_runtime/nodeControllableFile.mjs",
  import.meta.url,
).href

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
  signal = new AbortController().signal,
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
    signal,
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

  await assertFilePresence(NODE_CONTROLLABLE_FILE_URL)
  const envForChildProcess = {
    ...(inheritProcessEnv ? process.env : {}),
    ...env,
  }
  const childProcess = fork(urlToFileSystemPath(NODE_CONTROLLABLE_FILE_URL), {
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
        NODE_CONTROLLABLE_FILE_URL,
      )}`,
    )
  }

  const childProcessReadyPromise = new Promise((resolve) => {
    onceProcessMessage(childProcess, "ready", resolve)
  })

  const outputCallbackList = createCallbackList()
  const removeOutputListener = installProcessOutputListener(
    childProcess,
    ({ type, text }) => {
      outputCallbackList.notify({ type, text })
    },
  )

  const errorCallbackList = createCallbackList()

  const stoppedCallbackList = createCallbackListNotifiedOnce()

  raceCallbacks(
    {
      // https://nodejs.org/api/child_process.html#child_process_event_disconnect
      // disconnect: (cb) => {
      //   return onceProcessEvent(childProcess, "disconnect", cb)
      // },
      // https://nodejs.org/api/child_process.html#child_process_event_error
      error: (cb) => {
        return onceProcessEvent(childProcess, "error", cb)
      },
      exit: (cb) => {
        return onceProcessEvent(childProcess, "exit", (code, signal) => {
          cb({ code, signal })
        })
      },
    },
    (winner) => {
      const raceEffects = {
        // disconnect: () => {
        //   stoppedCallbackList.notify()
        // },
        error: (error) => {
          removeOutputListener()
          if (
            !childProcess.connected &&
            error.code === "ERR_IPC_DISCONNECTED"
          ) {
            return
          }
          errorCallbackList.notify(error)
        },
        exit: ({ code, signal }) => {
          // process.exit(1) in child process or process.exitCode = 1 + process.exit()
          // means there was an error even if we don't know exactly what.
          if (
            code !== null &&
            code !== 0 &&
            code !== SIGINT_EXIT_CODE &&
            code !== SIGTERM_EXIT_CODE &&
            code !== SIGABORT_EXIT_CODE
          ) {
            errorCallbackList.notify(createExitWithFailureCodeError(code))
          }
          stoppedCallbackList.notify({ code, signal })
        },
      }
      raceEffects[winner.name](winner.data)
    },
  )

  const stop = async ({ gracefulStopAllocatedMs } = {}) => {
    if (stoppedCallbackList.notified) {
      return {}
    }

    const createStoppedPromise = async () => {
      if (stoppedCallbackList.notified) {
        return
      }
      await new Promise((resolve) => stoppedCallbackList.add(resolve))
    }

    if (gracefulStopAllocatedMs) {
      try {
        await killProcessTree(childProcess.pid, {
          signal: GRACEFUL_STOP_SIGNAL,
          timeout: gracefulStopAllocatedMs,
        })
        await createStoppedPromise()
        return { graceful: true }
      } catch (e) {
        if (e.code === "TIMEOUT") {
          logger.debug(
            `kill with SIGTERM because gracefulStop still pending after ${gracefulStopAllocatedMs}ms`,
          )
          await killProcessTree(childProcess.pid, {
            signal: GRACEFUL_STOP_FAILED_SIGNAL,
          })
          await createStoppedPromise()
          return { graceful: false }
        }
        throw e
      }
    }

    await killProcessTree(childProcess.pid, { signal: STOP_SIGNAL })
    await createStoppedPromise()
    return { graceful: false }
  }

  const requestActionOnChildProcess = ({
    signal,
    actionType,
    actionParams,
  }) => {
    const actionOperation = Abort.startOperation()
    actionOperation.addAbortSignal(signal)

    return new Promise(async (resolve, reject) => {
      actionOperation.throwIfAborted()
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
        actionOperation.throwIfAborted()
        await sendToProcess(childProcess, "action", {
          actionType,
          actionParams,
        })
      } catch (e) {
        if (Abort.isAbortError(e) && actionOperation.signal.aborted) {
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
    stoppedCallbackList,
    errorCallbackList,
    outputCallbackList,
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
