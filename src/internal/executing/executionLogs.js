import { magenta, cross, yellow, green, checkmark, grey, red, ansiResetSequence } from "./ansi.js"
import { formatDuration } from "./formatDuration.js"

export const createExecutionPlanStartLog = () => `
------------- execution plan start ----------------`

export const createDisconnectedLog = ({
  fileRelativeUrl,
  platformName,
  platformVersion,
  consoleCalls,
  startMs,
  endMs,
}) => {
  const color = magenta
  const icon = cross

  return `
${color}${icon} disconnected during execution.${ansiResetSequence}
file: ${fileRelativeUrl}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}`
}

export const createTimedoutLog = ({
  fileRelativeUrl,
  platformName,
  platformVersion,
  consoleCalls,
  startMs,
  endMs,
  allocatedMs,
}) => {
  const color = yellow
  const icon = cross

  return `
${color}${icon} execution takes more than ${allocatedMs}ms.${ansiResetSequence}
file: ${fileRelativeUrl}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}`
}

export const createErroredLog = ({
  fileRelativeUrl,
  platformName,
  platformVersion,
  consoleCalls,
  startMs,
  endMs,
  error,
}) => {
  const color = red
  const icon = cross

  return `
${color}${icon} error during execution.${ansiResetSequence}
file: ${fileRelativeUrl}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}${appendError(error)}`
}

const appendError = (error) => {
  if (!error) return ``
  return `
error: ${error.stack}`
}

export const createCompletedLog = ({
  fileRelativeUrl,
  platformName,
  platformVersion,
  consoleCalls,
  startMs,
  endMs,
}) => {
  const color = green
  const icon = checkmark

  return `
${color}${icon} execution completed.${ansiResetSequence}
file: ${fileRelativeUrl}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}`
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
