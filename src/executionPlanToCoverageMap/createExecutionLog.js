const cross = "☓" // "\u2613"
const checkmark = "✔" // "\u2714"

const yellow = "\x1b[33m"
const close = "\x1b[0m"
const magenta = "\x1b[35m"
const red = "\x1b[31m"
const green = "\x1b[32m"
const grey = "\x1b[39m"

export const createFileExecutionResultLog = ({
  file,
  status,
  platformName,
  platformLog,
  startMs,
  endMs,
  allocatedMs,
}) => {
  if (status === "disconnected") {
    return createDisconnectedLog({ file, platformName, platformLog, startMs, endMs })
  }

  if (status === "timedout") {
    return createTimedoutLog({
      file,
      platformName,
      platformLog,
      startMs,
      endMs,
      allocatedMs,
    })
  }

  if (status === "errored") {
    return createErroredLog({ file, platformName, platformLog, startMs, endMs })
  }

  if (status === "completed") {
    return createCompletedLog({ file, platformName, platformLog, startMs, endMs })
  }

  return `unexpected status ${status}`
}

const createDisconnectedLog = ({ file, platformName, platformLog, startMs, endMs }) => {
  const color = magenta
  const icon = cross

  return `
${createHorizontalSeparator()}
${color}${icon} disconnected during file execution${close}
file: ${file}
platform: ${platformName}
duration: ${formatDuration(endMs - startMs)}
${createHorizontalSeparator()}
${platformLog}`
}

const createTimedoutLog = ({ file, platformName, platformLog, startMs, endMs, allocatedMs }) => {
  const color = yellow
  const icon = cross

  return `
${createHorizontalSeparator()}
${color}${icon} file execution takes more than ${allocatedMs}ms${close}
file: ${file}
platform: ${platformName}
duration: ${formatDuration(endMs - startMs)}
${createHorizontalSeparator()}
${platformLog}`
}

const createErroredLog = ({ file, platformName, platformLog, startMs, endMs }) => {
  const color = red
  const icon = cross

  return `
${createHorizontalSeparator()}
${color}${icon} error during file execution${close}
file: ${file}
platform: ${platformName}
duration: ${formatDuration(endMs - startMs)}
${createHorizontalSeparator()}
${platformLog}`
}

const createCompletedLog = ({ file, platformName, platformLog, startMs, endMs }) => {
  const color = green
  const icon = checkmark

  return `
${createHorizontalSeparator()}
${color}${icon} file execution completed${close}
file: ${file}
platform: ${platformName}
duration: ${formatDuration(endMs - startMs)}
${createHorizontalSeparator()}
${platformLog}`
}

const createHorizontalSeparator = () => {
  return `${grey}---------------------------------------------------------${close}`
}

export const createExecutionResultLog = ({ executionResult }) => {
  const fileNames = Object.keys(executionResult)
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(executionResult[fileName]).length
  }, 0)

  const countResultMatching = (predicate) => {
    return fileNames.reduce((previous, fileName) => {
      const fileExecutionResult = executionResult[fileName]

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
---------------- execution summary -------------------
${executionCount} file execution launched
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
