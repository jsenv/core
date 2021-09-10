import {
  failureSign,
  okSign,
  setANSIColor,
  ANSI_MAGENTA,
  ANSI_YELLOW,
  ANSI_RED,
  ANSI_GREY,
  ANSI_GREEN,
} from "../logs/log_style.js"
import { msAsDuration } from "../logs/msAsDuration.js"
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
${description} ${summary}
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
    startMs,
    endMs,
  })}${appendConsole(consoleCalls)}${appendError(error)}`
}

const descriptionFormatters = {
  disconnected: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${failureSign} execution ${executionNumber} of ${executionCount} disconnected`,
      ANSI_MAGENTA,
    )
  },
  timedout: ({ executionNumber, allocatedMs, executionCount }) => {
    return setANSIColor(
      `${failureSign} execution ${executionNumber} of ${executionCount} timeout after ${allocatedMs}ms`,
      ANSI_YELLOW,
    )
  },
  errored: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${failureSign} execution ${executionNumber} of ${executionCount} error`,
      ANSI_RED,
    )
  },
  completed: ({ executionNumber, executionCount }) => {
    return setANSIColor(
      `${okSign} execution ${executionNumber} of ${executionCount} completed`,
      ANSI_GREEN,
    )
  },
}

const appendDuration = ({ endMs, startMs }) => {
  if (!endMs) return ""

  return `
duration: ${msAsDuration(endMs - startMs)}`
}

const appendConsole = (consoleCalls) => {
  if (!consoleCalls || consoleCalls.length === 0) return ""

  const consoleOutput = consoleCalls.reduce((previous, { text }) => {
    return `${previous}${text}`
  }, "")

  const consoleOutputTrimmed = consoleOutput.trim()
  if (consoleOutputTrimmed === "") return ""

  return `
${setANSIColor(`-------- console --------`, ANSI_GREY)}
${consoleOutputTrimmed}
${setANSIColor(`-------------------------`, ANSI_GREY)}`
}

const appendError = (error) => {
  if (!error) return ``
  return `
error: ${error.stack}`
}

export const createShortExecutionResultLog = () => {
  return `Execution completed (2/9) - (all completed)`
}
