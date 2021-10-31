import { launchAndExecute } from "./internal/executing/launchAndExecute.js"
import { createControllableNodeProcess } from "./internal/node-launcher/createControllableNodeProcess.js"

export const requireUsingChildProcess = async (
  fileUrl,
  {
    logLevel,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    commandLineOptions = [],
    env,
    stdin,
    stdout,
    stderr,
  } = {},
) => {
  const result = await launchAndExecute({
    stopAfterExecute: true,
    fileRelativeUrl: String(fileUrl),
    runtime: {
      name: "node",
      version: process.version.slice(1),
      launch: async () => {
        const controllableNodeProcess = await createControllableNodeProcess({
          logLevel,
          debugPort,
          debugMode,
          debugModeInheritBreak,
          env,
          commandLineOptions,
          stdin,
          stdout,
          stderr,
        })

        return {
          ...controllableNodeProcess,
          execute: async ({ abortSignal }) => {
            try {
              const namespace =
                await controllableNodeProcess.requestActionOnChildProcess({
                  abortSignal,
                  actionType: "execute-using-require",
                  actionParams: { fileUrl },
                })

              return {
                status: "ok",
                namespace,
              }
            } catch (e) {
              return {
                status: "errored",
                error: e,
              }
            }
          },
        }
      },
    },
  })
  if (result.status === "errored") {
    throw result.error
  }
  return result.namespace
}
