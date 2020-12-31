import { createCancellationToken } from "@jsenv/cancellation"
import { findFreePort } from "@jsenv/server"
import { createDetailedMessage } from "@jsenv/logger"
import { getCommandArgument, removeCommandArgument } from "./commandArguments.js"

const AVAILABLE_DEBUG_MODE = ["none", "inherit", "inspect", "inspect-brk", "debug", "debug-brk"]

export const createChildExecArgv = async ({
  cancellationToken = createCancellationToken(),
  // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses
  processExecArgv = process.execArgv,
  processDebugPort = process.debugPort,

  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true,
  traceWarnings = "inherit",
  unhandledRejection = "inherit",
  jsonModules = "inherit",
} = {}) => {
  if (typeof debugMode === "string" && AVAILABLE_DEBUG_MODE.indexOf(debugMode) === -1) {
    throw new TypeError(
      createDetailedMessage(`unexpected debug mode.`, {
        ["debug mode"]: debugMode,
        ["allowed debug mode"]: AVAILABLE_DEBUG_MODE,
      }),
    )
  }

  let childExecArgv = processExecArgv.slice()
  const { debugModeArg, debugPortArg } = getCommandDebugArgs(processExecArgv)
  let childDebugMode
  if (debugMode === "inherit") {
    if (debugModeArg) {
      childDebugMode = debugModeArg.name.slice(2)
      if (debugModeInheritBreak === false) {
        if (childDebugMode === "--debug-brk") childDebugMode = "--debug"
        if (childDebugMode === "--inspect-brk") childDebugMode = "--inspect"
      }
    } else {
      childDebugMode = "none"
    }
  } else {
    childDebugMode = debugMode
  }
  if (childDebugMode === "none") {
    // remove debug mode or debug port arg
    if (debugModeArg) {
      childExecArgv = removeCommandArgument(childExecArgv, debugModeArg.name)
    }
    if (debugPortArg) {
      childExecArgv = removeCommandArgument(childExecArgv, debugPortArg.name)
    }
  } else {
    // this is required because vscode does not
    // support assigning a child spwaned without a specific port
    const childDebugPort =
      debugPort === 0 ? await findFreePort(processDebugPort + 1, { cancellationToken }) : debugPort

    // remove process debugMode, it will be replaced with the child debugMode
    const childDebugModeArgName = `--${childDebugMode}`
    if (debugPortArg) {
      // replace the debug port arg
      const childDebugPortArgFull = `--${childDebugMode}-port${portToArgValue(childDebugPort)}`
      childExecArgv[debugPortArg.index] = childDebugPortArgFull

      // replace debug mode or create it (would be strange to have to create it)
      if (debugModeArg) {
        childExecArgv[debugModeArg.index] = childDebugModeArgName
      } else {
        childExecArgv.push(childDebugModeArgName)
      }
    } else {
      const childDebugArgFull = `${childDebugModeArgName}${portToArgValue(childDebugPort)}`
      // replace debug mode for child
      if (debugModeArg) {
        childExecArgv[debugModeArg.index] = childDebugArgFull
      }
      // add debug mode to child
      else {
        childExecArgv.push(childDebugArgFull)
      }
    }
  }

  if (traceWarnings !== "inherit") {
    const traceWarningsArg = getCommandArgument(childExecArgv, "--trace-warnings")
    if (traceWarnings && !traceWarningsArg) {
      childExecArgv.push("--trace-warnings")
    } else if (!traceWarnings && traceWarningsArg) {
      childExecArgv.splice(traceWarningsArg.index, 1)
    }
  }

  // https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode
  if (unhandledRejection !== "inherit") {
    const unhandledRejectionArg = getCommandArgument(childExecArgv, "--unhandled-rejections")
    if (unhandledRejection && !unhandledRejectionArg) {
      childExecArgv.push(`--unhandled-rejections=${unhandledRejection}`)
    } else if (unhandledRejection && unhandledRejectionArg) {
      childExecArgv[unhandledRejectionArg.index] = `--unhandled-rejections=${unhandledRejection}`
    } else if (!unhandledRejection && unhandledRejectionArg) {
      childExecArgv.splice(unhandledRejectionArg.index, 1)
    }
  }

  // https://nodejs.org/api/cli.html#cli_experimental_json_modules
  if (jsonModules !== "inherit") {
    const jsonModulesArg = getCommandArgument(childExecArgv, "--experimental-json-modules")
    if (jsonModules && !jsonModulesArg) {
      childExecArgv.push(`--experimental-json-modules`)
    } else if (!jsonModules && jsonModulesArg) {
      childExecArgv.splice(jsonModulesArg.index, 1)
    }
  }

  return childExecArgv
}

const portToArgValue = (port) => {
  if (typeof port !== "number") return ""
  if (port === 0) return ""
  return `=${port}`
}

// https://nodejs.org/en/docs/guides/debugging-getting-started/
const getCommandDebugArgs = (argv) => {
  const inspectArg = getCommandArgument(argv, "--inspect")
  if (inspectArg) {
    return {
      debugModeArg: inspectArg,
      debugPortArg: getCommandArgument(argv, "--inspect-port"),
    }
  }
  const inspectBreakArg = getCommandArgument(argv, "--inspect-brk")
  if (inspectBreakArg) {
    return {
      debugModeArg: inspectBreakArg,
      debugPortArg: getCommandArgument(argv, "--inspect-port"),
    }
  }

  const debugArg = getCommandArgument(argv, "--debug")
  if (debugArg) {
    return {
      debugModeArg: debugArg,
      debugPortArg: getCommandArgument(argv, "--debug-port"),
    }
  }
  const debugBreakArg = getCommandArgument(argv, "--debug-brk")
  if (debugBreakArg) {
    return {
      debugModeArg: debugBreakArg,
      debugPortArg: getCommandArgument(argv, "--debug-port"),
    }
  }

  return {}
}

export const processIsExecutedByVSCode = () => {
  return typeof process.env.VSCODE_PID === "string"
}
