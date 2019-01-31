const cross = "☓" // "\u2613"
const checkmark = "✔" // "\u2714"

const yellow = "\x1b[33m"
const close = "\x1b[0m"
const magenta = "\x1b[35m"
const red = "\x1b[31m"
const green = "\x1b[32m"

export const createFileExecutionResultLog = ({
  file,
  platformName,
  status,
  statusData,
  capturedConsole,
}) => {
  if (status === "disconnected") {
    return createDisconnectedLog({ file, platformName, output: capturedConsole })
  }

  if (status === "timedout") {
    return createTimedoutLog({
      file,
      platformName,
      allocatedMs: statusData,
      output: capturedConsole,
    })
  }

  if (status === "errored") {
    return createErroredLog({ file, platformName, output: capturedConsole })
  }

  if (status === "completed") {
    return createCompletedLog({ file, platformName, output: capturedConsole })
  }

  return `unexpected status ${status}`
}

const createDisconnectedLog = ({ file, output, platformName }) => {
  const color = yellow
  const icon = cross

  return `
${color}${icon} ${file}${close}
platform: ${platformName}
message: platform disconnected during file execution.
${output}
`
}

const createTimedoutLog = ({ file, output, platformName, allocatedMs }) => {
  const color = magenta
  const icon = cross

  return `
${color}${icon} ${file}${close}
platform: ${platformName}
message: file execution took more than ${allocatedMs}ms to complete.
${output}
`
}

const createErroredLog = ({ file, output, platformName }) => {
  const color = red
  const icon = cross

  return `
${color}${icon} ${file}${close}
platform: ${platformName}
message: error occured during file execution.
${output}
`
}

const createCompletedLog = ({ file, output, platformName }) => {
  const color = green
  const icon = checkmark

  return `
${color}${icon} ${file}${close}
platform: ${platformName}
${output}
`
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

  return `------ execution summary ---------
${executionCount} file execution launched
- ${yellow}${disconnectedCount} disconnected${close}
- ${magenta}${timedoutCount} timedout${close}
- ${red}${erroredCount} errored${close}
- ${green}${completedCount} completed${close}`
}
