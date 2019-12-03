import { magenta, cross, yellow, green, checkmark, grey, red, ansiResetSequence } from "./ansi.js"
import { formatDuration } from "./formatDuration.js"

export const createExecutionResultLog = (
  {
    status,
    fileRelativeUrl,
    allocatedMs,
    platformName,
    platformVersion,
    consoleCalls,
    startMs,
    endMs,
    error,
    executionIndex,
  },
  { executionCount },
) => {
  const executionNumber = executionIndex + 1

  if (status === "completed") {
    return `
${green}${checkmark} execution completed.${ansiResetSequence} (${executionNumber}/${executionCount})
file: ${fileRelativeUrl}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
      startMs,
      endMs,
    })}${appendConsole(consoleCalls)}${appendError(error)}`
  }

  if (status === "disconnected") {
    return `
${magenta}${cross} disconnected during execution.${ansiResetSequence} (${executionNumber}/${executionCount})
file: ${fileRelativeUrl}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
      startMs,
      endMs,
    })}${appendConsole(consoleCalls)}${appendError(error)}`
  }

  if (status === "timedout") {
    return `
${yellow}${cross} execution takes more than ${allocatedMs}ms.${ansiResetSequence} (${executionNumber}/${executionCount})
file: ${fileRelativeUrl}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
      startMs,
      endMs,
    })}${appendConsole(consoleCalls)}${appendError(error)}`
  }

  return `
${red}${cross}error during execution.${ansiResetSequence} (${executionNumber}/${executionCount})
file: ${fileRelativeUrl}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}${appendError(error)}`
}

const formatPlatform = ({ platformName, platformVersion }) => `${platformName}/${platformVersion}`

const appendDuration = ({ endMs, startMs }) => {
  if (!endMs) return ""

  return `
duration: ${formatDuration(endMs - startMs)}`
}

const appendConsole = (consoleCalls) => {
  if (!consoleCalls || consoleCalls.length === 0) return ""

  const consoleOutput = consoleCalls.reduce((previous, { text }) => {
    return `${previous}${text}`
  }, "")

  const consoleOutputTrimmed = consoleOutput.trim()
  if (consoleOutputTrimmed === "") return ""

  return `
${grey}-------- console --------${ansiResetSequence}
${consoleOutputTrimmed}
${grey}-------------------------${ansiResetSequence}`
}

const appendError = (error) => {
  if (!error) return ``
  return `
error: ${error.stack}`
}
