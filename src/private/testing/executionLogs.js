import { magenta, cross, yellow, green, checkmark, grey, red, ansiResetSequence } from "./ansi.js"
import { formatDuration } from "./formatDuration.js"

export const createExecutionPlanStartLog = () => `
------------- execution plan start ----------------`

export const createDisconnectedLog = ({
  fileRelativePath,
  platformName,
  platformVersion,
  platformLog,
  startMs,
  endMs,
}) => {
  const color = magenta
  const icon = cross

  return `
${color}${icon} disconnected during execution.${ansiResetSequence}
file: ${fileRelativePath.slice(1)}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendPlatformLog(platformLog)}`
}

export const createTimedoutLog = ({
  fileRelativePath,
  platformName,
  platformVersion,
  platformLog,
  startMs,
  endMs,
  allocatedMs,
}) => {
  const color = yellow
  const icon = cross

  return `
${color}${icon} execution takes more than ${allocatedMs}ms.${ansiResetSequence}
file: ${fileRelativePath.slice(1)}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendPlatformLog(platformLog)}`
}

export const createErroredLog = ({
  fileRelativePath,
  platformName,
  platformVersion,
  platformLog,
  startMs,
  endMs,
  error,
}) => {
  const color = red
  const icon = cross

  return `
${color}${icon} error during execution.${ansiResetSequence}
file: ${fileRelativePath.slice(1)}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendPlatformLog(platformLog)}${appendError(error)}`
}

const appendError = (error) => {
  if (!error) return ``
  return `
error: ${error.stack}`
}

export const createCompletedLog = ({
  fileRelativePath,
  platformName,
  platformVersion,
  platformLog,
  startMs,
  endMs,
}) => {
  const color = green
  const icon = checkmark

  return `
${color}${icon} execution completed.${ansiResetSequence}
file: ${fileRelativePath.slice(1)}
platform: ${formatPlatform({ platformName, platformVersion })}${appendDuration({
    startMs,
    endMs,
  })}${appendPlatformLog(platformLog)}`
}

const formatPlatform = ({ platformName, platformVersion }) => `${platformName}/${platformVersion}`

const appendDuration = ({ endMs, startMs }) => {
  if (!endMs) return ""

  return `
duration: ${formatDuration(endMs - startMs)}`
}

const appendPlatformLog = (platformLog) => {
  if (!platformLog) return ""

  const trimmedPlatformLog = platformLog.trim()
  if (trimmedPlatformLog === "") return ""

  return `
${grey}---------- log ----------${ansiResetSequence}
${trimmedPlatformLog}
${grey}-------------------------${ansiResetSequence}`
}
