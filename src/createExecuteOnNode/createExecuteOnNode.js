import { fork } from "child_process"
import path from "path"
import { uneval } from "@dmail/uneval"
import { cancellationNone } from "../cancel/index.js"
import { registerEvent, eventRace } from "../eventHelper.js"
import { findFreePort } from "../server/index.js"

const root = path.resolve(__dirname, "../../../")
const nodeClientFile = `${root}/dist/src/createExecuteOnNode/client.js`

export const processIsExecutedByVSCode = () => {
  return typeof process.env.VSCODE_PID === "string"
}

const stringSliceAfter = (string, substring) => {
  const index = string.indexOf(substring)
  return index === -1 ? "" : string.slice(index + substring.length)
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

const createChildExecArgv = async () => {
  const execArgv = process.execArgv
  const childExecArgv = execArgv.slice()
  const { type, index, port } = processExecArgvToDebugMeta(execArgv)

  if (type === "inspect") {
    // allow vscode to debug child, otherwise you have port already used
    const childPort = await findFreePort(port)
    childExecArgv[index] = `--inspect=${childPort}`
  }
  if (type === "inspect-break") {
    // allow vscode to debug child, otherwise you have port already used
    const childPort = await findFreePort(port)
    childExecArgv[index] = `--inspect-brk=${childPort}`
  }

  return childExecArgv
}

export const createExecuteOnNode = ({
  localRoot,
  remoteRoot,
  compileInto,
  groupMapFile,
  hotreload = false,
  hotreloadSSERoot,
}) => {
  const execute = ({
    cancellation = cancellationNone,
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
    verbose = false,
  }) => {
    const log = (...args) => {
      if (verbose) {
        console.log(...args)
      }
    }

    const forkChild = async () => {
      await cancellation.toPromise()
      const execArgv = await createChildExecArgv()

      const child = fork(nodeClientFile, { execArgv })
      log(`fork ${nodeClientFile} to execute ${file}`)

      const childMessageRegister = (callback) => registerEvent(child, "message", callback)

      const closeRegister = (callback) => registerEvent(child, "close", callback)

      const registerChildEvent = (name, callback) => {
        return registerEvent(child, "message", ({ type, data }) => {
          if (name === type) {
            callback(eval(`(${data})`))
          }
        })
      }

      const restartRegister = (callback) => registerChildEvent("restart", callback)

      childMessageRegister(({ type, data }) => {
        log(`receive message from child ${type}:${data}`)
      })
      closeRegister((code) => {
        log(`child closed with code ${code}`)
      })

      const sendToChild = (type, data) => {
        const source = uneval(data, { showFunctionBody: true })
        log(`send to child ${type}: ${source}`)
        child.send({
          type,
          data: source,
        })
      }

      const childExit = (reason) => {
        sendToChild("exit-please", reason)
      }

      const close = (reason) => {
        childExit(reason)

        return new Promise((resolve, reject) => {
          closeRegister((code) => {
            if (code === 0 || code === null) {
              resolve(code)
            } else {
              reject()
            }
          })
        })
      }

      const restart = (reason) => {
        // if we first receive restart we fork a new child
        log(`restart first step: ask politely to the child to exit`)
        childExit(reason)
        log(`restart second step: wait for child to close`)

        return new Promise((resolve, reject) => {
          eventRace({
            cancel: {
              register: cancellation.register,
              callback: (reason) => {
                log(`restart cancelled because ${reason}`)
                // we have nothing to do, the child will close
                // and we won't fork a new one
              },
            },
            close: {
              register: closeRegister,
              callback: (code) => {
                log(`restart last step: child closed with ${code}`)
                if (code === 0 || code === null) {
                  resolve(forkChild())
                } else {
                  reject(new Error(`child exited with ${code} after asking to restart`))
                }
              },
            },
          })
        })
      }

      await new Promise((resolve, reject) => {
        eventRace({
          cancel: {
            register: cancellation.register,
            callback: close,
          },
          close: {
            register: closeRegister,
            callback: (code) => {
              // child is not expected to close, we reject when it happens
              if (code === 12) {
                reject(
                  new Error(
                    `child exited with 12: forked child wanted to use a non available port for debug`,
                  ),
                )
                return
              }
              reject(`unexpected child close with code: ${code}`)
            },
          },
          restart: {
            register: restartRegister,
            callback: (reason) => resolve(restart(reason)),
          },
          error: {
            register: (callback) => registerChildEvent("error", callback),
            callback: (error) => {
              const localError = new Error(error.message)
              Object.assign(localError, error)
              console.error(localError)

              reject(localError)
            },
          },
          execute: {
            register: (callback) => registerChildEvent("execute", callback),
            callback: resolve,
          },
        })

        sendToChild("execute", {
          localRoot,
          remoteRoot,
          compileInto,
          groupMapFile,
          hotreload,
          hotreloadSSERoot,
          file,
          instrument,
          setup,
          teardown,
        })
      })

      eventRace({
        cancel: {
          register: cancellation.register,
          callback: close,
        },
        restart: {
          register: restartRegister,
          callback: restart,
        },
      })
    }

    return forkChild()
  }

  return execute
}
