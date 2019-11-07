export const generateFilePlan = (relativePath, meta) => {
  const filePlan = {}
  Object.keys(meta).forEach((executionName) => {
    const fileExecuteStepDescription = meta[executionName]
    if (fileExecuteStepDescription === null || fileExecuteStepDescription === undefined) return
    if (typeof fileExecuteStepDescription !== "object") {
      throw createFileExecuteStepDescriptionTypeError({
        relativePath,
        executionName,
        fileExecuteStepDescription,
      })
    }

    filePlan[executionName] = fileExecuteStepDescription
  })
  return filePlan
}

const createFileExecuteStepDescriptionTypeError = ({
  relativePath,
  executionName,
  fileExecuteStepDescription,
}) =>
  new TypeError(`a file execute step description must be an object.
file: ${relativePath}
execution name: ${executionName}
step description value: ${fileExecuteStepDescription}`)
