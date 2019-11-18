export const generateFileExecutionSteps = ({ fileRelativeUrl, filePlan }) => {
  const fileExecutionSteps = []
  Object.keys(filePlan).forEach((name) => {
    const stepConfig = filePlan[name]
    if (stepConfig === null || stepConfig === undefined) {
      return
    }

    if (typeof stepConfig !== "object") {
      throw new TypeError(`found unexpected value in plan, they must be object.
--- file relative path ---
${fileRelativeUrl}
--- name ---
${name}
--- value ---
${stepConfig}`)
    }

    fileExecutionSteps.push({
      name,
      fileRelativeUrl,
      ...stepConfig,
    })
  })

  return fileExecutionSteps
}
