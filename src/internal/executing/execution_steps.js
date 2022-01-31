import { collectFiles } from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

export const generateExecutionSteps = async (
  plan,
  { signal, projectDirectoryUrl },
) => {
  const structuredMetaMap = {
    filePlan: plan,
  }

  const fileResultArray = await collectFiles({
    signal,
    directoryUrl: projectDirectoryUrl,
    structuredMetaMap,
    predicate: ({ filePlan }) => filePlan,
  })

  const executionSteps = []
  fileResultArray.forEach(({ relativeUrl, meta }) => {
    const fileExecutionSteps = generateFileExecutionSteps({
      fileRelativeUrl: relativeUrl,
      filePlan: meta.filePlan,
    })
    executionSteps.push(...fileExecutionSteps)
  })
  return executionSteps
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
