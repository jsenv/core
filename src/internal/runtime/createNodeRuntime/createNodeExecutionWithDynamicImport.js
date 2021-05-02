import { uneval } from "@jsenv/uneval"
import { resolveUrl } from "@jsenv/util"

export const createNodeExecutionWithDynamicImport = ({ projectDirectoryUrl }) => {
  const executeFile = async (specifier, { errorExposureInConsole = false } = {}) => {
    // we can't dynamically import from compileServerOrigin I guess
    // we have to use the filesystem
    const fileUrl = resolveUrl(specifier, projectDirectoryUrl)

    try {
      const namespace = await makePromiseKeepNodeProcessAlive(import(fileUrl))
      const coverageMap = await readCoverage()
      return {
        status: "completed",
        namespace,
        coverageMap,
      }
    } catch (error) {
      if (errorExposureInConsole) console.error(error)

      const coverageMap = await readCoverage()

      return {
        status: "errored",
        exceptionSource: unevalException(error),
        coverageMap,
      }
    }
  }

  return { executeFile }
}

const makePromiseKeepNodeProcessAlive = async (promise) => {
  const timerId = setInterval(() => {}, 10000)

  try {
    const value = await promise
    return value
  } finally {
    clearInterval(timerId)
  }
}

const readCoverage = async () => {
  // TODO
}

const unevalException = (value) => {
  if (value.hasOwnProperty("toString")) {
    delete value.toString
  }
  return uneval(value)
}
