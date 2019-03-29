import { coverageMapCompose } from "./coverageMapCompose.js"

export const executionPlanResultToCoverageMap = (executionPlanResult) => {
  const coverageMapArray = []
  Object.keys(executionPlanResult).forEach((file) => {
    const executionResultForFile = executionPlanResult[file]
    Object.keys(executionResultForFile).forEach((executionName) => {
      const executionResultForFileOnPlatform = executionResultForFile[executionName]

      if (executionResultIsModuleParseError(executionResultForFileOnPlatform)) {
        return
      }

      if (executionResultIsModuleNotFoundError(executionResultForFileOnPlatform)) {
        return
      }

      if (executionResultIsTimedOut(executionResultForFileOnPlatform)) {
        return
      }

      const { coverageMap } = executionResultForFileOnPlatform
      if (!coverageMap) {
        // because only source file are instrumented
        // the execution of a test file importing nothing
        // will not produce any coverage and that's normal
        // we could eventually emit a warning
        return
      }

      coverageMapArray.push(coverageMap)
    })
  })

  const executionCoverageMap = coverageMapCompose(...coverageMapArray)

  return executionCoverageMap
}

const executionResultIsTimedOut = ({ status }) => {
  return status === "timedout"
}

const executionResultIsModuleParseError = ({ status, error }) => {
  return status === "errored" && error && error.code === "MODULE_PARSE_ERROR"
}

const executionResultIsModuleNotFoundError = ({ status, error }) => {
  return status === "errored" && error && error.code === "MODULE_NOT_FOUND_ERROR"
}

// const createMissingCoverageForExecutionMessage = ({
//   file,
//   executionName,
// }) => `missing coverageMap for execution.
// file: ${file}
// executionName: ${executionName}`
