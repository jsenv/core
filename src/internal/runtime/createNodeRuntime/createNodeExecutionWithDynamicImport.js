import { uneval } from "@jsenv/uneval"
import { readDirectory, resolveUrl } from "@jsenv/util"

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

// import { require } from "./internal/require.js"

// const v8ToIstanbul = require("v8-to-istanbul")

const readCoverage = async () => {
  const coverageV8Dir = process.env.NODE_V8_COVERAGE
  if (!coverageV8Dir) {
    return undefined
  }

  const dir = await readDirectory(coverageV8Dir)
  debugger
  return {}
}

const unevalException = (value) => {
  if (value.hasOwnProperty("toString")) {
    delete value.toString
  }
  return uneval(value)
}
