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
    fileRelativeUrl: fileUrl,
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
            const namespace = await requireInChildProcess({ controllableNodeProcess, fileUrl })
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

const requireInChildProcess = ({ controllableNodeProcess, fileUrl }) => {
  return controllableNodeProcess.evaluate(`
import { createRequire } from "module"
import { fileURLToPath } from "url"

const fileUrl = ${JSON.stringify(fileUrl)}
const filePath = fileURLToPath(fileUrl)
const require = createRequire(fileUrl)
const namespace = require(filePath)

const resolveNamespace = async (namespace) => {
  const namespaceResolved = {}
  await Promise.all([
    ...Object.keys(namespace).map(async (key) => {
      const value = await namespace[key]
      namespaceResolved[key] = value
    }),
  ])
  return namespaceResolved
}

export default resolveNamespace(namespace)
`)
}
