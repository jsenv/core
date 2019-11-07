export const generateFilePlan = (relativePath, meta) => {
  const filePlan = {}
  Object.keys(meta).forEach((executionName) => {
    const fileExecuteStepDescription = meta[executionName]
    if (fileExecuteStepDescription === null || fileExecuteStepDescription === undefined) return
    if (typeof fileExecuteStepDescription !== "object") {
      throw new TypeError(`a file execute step description must be an object.
--- file relative path ---
${relativePath}
--- execution name ---
${executionName}
--- step description value ---
${fileExecuteStepDescription}`)
    }

    filePlan[executionName] = fileExecuteStepDescription
  })
  return filePlan
}
