import { exec } from "node:child_process"
import { createDetailedMessage, createLogger } from "@jsenv/logger"
import { UNICODE } from "@jsenv/log"

export const executeCommand = (
  command,
  {
    logLevel = "info",
    signal = new AbortController().signal,
    onStdout = () => {},
    onStderr = () => {},
    cwd,
    env,
    timeout,
  } = {},
) => {
  const logger = createLogger({ logLevel })

  return new Promise((resolve, reject) => {
    logger.debug(`${UNICODE.COMMAND} ${command}`)
    const commandProcess = exec(command, {
      signal,
      cwd:
        cwd && typeof cwd === "string" && cwd.startsWith("file:")
          ? new URL(cwd)
          : cwd,
      env,
      timeout,
      silent: true,
    })
    commandProcess.on("error", (error) => {
      if (error && error.code === "ETIMEDOUT") {
        logger.error(`timeout after ${timeout} ms`)
        reject(error)
      } else {
        reject(error)
      }
    })
    const stdoutDatas = []
    commandProcess.stdout.on("data", (data) => {
      stdoutDatas.push(data)
      logger.debug(data)
      onStderr(data)
    })
    let stderrDatas = []
    commandProcess.stderr.on("data", (data) => {
      stderrDatas.push(data)
      logger.debug(data)
      onStdout(data)
    })
    if (commandProcess.stdin) {
      commandProcess.stdin.on("error", (error) => {
        reject(error)
      })
    }
    commandProcess.on("exit", (exitCode, signal) => {
      if (signal) {
        reject(new Error(`killed with ${signal}`))
      }
      if (exitCode) {
        reject(
          new Error(
            createDetailedMessage(`failed with exit code ${exitCode}`, {
              "command stderr": stderrDatas.join(""),
              // "command stdout": stdoutDatas.join(""),
            }),
          ),
        )
        return
      }
      resolve({ exitCode, signal })
    })
  })
}
