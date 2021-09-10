import { createCancellationToken } from "@jsenv/cancellation"
import { findFreePort } from "@jsenv/server"
import { createDetailedMessage } from "@jsenv/logger"

import { processOptionsFromExecArgv } from "./processOptions.js"

const AVAILABLE_DEBUG_MODE = [
  "none",
  "inherit",
  "inspect",
  "inspect-brk",
  "debug",
  "debug-brk",
]

export const createChildProcessOptions = async ({
  cancellationToken = createCancellationToken(),
  // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses
  processExecArgv = process.execArgv,
  processDebugPort = process.debugPort,

  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true,
} = {}) => {
  if (
    typeof debugMode === "string" &&
    AVAILABLE_DEBUG_MODE.indexOf(debugMode) === -1
  ) {
    throw new TypeError(
      createDetailedMessage(`unexpected debug mode.`, {
        ["debug mode"]: debugMode,
        ["allowed debug mode"]: AVAILABLE_DEBUG_MODE,
      }),
    )
  }

  const childProcessOptions = processOptionsFromExecArgv(processExecArgv)

  await mutateDebuggingOptions(childProcessOptions, {
    cancellationToken,
    processDebugPort,
    debugMode,
    debugPort,
    debugModeInheritBreak,
  })

  return childProcessOptions
}

const mutateDebuggingOptions = async (
  childProcessOptions,
  {
    // ensure multiline
    cancellationToken,
    processDebugPort,
    debugMode,
    debugPort,
    debugModeInheritBreak,
  },
) => {
  const parentDebugInfo = getDebugInfo(childProcessOptions)
  const parentDebugModeOptionName = parentDebugInfo.debugModeOptionName
  const parentDebugPortOptionName = parentDebugInfo.debugPortOptionName
  const childDebugModeOptionName = getChildDebugModeOptionName({
    parentDebugModeOptionName,
    debugMode,
    debugModeInheritBreak,
  })

  if (!childDebugModeOptionName) {
    // remove debug mode and debug port fron child options
    if (parentDebugModeOptionName) {
      delete childProcessOptions[parentDebugModeOptionName]
    }
    if (parentDebugPortOptionName) {
      delete childProcessOptions[parentDebugPortOptionName]
    }
    return
  }

  // replace child debug mode
  if (
    parentDebugModeOptionName &&
    parentDebugModeOptionName !== childDebugModeOptionName
  ) {
    delete childProcessOptions[parentDebugModeOptionName]
  }
  childProcessOptions[childDebugModeOptionName] = ""

  // this is required because vscode does not
  // support assigning a child spawned without a specific port
  const childDebugPortOptionValue =
    debugPort === 0
      ? await findFreePort(processDebugPort + 37, { cancellationToken })
      : debugPort
  // replace child debug port
  if (parentDebugPortOptionName) {
    delete childProcessOptions[parentDebugPortOptionName]
  }
  childProcessOptions[childDebugModeOptionName] = portToArgValue(
    childDebugPortOptionValue,
  )
}

const getChildDebugModeOptionName = ({
  parentDebugModeOptionName,
  debugMode,
  debugModeInheritBreak,
}) => {
  if (debugMode === "none") {
    return undefined
  }

  if (debugMode !== "inherit") {
    return `--${debugMode}`
  }

  if (!parentDebugModeOptionName) {
    return undefined
  }

  if (!debugModeInheritBreak && parentDebugModeOptionName === "--inspect-brk") {
    return "--inspect"
  }
  if (!debugModeInheritBreak && parentDebugModeOptionName === "--debug-brk") {
    return "--debug"
  }

  return parentDebugModeOptionName
}

const portToArgValue = (port) => {
  if (typeof port !== "number") return ""
  if (port === 0) return ""
  return port
}

// https://nodejs.org/en/docs/guides/debugging-getting-started/
const getDebugInfo = (processOptions) => {
  const inspectOption = processOptions["--inspect"]
  if (inspectOption !== undefined) {
    return {
      debugModeOptionName: "--inspect",
      debugPortOptionName: "--inspect-port",
    }
  }

  const inspectBreakOption = processOptions["--inspect-brk"]
  if (inspectBreakOption !== undefined) {
    return {
      debugModeOptionName: "--inspect-brk",
      debugPortOptionName: "--inspect-port",
    }
  }

  const debugOption = processOptions["--debug"]
  if (debugOption !== undefined) {
    return {
      debugModeOptionName: "--debug",
      debugPortOptionName: "--debug-port",
    }
  }

  const debugBreakOption = processOptions["--debug-brk"]
  if (debugBreakOption !== undefined) {
    return {
      debugModeOptionName: "--debug-brk",
      debugPortOptionName: "--debug-port",
    }
  }

  return {}
}

export const processIsExecutedByVSCode = () => {
  return typeof process.env.VSCODE_PID === "string"
}
