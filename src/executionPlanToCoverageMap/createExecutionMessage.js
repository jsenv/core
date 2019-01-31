const cross = "☓" // "\u2613"
const checkmark = "✔" // "\u2714"

const yellow = "\x1b[33m"
const close = "\x1b[0m"
const magenta = "\x1b[35m"
const red = "\x1b[31m"
const green = "\x1b[32m"

export const createFileExecutionResultMessage = ({
  file,
  platformName,
  status,
  statusData,
  capturedConsole,
}) => {
  if (status === "disconnected") {
    return createDisconnectedMessage({ file, platformName, output: capturedConsole })
  }

  if (status === "timedout") {
    return createTimedoutMessage({
      file,
      platformName,
      allocatedMs: statusData,
      output: capturedConsole,
    })
  }

  if (status === "errored") {
    return createErroredMessage({ file, platformName, output: capturedConsole })
  }

  if (status === "passed") {
    return createPassedMessage({ file, platformName, output: capturedConsole })
  }

  return `unexpected status ${status}`
}

const createDisconnectedMessage = ({ file, output, platformName }) => {
  const color = yellow
  const icon = cross

  return `${color}${icon} ${file}${close}
----------- console ----------
${output}
------------------------------
platform: "${platformName}"
status: "disconnected"
`
}

const createTimedoutMessage = ({ file, output, platformName, allocatedMs }) => {
  const color = magenta
  const icon = cross

  return `${color}${icon} ${file}${close}
----------- console ----------
${output}
------------------------------
platform: "${platformName}"
status: "timedout"
statusText: "execution takes more than ${allocatedMs}ms to complete"
`
}

const createErroredMessage = ({ file, output, platformName }) => {
  const color = red
  const icon = cross

  return `${color}${icon} ${file}${close}
----------- console ----------
${output}
------------------------------
platform: "${platformName}"
status: "errored"
`
}

const createPassedMessage = ({ file, output, platformName }) => {
  const color = green
  const icon = checkmark

  return `${color}${icon} ${file}${close}
----------- console ----------
${output}
------------------------------
platform: "${platformName}"
status: "passed"
`
}

export const createExecutionResultMessage = ({ executionResult }) => {
  const fileNames = Object.keys(executionResult)
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(executionResult[fileName]).length
  }, 0)

  const countResultMatching = (predicate) => {
    fileNames.reduce((previous, fileName) => {
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
- ${green}${completedCount} completed${close}
----------------------------------`
}
