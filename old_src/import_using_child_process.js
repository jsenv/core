import { launchAndExecute } from "./internal/executing/launch_and_execute.js"
import { createControllableNodeProcess } from "./internal/node_launcher/node_controllable_process.js"

export const importUsingChildProcess = async (
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
  fileUrl = String(fileUrl)
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
          execute: async ({ signal }) => {
            try {
              const namespace =
                await controllableNodeProcess.requestActionOnChildProcess({
                  signal,
                  actionType: "execute-using-import",
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
