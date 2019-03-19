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

      const { coverageMap } = executionResultForFileOnPlatform
      if (!coverageMap) {
        // we throw because if ther is no parse error or notfound error
        // coverageMap should be available
        throw new Error(createMissingCoverageForExecutionMessage({ file, executionName }))
      }

      coverageMapArray.push(coverageMap)
    })
  })

  const executionCoverageMap = coverageMapCompose(...coverageMapArray)

  return executionCoverageMap
}

const executionResultIsModuleParseError = ({ status, error }) => {
  return status === "errored" && error && error.code === "MODULE_PARSE_ERROR"
}

const executionResultIsModuleNotFoundError = ({ status, error }) => {
  return status === "errored" && error && error.code === "MODULE_NOT_FOUND_ERROR"
}

const createMissingCoverageForExecutionMessage = ({
  file,
  executionName,
}) => `missing coverageMap for execution.
file: ${file}
executionName: ${executionName}`
