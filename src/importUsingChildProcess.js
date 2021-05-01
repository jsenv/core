import { launchAndExecute } from "./internal/executing/launchAndExecute.js"
import { createControllableNodeProcess } from "./internal/node-launcher/createControllableNodeProcess.js"

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
  const result = await launchAndExecute({
    stopAfterExecute: true,
    fileRelativeUrl: String(fileUrl),
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
        executeFile: async () => {
          try {
            const namespace = await importInChildProcess({ controllableNodeProcess, fileUrl })
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
  })
  if (result.status === "errored") {
    throw result.error
  }
  return result.namespace
}

const importInChildProcess = ({ controllableNodeProcess, fileUrl }) => {
  return controllableNodeProcess.evaluate(`
const namespacePromise = import(${JSON.stringify(fileUrl)})

const resolveNamespace = async (namespacePromise) => {
  const namespace = await namespacePromise
  const namespaceResolved = {}
  await Promise.all([
    ...Object.keys(namespace).map(async (key) => {
      const value = await namespace[key]
      namespaceResolved[key] = value
    }),
  ])
  return namespaceResolved
}

export default resolveNamespace(namespacePromise)
`)
}
