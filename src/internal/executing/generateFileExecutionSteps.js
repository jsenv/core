import { createDetailedMessage } from "@jsenv/logger"

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
          `found unexpected value in plan, they must be object.`,
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
