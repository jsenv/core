import { createCancellationToken } from "@dmail/cancellation"

const { findFreePort } = import.meta.require("@dmail/server")

const AVAILABLE_DEBUG_MODE = ["none", "inherit", "inspect", "inspect-brk", "debug", "debug-brk"]

export const createChildExecArgv = async ({
  cancellationToken = createCancellationToken(),
  // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses
  debugPort,
  debugMode,
  debugModeInheritBreak,
  processExecArgv,
  processDebugPort,
} = {}) => {
  if (typeof debugMode === "string" && AVAILABLE_DEBUG_MODE.indexOf(debugMode) === -1) {
    throw new TypeError(`unexpected debug mode.
--- debug mode ---
${debugMode}
--- allowed debug mode ---
${AVAILABLE_DEBUG_MODE}`)
  }

  const processDebug = parseDebugFromExecArgv(processExecArgv)

  // this is required because vscode does not
  // support assigning a child spwaned without a specific port
  const forceFreePortIfZero = async ({ debugPort, port }) => {
    if (debugPort === 0) {
      const freePort = await findFreePort((port === 0 ? processDebugPort : port) + 1, {
        cancellationToken,
      })
      return freePort
    }
    return debugPort
  }

  if (debugMode === "inherit") {
    if (processDebug.mode === "none") {
      return copyExecArgv(processExecArgv)
    }

    const childDebugPort = await forceFreePortIfZero({
      cancellationToken,
      debugPort,
      port: processDebug.port,
    })

    let { mode } = processDebug
    if (debugModeInheritBreak === false) {
      if (mode === "debug-brk") mode = "debug"
      if (mode === "inspect-brk") mode = "inspect"
    }

    return replaceDebugExecArgv(processExecArgv, {
      processDebug,
      mode,
      port: childDebugPort,
    })
  }

  if (debugMode !== "none") {
    if (processDebug.mode === "none") {
      const childDebugPort = await forceFreePortIfZero({
        cancellationToken,
        debugPort,
        port: 1000, // TODO: should be random from 0 to 10000 for instance
      })
      return addDebugExecArgv(processExecArgv, { mode: debugMode, port: childDebugPort })
    }

    const childDebugPort = await forceFreePortIfZero({
      cancellationToken,
      debugPort,
      port: processDebug.port,
    })
    return replaceDebugExecArgv(processExecArgv, {
      processDebug,
      mode: debugMode,
      port: childDebugPort,
    })
  }

  if (processDebug.mode === "none") {
    return copyExecArgv(processExecArgv)
  }

  return removeDebugExecArgv(processExecArgv, processDebug)
}

const copyExecArgv = (argv) => argv.slice()

const replaceDebugExecArgv = (argv, { processDebug, mode, port }) => {
  const argvCopy = argv.slice()

  if (processDebug.portIndex) {
    // argvCopy[modeIndex] = `--${mode}`
    argvCopy[processDebug.portIndex] = `--${mode}-port${portToPortSuffix(port)}`
    return argvCopy
  }

  argvCopy[processDebug.modeIndex] = `--${mode}${portToPortSuffix(port)}`
  return argvCopy
}

const addDebugExecArgv = (argv, { mode, port }) => {
  const argvCopy = argv.slice()

  argvCopy.push(`--${mode}${portToPortSuffix(port)}`)

  return argvCopy
}

const removeDebugExecArgv = (argv, { modeIndex, portIndex }) => {
  const argvCopy = argv.slice()
  if (portIndex > -1) {
    argvCopy.splice(portIndex, 1)
    argvCopy.splice(
      // if modeIndex is after portIndex do -1 because we spliced
      // portIndex just above
      modeIndex > portIndex ? modeIndex - 1 : modeIndex,
      1,
    )
    return argvCopy
  }

  argvCopy.splice(modeIndex)
  return argvCopy
}

const portToPortSuffix = (port) => {
  if (typeof port !== "number") return ""
  if (port === 0) return ""
  return `=${port}`
}

const parseDebugFromExecArgv = (argv) => {
  let i = 0

  while (i < argv.length) {
    const arg = argv[i]

    // https://nodejs.org/en/docs/guides/debugging-getting-started/
    if (arg === "--inspect") {
      return {
        mode: "inspect",
        modeIndex: i,
        ...parseInspectPortFromExecArgv(argv),
      }
    }
    const inspectPortMatch = /^--inspect=([0-9]+)$/.exec(arg)
    if (inspectPortMatch) {
      return {
        mode: "inspect",
        modeIndex: i,
        port: Number(inspectPortMatch[1]),
      }
    }

    if (arg === "--inspect-brk") {
      return {
        // force "inspect" otherwise a breakpoint is hit inside vscode
        // mode: "inspect",
        mode: "inspect-brk",
        modeIndex: i,
        ...parseInspectPortFromExecArgv(argv),
      }
    }
    const inspectBreakMatch = /^--inspect-brk=([0-9]+)$/.exec(arg)
    if (inspectBreakMatch) {
      return {
        // force "inspect" otherwise a breakpoint is hit inside vscode
        // mode: "inspect",
        mode: "inspect-brk",
        modeIndex: i,
        port: Number(inspectBreakMatch[1]),
      }
    }

    if (arg === "--debug") {
      return {
        mode: "debug",
        modeIndex: i,
        ...parseDebugPortFromExecArgv(argv),
      }
    }
    const debugPortMatch = /^--debug=([0-9]+)$/.exec(arg)
    if (debugPortMatch) {
      return {
        mode: "debug",
        modeIndex: i,
        port: Number(debugPortMatch[1]),
      }
    }

    if (arg === "--debug-brk") {
      return {
        mode: "debug-brk",
        modeIndex: i,
        ...parseDebugPortFromExecArgv(argv),
      }
    }
    const debugBreakMatch = /^--debug-brk=([0-9]+)$/.exec(arg)
    if (debugBreakMatch) {
      return {
        mode: "debug-brk",
        modeIndex: i,
        port: Number(debugBreakMatch[1]),
      }
    }

    i++
  }

  return {
    mode: "none",
  }
}

const parseInspectPortFromExecArgv = (argv) => {
  const portMatch = arrayFindMatch(argv, (arg) => {
    if (arg === "--inspect-port")
      return {
        port: 0,
      }
    const match = /^--inspect-port=([0-9]+)$/.exec(arg)
    if (match) return { port: Number(match[1]) }
    return null
  })
  if (portMatch) {
    return {
      port: portMatch.port,
      portIndex: portMatch.arrayIndex,
    }
  }
  return {
    port: 0,
  }
}

const parseDebugPortFromExecArgv = (argv) => {
  const portMatch = arrayFindMatch(argv, (arg) => {
    if (arg === "--debug-port")
      return {
        port: 0,
      }
    const match = /^--debug-port=([0-9]+)$/.exec(arg)
    if (match) return { port: Number(match[1]) }
    return null
  })
  if (portMatch) {
    return {
      port: portMatch.port,
      portIndex: portMatch.arrayIndex,
    }
  }
  return {
    port: 0,
  }
}

const arrayFindMatch = (array, match) => {
  let i = 0
  while (i < array.length) {
    const value = array[i]
    i++
    const matchResult = match(value)
    if (matchResult) {
      return {
        ...matchResult,
        arrayIndex: i,
      }
    }
  }
  return null
}

export const processIsExecutedByVSCode = () => {
  return typeof process.env.VSCODE_PID === "string"
}
