import { Abort } from "@jsenv/abort"
import { collectFiles } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/log"

export const executionStepsFromTestPlan = async ({
  signal,
  rootDirectoryUrl,
  testPlan,
}) => {
  try {
    const fileResultArray = await collectFiles({
      signal,
      directoryUrl: rootDirectoryUrl,
      associations: { testPlan },
      predicate: ({ testPlan }) => testPlan,
    })
    const executionSteps = []
    fileResultArray.forEach(({ relativeUrl, meta }) => {
      const fileExecutionSteps = generateFileExecutionSteps({
        fileRelativeUrl: relativeUrl,
        filePlan: meta.testPlan,
      })
      executionSteps.push(...fileExecutionSteps)
    })
    return executionSteps
  } catch (e) {
    if (Abort.isAbortError(e)) {
      return {
        aborted: true,
        planSummary: {},
        planReport: {},
        planCoverage: null,
      }
    }
    throw e
  }
}

export const generateFileExecutionSteps = ({ fileRelativeUrl, filePlan }) => {
  const fileExecutionSteps = []
  Object.keys(filePlan).forEach((executionName) => {
    const stepConfig = filePlan[executionName]
    if (stepConfig === null || stepConfig === undefined) {
      return
    }
    if (typeof stepConfig !== "object") {
      throw new TypeError(
        createDetailedMessage(
          `found unexpected value in plan, they must be object`,
          {
            ["file relative path"]: fileRelativeUrl,
            ["execution name"]: executionName,
            ["value"]: stepConfig,
          },
        ),
      )
    }
    fileExecutionSteps.push({
      executionName,
      fileRelativeUrl,
      ...stepConfig,
    })
  })
  return fileExecutionSteps
}
