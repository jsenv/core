import { findFreePort } from "../server/index.js"

export const createChildExecArgv = async ({ cancellationToken } = {}) => {
  const execArgv = process.execArgv
  const childExecArgv = execArgv.slice()
  const { type, index, port } = processExecArgvToDebugMeta(execArgv)

  if (type === "inspect") {
    // allow vscode to debug child, otherwise you have port already used
    const childPort = await findFreePort(port + 1, { cancellationToken })
    childExecArgv[index] = `--inspect=${childPort}`
  }
  if (type === "inspect-break") {
    // allow vscode to debug child, otherwise you have port already used
    const childPort = await findFreePort(port + 1, { cancellationToken })
    childExecArgv[index] = `--inspect-brk=${childPort}`
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
        type: "inspect-break",
        port: process.debugPort,
      }
    }

    const inspectBreakPortAsString = stringSliceAfter(arg, "--inspect-brk=")
    if (inspectBreakPortAsString.length) {
      return {
        index: i,
        type: "inspect-break",
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
