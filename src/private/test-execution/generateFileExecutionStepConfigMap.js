export const generateFileExecutionStepConfigMap = (relativePath, planConfig) => {
  const fileExecutionStepConfigMap = {}
  Object.keys(planConfig).forEach((name) => {
    const executionStepConfig = planConfig[name]
    if (executionStepConfig === null || executionStepConfig === undefined) {
      return
    }

    if (typeof executionStepConfig !== "object") {
      throw new TypeError(`found unexpected value in plan, they must be object.
--- file relative path ---
${relativePath}
--- name ---
${name}
--- value ---
${executionStepConfig}`)
    }

    fileExecutionStepConfigMap[name] = executionStepConfig
  })
  return fileExecutionStepConfigMap
}
