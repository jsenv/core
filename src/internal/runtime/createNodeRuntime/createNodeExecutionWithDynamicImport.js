import { uneval } from "@jsenv/uneval"
import { resolveUrl } from "@jsenv/util"

export const createNodeExecutionWithDynamicImport = ({ projectDirectoryUrl }) => {
  const executeFile = async (specifier, { errorExposureInConsole = false } = {}) => {
    // we can't dynamically import from compileServerOrigin I guess
    // we have to use the filesystem
    const fileUrl = resolveUrl(specifier, projectDirectoryUrl)

    try {
      const status = "completed"
      const namespace = await makePromiseKeepNodeProcessAlive(import(fileUrl))
      return {
        status,
        namespace,
      }
    } catch (error) {
      if (errorExposureInConsole) console.error(error)
      const status = "errored"
      const exceptionSource = unevalException(error)
      return {
        status,
        exceptionSource,
      }
    }
  }

  return { executeFile }
}

const makePromiseKeepNodeProcessAlive = async (promise) => {
  const timerId = setInterval(() => {}, 1000)

  try {
    const value = await promise
    return value
  } finally {
    clearInterval(timerId)
  }
}

const unevalException = (value) => {
  if (value.hasOwnProperty("toString")) {
    delete value.toString
  }
  return uneval(value)
}
