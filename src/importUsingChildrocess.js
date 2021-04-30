import { launchAndExecute } from "./internal/executing/launchAndExecute.js"
import { createControllableNodeProcess } from "./internal/node-launcher/createControllableNodeProcess.js"

export const importUsingChildrocess = async (
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
  },
) => {
  const result = await launchAndExecute({
    stopAfterExecute: true,
    launch: async () => {
      const nodeProcess = await createControllableNodeProcess({
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
        ...nodeProcess,
        executeFile: () => {
          return nodeProcess.evaluate(`
import defaultExport, * as namedExports from "${fileUrl}"
export default { defaultExport, namedExports }
          `)
        },
      }
    },
  })
  return result
}
