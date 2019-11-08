export const generateFileExecutionSteps = ({ fileRelativePath, filePlan }) => {
  const fileExecutionSteps = []
  Object.keys(filePlan).forEach((name) => {
    const stepConfigMap = filePlan[name]
    if (stepConfigMap === null || stepConfigMap === undefined) {
      return
    }

    if (typeof stepConfigMap !== "object") {
      throw new TypeError(`found unexpected value in plan, they must be object.
--- file relative path ---
${fileRelativePath}
--- name ---
${name}
--- value ---
${stepConfigMap}`)
    }

    Object.keys(stepConfigMap).forEach((name) => {
      fileExecutionSteps.push({
        name,
        fileRelativePath,
        ...stepConfigMap[name],
      })
    })
  })

  return fileExecutionSteps
}
