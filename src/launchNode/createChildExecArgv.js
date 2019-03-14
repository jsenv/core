import { findFreePort } from "../server/index.js"

export const createChildExecArgv = async ({
  cancellationToken,
  debugMethod = 'inherit',
  debugPort = 0,
} = {}) => {
  const execArgv = process.execArgv
  const childExecArgv = execArgv.slice()
  
  if (debugMethod === 'inherit') {
    const { type, index, port } = processExecArgvToDebugMeta(execArgv)

    if (debugPort === 0) {
      debugPort = await findFreePort(port + 1, { cancellationToken })
    }
    
    if (type) {
      childExecArgv[index] = `--${type}=${debugPort}`
    }
  }
  else if (debugMethod) {
    const { type, index, port } = processExecArgvToDebugMeta(execArgv)
    if (type) {
       childExecArgv[index] = `--${debugMethod}=${debugPort}`
    }
    else {
      childExecArgv.push(`--${debugMethod}=${debugPort}`)
    }
  }
  else {
    const { type, index } = processExecArgvToDebugMeta(execArgv)
    if (type) {
      childExecArgv.splice(index, 1)
    }
  }

  return childExecArgv
}

const processExecArgvToDebugMeta = (argv) => {
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]

    // https://nodejs.org/en/docs/guides/debugging-getting-started/
    if (arg === "--inspect") {
      return {
        index: i,
        type: "inspect",
        port: process.debugPort,
      }
    }
    const inspectPortAsString = stringSliceAfter(arg, "--inspect=")
    if (inspectPortAsString.length) {
      return {
        index: i,
        type: "inspect",
        port: Number(inspectPortAsString),
      }
    }

    if (arg === "--inspect-brk") {
      return {
        index: i,
        type: "inspect-brk",
        port: process.debugPort,
      }
    }

    const inspectBreakPortAsString = stringSliceAfter(arg, "--inspect-brk=")
    if (inspectBreakPortAsString.length) {
      return {
        index: i,
        type: "inspect-brk",
        port: Number(inspectBreakPortAsString),
      }
    }

    i++
  }

  return {}
}

const stringSliceAfter = (string, substring) => {
  const index = string.indexOf(substring)
  return index === -1 ? "" : string.slice(index + substring.length)
}

export const processIsExecutedByVSCode = () => {
  return typeof process.env.VSCODE_PID === "string"
}
