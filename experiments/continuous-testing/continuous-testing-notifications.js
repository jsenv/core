export const createBrokenNotificationMessage = ({ testingResult }) => {
  const failingCount = testingResult.summary.executionCount - testingResult.summary.completedCount
  return `${failingCount} execution now failing.`
}

export const createFixedNotificationMessage = ({ previousTestingResult }) => {
  const previousFailingCount =
    previousTestingResult.summary.executionCount - previousTestingResult.summary.completedCount
  return `${previousFailingCount} execution fixed.`
}

export const createStillFailingNotificationMessage = ({ previousTestingResult, testingResult }) => {
  const { fixedCount, brokenCount, stillFailingCount } = computeTestingResultComparisonSummary(
    previousTestingResult,
    testingResult,
  )

  let message = ``
  if (fixedCount) {
    message += `
${fixedCount} execution fixed.`
  }
  if (brokenCount) {
    message += `
${brokenCount} execution now failing.`
  }
  if (stillFailingCount) {
    message += `
${stillFailingCount} execution still failing.`
  }

  return message
}

const computeTestingResultComparisonSummary = (previousTestingResult, testingResult) => {
  const previousExecutionArray = reportToExecutionResultArray(previousTestingResult.report)
  const executionArray = reportToExecutionResultArray(testingResult.report)

  let fixedCount = 0
  let brokenCount = 0
  let stillFailingCount = 0
  executionArray.forEach(({ relativeUrl, executionResult: { status, executionName } }) => {
    const previousExecution = previousExecutionArray.find((previousExecutionCandidate) => {
      if (previousExecutionCandidate.relativeUrl !== relativeUrl) return false
      if (previousExecutionCandidate.executionResult.executionName !== executionName) return false
      return true
    })

    if (!previousExecution) {
      if (status === "completed") return
      brokenCount++
      return
    }

    const previousStatus = previousExecution.executionResult.status
    if (previousStatus === "completed" && status === "completed") {
      return
    }
    if (previousStatus !== "completed" && status === "completed") {
      fixedCount++
      return
    }
    if (previousStatus !== "completed" && status !== "completed") {
      stillFailingCount++
      return
    }
  })

  return { fixedCount, brokenCount, stillFailingCount }
}

const reportToExecutionResultArray = (report) => {
  const executionResultArray = []
  Object.keys(report).forEach((relativeUrl) => {
    const fileExecutionMap = report[relativeUrl]
    Object.keys(fileExecutionMap).forEach((executionName) => {
      executionResultArray.push({
        relativeUrl,
        executionResult: fileExecutionMap[executionName],
      })
    })
  })
  return executionResultArray
}
