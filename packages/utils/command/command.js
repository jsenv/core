import { exec } from "node:child_process"
import { createLogger } from "@jsenv/logger"
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
      cwd,
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
    commandProcess.stdout.on("data", (data) => {
      logger.debug(data)
      onStderr(data)
    })
    commandProcess.stderr.on("data", (data) => {
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
        logger.debug(`killed with ${signal}`)
      }
      if (exitCode) {
        logger.error(`failed with exit code ${exitCode}`)
      }
      resolve({ exitCode, signal })
    })
  })
}
