import { fork } from "node:child_process"
import {
  Abort,
  raceCallbacks,
  createCallbackListNotifiedOnce,
} from "@jsenv/abort"
import { uneval } from "@jsenv/uneval"

import { urlToFileSystemPath } from "@jsenv/urls"
import { createDetailedMessage } from "@jsenv/log"
import { memoize } from "@jsenv/utils/memoize/memoize.js"
import { createChildExecOptions } from "./child_exec_options.js"
import { ExecOptions } from "./exec_options.js"
import { killProcessTree } from "./kill_process_tree.js"

const NODE_CONTROLLABLE_FILE_URL = new URL(
  "./controllable_file.mjs",
  import.meta.url,
).href

export const nodeProcess = {
  name: "node",
  version: process.version.slice(1),
}

nodeProcess.run = async ({
  signal = new AbortController().signal,
  logger,
  logProcessCommand = false,
  rootDirectoryUrl,
  fileRelativeUrl,

  keepRunning,
  gracefulStopAllocatedMs = 4000,
  stopSignal,
  onConsole,

  collectCoverage = false,
  coverageForceIstanbul,
  collectPerformance,

  debugPort,
  debugMode,
  debugModeInheritBreak,
  env,
  inheritProcessEnv = true,
  commandLineOptions = [],
  stdin = "pipe",
  stdout = "pipe",
  stderr = "pipe",
}) => {
  if (env !== undefined && typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`)
  }
  env = {
    ...env,
    COVERAGE_ENABLED: collectCoverage,
    JSENV: true,
  }
  if (coverageForceIstanbul) {
    // if we want to force istanbul, we will set process.env.NODE_V8_COVERAGE = ''
    // into the child_process
    env.NODE_V8_COVERAGE = ""
  }
  commandLineOptions = [
    "--experimental-import-meta-resolve",
    ...commandLineOptions,
  ]

  const cleanupCallbackList = createCallbackListNotifiedOnce()
  const cleanup = async (reason) => {
    await cleanupCallbackList.notify({ reason })
  }

  const childExecOptions = await createChildExecOptions({
    signal,
    debugPort,
    debugMode,
    debugModeInheritBreak,
  })
  const execArgv = ExecOptions.toExecArgv({
    ...childExecOptions,
    ...ExecOptions.fromExecArgv(commandLineOptions),
  })
  const envForChildProcess = {
    ...(inheritProcessEnv ? process.env : {}),
    ...env,
  }
  logger[logProcessCommand ? "info" : "debug"](
    `${process.argv[0]} ${execArgv.join(" ")} ${urlToFileSystemPath(
      NODE_CONTROLLABLE_FILE_URL,
    )}`,
  )
  const childProcess = fork(urlToFileSystemPath(NODE_CONTROLLABLE_FILE_URL), {
    execArgv,
    // silent: true
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: envForChildProcess,
  })
  logger.debug(
    createDetailedMessage(`child process forked (pid ${childProcess.pid})`, {
      "execArgv": execArgv.join(`\n`),
      "custom env": JSON.stringify(env, null, "  "),
    }),
  )
  // if we pass stream, pipe them https://github.com/sindresorhus/execa/issues/81
  if (typeof stdin === "object") {
    stdin.pipe(childProcess.stdin)
  }
  if (typeof stdout === "object") {
    childProcess.stdout.pipe(stdout)
  }
  if (typeof stderr === "object") {
    childProcess.stderr.pipe(stderr)
  }
  const childProcessReadyPromise = new Promise((resolve) => {
    onceProcessMessage(childProcess, "ready", resolve)
  })
  const removeOutputListener = installProcessOutputListener(
    childProcess,
    ({ type, text }) => {
      onConsole({ type, text })
    },
  )
  const stop = memoize(async ({ gracefulStopAllocatedMs } = {}) => {
    // all libraries are facing problem on windows when trying
    // to kill a process spawning other processes.
    // "killProcessTree" is theorically correct but sometimes keep process handing forever.
    // Inside GitHub workflow the whole Virtual machine gets unresponsive and ends up being killed
    // There is no satisfying solution to this problem so we stick to the basic
    // childProcess.kill()
    if (process.platform === "win32") {
      childProcess.kill()
      return
    }
    if (gracefulStopAllocatedMs) {
      try {
        await killProcessTree(childProcess.pid, {
          signal: GRACEFUL_STOP_SIGNAL,
          timeout: gracefulStopAllocatedMs,
        })
        return
      } catch (e) {
        if (e.code === "TIMEOUT") {
          logger.debug(
            `kill with SIGTERM because gracefulStop still pending after ${gracefulStopAllocatedMs}ms`,
          )
          await killProcessTree(childProcess.pid, {
            signal: GRACEFUL_STOP_FAILED_SIGNAL,
          })
          return
        }
        throw e
      }
    }
    await killProcessTree(childProcess.pid, { signal: STOP_SIGNAL })
    return
  })

  const actionOperation = Abort.startOperation()
  actionOperation.addAbortSignal(signal)
  const winnerPromise = new Promise((resolve) => {
    raceCallbacks(
      {
        aborted: (cb) => {
          return actionOperation.addAbortCallback(cb)
        },
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
        response: (cb) => {
          onceProcessMessage(childProcess, "action-result", cb)
        },
      },
      resolve,
    )
  })
  const getResult = async () => {
    actionOperation.throwIfAborted()
    await childProcessReadyPromise
    actionOperation.throwIfAborted()
    await sendToProcess(childProcess, "action", {
      actionType: "execute-using-dynamic-import",
      actionParams: {
        fileUrl: new URL(fileRelativeUrl, rootDirectoryUrl).href,
        collectPerformance,
      },
    })
    const winner = await winnerPromise
    if (winner.name === "aborted") {
      return {
        status: "aborted",
      }
    }
    if (winner.name === "error") {
      const error = winner.data
      removeOutputListener()
      return {
        status: "errored",
        error,
      }
    }
    if (winner.name === "exit") {
      const { code } = winner.data
      await cleanup("process exit")
      if (code === 12) {
        return {
          status: "errored",
          error: new Error(
            `node process exited with 12 (the forked child process wanted to use a non-available port for debug)`,
          ),
        }
      }
      if (
        code === null ||
        code === 0 ||
        code === SIGINT_EXIT_CODE ||
        code === SIGTERM_EXIT_CODE ||
        code === SIGABORT_EXIT_CODE
      ) {
        return {
          status: "errored",
          error: new Error(`node process exited during execution`),
        }
      }
      // process.exit(1) in child process or process.exitCode = 1 + process.exit()
      // means there was an error even if we don't know exactly what.
      return {
        status: "errored",
        error: new Error(
          `node process exited with code ${code} during execution`,
        ),
      }
    }
    const { status, value } = winner.data
    if (status === "action-failed") {
      return {
        status: "errored",
        error: value,
      }
    }
    return {
      status: "completed",
      ...value,
    }
  }

  let result
  try {
    result = await getResult()
  } catch (e) {
    result = {
      status: "errored",
      error: e,
    }
  }
  if (keepRunning) {
    stopSignal.notify = stop
  } else {
    await stop({
      gracefulStopAllocatedMs,
    })
  }
  await actionOperation.end()
  return result
}

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
