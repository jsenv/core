export const filePlanToExecutionArray = (filePlan, fileRelativePath) => {
  const executionArray = []
  Object.keys(filePlan).forEach((executionName) => {
    executionArray.push({
      executionName,
      fileRelativePath,
      ...filePlan[executionName],
    })
  })
  return executionArray
}
