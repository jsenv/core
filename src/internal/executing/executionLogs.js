import { magenta, cross, yellow, green, checkmark, grey, red, setANSIColor } from "./ansi.js"
import { formatDuration } from "./formatDuration.js"
import { createSummaryDetails } from "./createSummaryLog.js"

export const createExecutionResultLog = (
  { executionIndex, fileRelativeUrl, executionParams, executionResult },
  {
    completedExecutionLogAbbreviation,
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  },
) => {
  const executionNumber = executionIndex + 1
  const { status } = executionResult
  const { allocatedMs } = executionParams

  const description = descriptionFormatters[status]({
    executionNumber,
    executionCount,
    allocatedMs,
  })
  const summary = `(${createSummaryDetails({
    executionCount: executionNumber,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  })})`

  if (completedExecutionLogAbbreviation && status === "completed") {
    return `
${description} ${summary}`
  }

  const { runtimeName, runtimeVersion, consoleCalls, startMs, endMs, error } = executionResult

  const runtime = `${runtimeName}/${runtimeVersion}`
  return `
${description} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}${appendError(error)}`
}

const descriptionFormatters = {
  disconnected: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${cross} execution ${executionNumber} of ${executionCount} disconnected`,
      magenta,
    )
  },
  timedout: ({ executionNumber, allocatedMs, executionCount }) => {
    return setANSIColor(
      `${cross} execution ${executionNumber} of ${executionCount} timeout after ${allocatedMs}ms`,
      yellow,
    )
  },
  errored: ({ executionNumber, executionCount }) => {
    return setANSIColor(`${cross} execution ${executionNumber} of ${executionCount} error`, red)
  },
  completed: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${checkmark} execution ${executionNumber} of ${executionCount} completed`,
      green,
    )
  },
}

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
${setANSIColor(`-------- console --------`, grey)}
${consoleOutputTrimmed}
${setANSIColor(`-------------------------`, grey)}`
}

const appendError = (error) => {
  if (!error) return ``
  return `
error: ${error.stack}`
}

export const createShortExecutionResultLog = () => {
  return `Execution completed (2/9) - (all completed)`
}
