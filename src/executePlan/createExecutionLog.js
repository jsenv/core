const cross = "☓" // "\u2613"
const checkmark = "✔" // "\u2714"

const yellow = "\x1b[33m"
const close = "\x1b[0m"
const magenta = "\x1b[35m"
const red = "\x1b[31m"
const green = "\x1b[32m"
const grey = "\x1b[39m"

export const createExecutionPlanStartLog = () => {
  return `
------------- execution plan start ----------------`
}

export const createExecutionResultLog = ({
  filenameRelative,
  status,
  platformName,
  platformLog,
  startMs,
  endMs,
  allocatedMs,
}) => {
  if (status === "disconnected") {
    return createDisconnectedLog({ filenameRelative, platformName, platformLog, startMs, endMs })
  }

  if (status === "timedout") {
    return createTimedoutLog({
      filenameRelative,
      platformName,
      platformLog,
      startMs,
      endMs,
      allocatedMs,
    })
  }

  if (status === "errored") {
    return createErroredLog({ filenameRelative, platformName, platformLog, startMs, endMs })
  }

  if (status === "completed") {
    return createCompletedLog({ filenameRelative, platformName, platformLog, startMs, endMs })
  }

  return `unexpected status ${status}`
}

const createDisconnectedLog = ({ filenameRelative, platformName, platformLog, startMs, endMs }) => {
  const color = magenta
  const icon = cross

  return `
${color}${icon} disconnected during execution${close}
filenameRelative: ${filenameRelative}
platform: ${platformName}
duration: ${formatDuration(endMs - startMs)}
${formatPlatformLog(platformLog)}`
}

const createTimedoutLog = ({
  filenameRelative,
  platformName,
  platformLog,
  startMs,
  endMs,
  allocatedMs,
}) => {
  const color = yellow
  const icon = cross

  return `
${color}${icon} execution takes more than ${allocatedMs}ms${close}
filenameRelative: ${filenameRelative}
platform: ${platformName}
duration: ${formatDuration(endMs - startMs)}
${formatPlatformLog(platformLog)}`
}

const createErroredLog = ({ filenameRelative, platformName, platformLog, startMs, endMs }) => {
  const color = red
  const icon = cross

  return `
${color}${icon} error during execution${close}
filenameRelative: ${filenameRelative}
platform: ${platformName}
duration: ${formatDuration(endMs - startMs)}
${formatPlatformLog(platformLog)}`
}

const createCompletedLog = ({ filenameRelative, platformName, platformLog, startMs, endMs }) => {
  const color = green
  const icon = checkmark

  return `
${color}${icon} execution completed${close}
filenameRelative: ${filenameRelative}
platform: ${platformName}
duration: ${formatDuration(endMs - startMs)}
${formatPlatformLog(platformLog)}`
}

const formatPlatformLog = (platformLog) => {
  return `${grey}---------- log ----------${close}
${platformLog.trim()}
${grey}-------------------------${close}`
}

export const createExecutionPlanResultLog = ({ planResult }) => {
  const fileNames = Object.keys(planResult)
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(planResult[fileName]).length
  }, 0)

  const countResultMatching = (predicate) => {
    return fileNames.reduce((previous, fileName) => {
      const fileExecutionResult = planResult[fileName]

      return (
        previous +
        Object.keys(fileExecutionResult).filter((platformName) => {
          const fileExecutionResultForPlatform = fileExecutionResult[platformName]
          return predicate(fileExecutionResultForPlatform)
        }).length
      )
    }, 0)
  }

  const disconnectedCount = countResultMatching(({ status }) => status === "disconnected")
  const timedoutCount = countResultMatching(({ status }) => status === "timedout")
  const erroredCount = countResultMatching(({ status }) => status === "errored")
  const completedCount = countResultMatching(({ status }) => status === "completed")

  return `
-------------- execution plan result -----------------
${executionCount} execution launched
- ${magenta}${disconnectedCount} disconnected${close}
- ${yellow}${timedoutCount} timedout${close}
- ${red}${erroredCount} errored${close}
- ${green}${completedCount} completed${close}
------------------------------------------------------`
}

const formatDuration = (duration) => {
  const seconds = duration / 1000
  const secondsWithTwoDecimalPrecision = Math.floor(seconds * 100) / 100

  return `${secondsWithTwoDecimalPrecision}s`
}
